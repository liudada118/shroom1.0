/**
 * 创建历史回放会话服务。
 *
 * 承接历史日期列表、历史数据加载、趋势曲线和切换历史时的空白帧 payload；server.js 只提供数据库、
 * 运行态 getter/setter 和推送能力。依赖全部注入而不自己 import，否则这个模块会变成 server.js 的
 * 第二个入口、没法单独测试。**注入的都是函数**（含 `getRuntime`），所以本模块不持有快照 ——
 * 切换型号/日期时行为跟着变，不需要重建。
 *
 * @param {object} options 依赖注入。除下列几项外，其余均为透传给下游纯函数的工具。
 * @param {number} options.backTotal 靠背通道的点数，用于造清零数组。
 * @param {number} options.sitTotal 坐垫通道的点数，用于造清零数组。
 * @param {Function} options.getDatabases 取 `{db, db1, db2}` 三路历史库句柄。
 * @param {Function} options.getRuntime / options.setRuntime 运行态读写。
 * @param {Function} options.getPlaybackState / options.setPlaybackState /
 *        options.patchPlaybackState 回放状态读写。
 * @param {Function} options.stopPlaybackTimer 停回放定时器；换数据前必须先调。
 * @param {Function} options.publishSystemEvent 广播给全部客户端。
 * @param {number} [options.historyEagerRowLimit=50000] 全量加载的行数上限，
 *        超过改用懒加载代理。见 loadSelectedHistory 的说明。
 * @returns {{buildZeroPlaybackPayload: Function, calcDetectedInterval: Function,
 *   getHistorySeries: Function, loadSelectedHistory: Function,
 *   publishHistoryDateList: Function}} 历史会话能力。
 */
function createHistorySessionService({
  backTotal,
  buildHistoryZeroPlaybackPayload,
  createHistoryRowsForPlayback,
  createHistorySeries,
  dedupli,
  formatMatrixTotalForFile,
  getDatabases,
  getHistoryLengthFromCounts,
  getHistoryStats,
  getPlaybackState,
  getRuntime,
  isCar,
  isThreePortFile,
  logger,
  normalizeHistoryPressureData,
  patchPlaybackState,
  publishSystemEvent,
  queryHistoryDates,
  setPlaybackState,
  setRuntime,
  sitTotal,
  stopPlaybackTimer,
  totalToN,
  historyEagerRowLimit = 50000,
}) {
  /**
   * 从历史行算出趋势曲线（压力和 + 接触面积两条）。
   *
   * 本身只是给 `createHistorySeries` 补上四个依赖（归一化、矩阵尺寸格式化、总数换算），
   * 存在的意义是让调用点不用每次重复注入 —— 那四个依赖是 server.js 注进来的，
   * 纯函数 `createHistorySeries` 不该自己去拿。
   *
   * 参数名 `file` 在这里转成 `sensorType`：外层用的是历史遗留的 `file`（当前型号标识），
   * 下游用的是语义正确的名字，两边都不好单方面改，所以在这一层做转换。
   *
   * @param {object} options 参数。
   * @param {Array<object>} [options.sitRows] 坐垫历史行（可能是懒加载代理）。
   * @param {Array<object>} [options.backRows] 靠背历史行。
   * @param {number} [options.start=0] 起始下标。
   * @param {number|null} [options.end=null] 结束下标；null 表示到末尾。
   * @param {string} [options.file] 传感器型号标识。
   * @returns {{length: number, time: number[], press: number[], area: number[]}} 曲线数据。
   */
  function getHistorySeries({ sitRows = [], backRows = [], start = 0, end = null, file = '' }) {
    return createHistorySeries({
      sitRows,
      backRows,
      start,
      end,
      sensorType: file,
      normalizeHistoryPressureData,
      formatMatrixTotalForFile,
      totalToN,
    });
  }

  /**
   * 造一份「全零」的回放 payload，用来在切换历史日期时清空界面。
   *
   * ⚠️ 必须发这一帧而不是什么都不发：渲染器持有上一次的帧，不发新帧的话切换日期后画面上仍是
   * **上一个日期的最后一帧**，用户会以为新日期的数据长这样。发全零等于显式说「现在没有数据」。
   *
   * ⚠️ 零帧形状必须与真实帧一致（长度按型号算），所以每次现调 `getRuntime()` —— 长度不对渲染器
   * 会按错误尺寸解读，现象是花屏而不是空白。
   *
   * @returns {object} 与真实帧同形状但全零的 payload 片段，用于展开进广播消息。
   */
  function buildZeroPlaybackPayload() {
    const runtime = getRuntime();
    return buildHistoryZeroPlaybackPayload({
      sensorType: runtime.file,
      smallBed12BType: runtime.smallBed12BType,
      smallBed12BDisplayOptions: runtime.smallBed12BDisplayOptions,
    });
  }

  /**
   * 广播一次历史选择结果。
   *
   * 只是 `publishSystemEvent` 的具名别名，一行都没加。留着它是因为**这个名字标出了
   * 一个扩展点**：历史选择的广播口径（发给谁、要不要节流、要不要带更多字段）将来很可能
   * 要与其他系统事件分开处理，届时只改这一处，而 `loadSelectedHistory` 里的两个调用点
   * （成功路径与 catch 路径）不用动。
   *
   * @param {object} payload 要广播的消息。
   * @returns {*} publishSystemEvent 的返回值。
   */
  function broadcastHistorySelectionPayload(payload) {
    return publishSystemEvent(payload);
  }

  /**
   * 从时间戳序列**反推**这批历史数据当初的采样间隔（毫秒）。
   *
   * 要推是因为采样间隔不在数据库里（它取决于录制时的型号与串口速率，当时没存），而回放速度必须
   * 与录制一致。推不出来回落 `runtime.timeNum`（标称间隔），比回 0（定时器变忙循环）安全。
   *
   * ⚠️ 三条取值策略都不能随手简化：**取中位数不取平均**（历史里必有串口卡顿、进程挂起的跳变，
   * 平均值会被拉偏）；**只采前 20 个差值**（间隔在一次录制里固定，而几 GB 的库全量遍历会阻塞
   * 事件循环 —— 这一层是同步的）；**丢掉 `<=0` 和 `>=5000ms`**（前者是时间戳乱序，后者是录制
   * 中断，把 30 秒的中断算进去会让回放慢到不可用；5000 是经验值，本仓最慢采样远快于此）。
   *
   * @param {number[]} timestamps 历史帧时间戳，按顺序。
   * @returns {number} 采样间隔（毫秒），至少 1。
   */
  function calcDetectedInterval(timestamps) {
    const runtime = getRuntime();
    if (!Array.isArray(timestamps) || timestamps.length < 2) return runtime.timeNum;
    const sampleSize = Math.min(20, timestamps.length - 1);
    const diffs = [];
    for (let i = 1; i <= sampleSize; i++) {
      const diff = timestamps[i] - timestamps[i - 1];
      if (diff > 0 && diff < 5000) diffs.push(diff);
    }
    if (diffs.length === 0) return runtime.timeNum;
    diffs.sort((a, b) => a - b);
    return Math.max(1, diffs[Math.floor(diffs.length / 2)]);
  }

  /**
   * 加载某个历史日期的全部数据，并把回放状态重置到起点。
   *
   * 按型号读一到三路库：`db` 坐垫（永远）、`db1` 靠背（仅 `isCar`）、`db2` 头部（仅
   * `isThreePortFile`）—— 判断放这一层是因为多读一路的代价是一次几 GB 表上的 COUNT。
   * `indexArr` 设成 `[0, length - 2]`，末位留 2 是因为回放推帧要读「下一帧」。catch 里不只记日志，
   * 而是把状态清空并广播空 payload（理由同 `buildZeroPlaybackPayload`：不清的话界面留着上个日期
   * 的数据，用户察觉不到切换失败），且刻意不再抛 —— 加载历史失败不该让后端挂掉。
   *
   * ⚠️ **第一件事必须是 `stopPlaybackTimer()`**：不停的话旧定时器会继续按旧 `localData` 的下标
   * 推帧，而下面几行马上换掉 `localData` —— 现象是切换瞬间闪出几帧越界/错位的数据。
   *
   * ⚠️ **超过 `historyEagerRowLimit`（默认 5 万行）必须转 lazy Proxy**（按下标现查 + LRU）：单表
   * 能到几 GB（`smallBed12B.db` 4.36 GB），全量读进内存直接 OOM。阈值取 `max(三路行数)` 而非总和
   * （三路并行，峰值由最大那路决定）。代价是拖进度条有零星磁盘延迟。
   *
   * ⚠️ 长度**优先用 `totalLength`**（各路 COUNT 换算），`historySeries.length` 只在其为 0 时兜底
   * —— lazy 模式下曲线按代理遍历算，可能只覆盖一部分。长度错了进度条刻度就与实际帧数对不上。
   *
   * @param {string} dateLabel 历史日期标签（数据库 `matrix.date` 的值）。
   * @returns {void} 结果通过广播和运行态下发，不返回。
   */
  function loadSelectedHistory(dateLabel) {
    try {
      const runtime = getRuntime();
      const { db, db1, db2 } = getDatabases();

      stopPlaybackTimer();
      patchPlaybackState({
        indexArr: [0, 0],
        localData: [],
        localDataBack: [],
        localDataHead: [],
        nowIndex: 0,
      });

      const sitStats = getHistoryStats(db, dateLabel, logger);
      const backStats = isCar(runtime.file) && db1
        ? getHistoryStats(db1, dateLabel, logger)
        : { count: 0, minId: 0, maxId: 0 };
      const headStats = isThreePortFile(runtime.file) && db2
        ? getHistoryStats(db2, dateLabel, logger)
        : { count: 0, minId: 0, maxId: 0 };
      const totalLength = isThreePortFile(runtime.file)
        ? getHistoryLengthFromCounts(sitStats.count, backStats.count, headStats.count)
        : isCar(runtime.file)
          ? getHistoryLengthFromCounts(sitStats.count, backStats.count)
          : getHistoryLengthFromCounts(sitStats.count);
      const maxRows = Math.max(sitStats.count, backStats.count, headStats.count);
      const eager = maxRows <= historyEagerRowLimit;

      const sitRows = createHistoryRowsForPlayback(db, dateLabel, sitStats, eager, logger);
      let backRows = [];
      let headRows = [];
      if (isCar(runtime.file) && db1) {
        backRows = createHistoryRowsForPlayback(db1, dateLabel, backStats, eager, logger);
      }
      if (isThreePortFile(runtime.file) && db2) {
        headRows = createHistoryRowsForPlayback(db2, dateLabel, headStats, eager, logger);
      }

      patchPlaybackState({
        localData: sitRows,
        localDataBack: backRows,
        localDataHead: headRows,
      });

      const historySeries = getHistorySeries({
        sitRows,
        backRows,
        file: runtime.file,
      });
      const length = totalLength || historySeries.length;
      const timeStamp = historySeries.time;
      const detectedInterval = calcDetectedInterval(timeStamp);
      setPlaybackState('indexArr', [0, Math.max(length - 2, 0)]);
      setRuntime({
        detectedInterval,
        historyArr: [0, length],
        interval: detectedInterval,
        length,
        timeStamp,
      });

      broadcastHistorySelectionPayload({
        length,
        time: timeStamp,
        historyTimeArr: timeStamp,
        index: getPlaybackState('nowIndex'),
        pressArr: historySeries.press,
        areaArr: historySeries.area,
        ...buildZeroPlaybackPayload(),
      });
    } catch (error) {
      logger.error('[History] failed to load selected history:', error.message || error);
      patchPlaybackState({
        indexArr: [0, 0],
        localData: [],
        localDataBack: [],
        localDataHead: [],
        nowIndex: 0,
      });
      setRuntime({
        historyArr: [0, 0],
        length: 0,
        timeStamp: [],
      });
      broadcastHistorySelectionPayload({
        length: 0,
        time: [],
        historyTimeArr: [],
        index: 0,
        pressArr: [],
        areaArr: [],
        ...buildZeroPlaybackPayload(),
      });
    }
  }

  /**
   * 查出可回放的历史日期列表并下发给前端，同时把各通道数据清零。
   *
   * `500` 是每路条数上限，没做分页：它是「日期」不是帧，500 天足够一台设备的使用期（真超了看不到
   * 更早日期，属已知上限）。顺带发一份全零数据，理由同 `buildZeroPlaybackPayload`（不能留实时数据
   * 的残影）。`bigBed` 的两处特判（日期只用 `sitRows`、清零长度写死 2048）是它矩阵尺寸与全局
   * `sitTotal` 不一致的历史特例。
   *
   * ⚠️ `isCar` 型号（见 legacyDataUtils，实际是一批多通道型号，名字已名不副实）必须用 `dedupli`
   * 取两路日期的**并集**：坐垫和靠背分库存，某天可能只有一路有数据，取交集会漏掉那些天。
   *
   * ⚠️ 已知冗余（未改）：`car` 分支先发一次 `{timeArr, backData}`，函数末尾又算一次再发，清零也
   * 发两次。前端幂等（后一条覆盖），现象无差别，只是多发两条消息。合并要逐个型号验证前端处理
   * 顺序，属行为变更。
   *
   * @returns {void} 结果通过 publishSystemEvent 下发。
   */
  function publishHistoryDateList() {
    const runtime = getRuntime();
    const { db, db1 } = getDatabases();
    const sitRows = queryHistoryDates(db, 500, 0, logger);
    let backRows = [];
    setRuntime({ sitTimeArr: sitRows });

    if (isCar(runtime.file)) {
      backRows = queryHistoryDates(db1, 500, 0, logger);
      setRuntime({ backTimeArr: backRows });
      const mergedTimeArr = dedupli(sitRows, backRows);

      if (runtime.file === 'car') {
        publishSystemEvent({
          timeArr: mergedTimeArr,
          backData: new Array(backTotal).fill(0),
        });
      }

      if (runtime.file === 'car10') {
        publishSystemEvent({
          timeArr: backRows,
          backData: new Array(100).fill(0),
        });
      }
    }

    const timeArr = isCar(runtime.file) ? dedupli(sitRows, backRows) : sitRows;
    publishSystemEvent({
      timeArr: runtime.file === 'bigBed' ? sitRows : timeArr,
      index: getPlaybackState('nowIndex'),
      sitData: new Array(runtime.file === 'bigBed' ? 2048 : sitTotal).fill(0),
    });

    if (isCar(runtime.file)) {
      publishSystemEvent({
        backData: new Array(backTotal).fill(0),
      });

      if (isThreePortFile(runtime.file)) {
        publishSystemEvent({
          headData: new Array(100).fill(0),
        });
      }
    }
  }

  return {
    buildZeroPlaybackPayload,
    calcDetectedInterval,
    getHistorySeries,
    loadSelectedHistory,
    publishHistoryDateList,
  };
}

module.exports = {
  createHistorySessionService,
};
