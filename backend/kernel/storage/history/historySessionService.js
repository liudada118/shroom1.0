/**
 * 创建历史回放会话服务。
 *
 * 该服务承接历史日期列表、历史数据加载、趋势曲线和切换历史时的空白帧 payload。
 * server.js 只提供数据库、运行态 getter/setter 和推送能力。
 *
 * 依赖全部由 server.js 注入而不是本模块自己 import：历史回放要同时碰数据库、回放状态、
 * 运行态和 WebSocket 广播，直接 import 会让这个模块变成 server.js 的第二个入口，
 * 也就没法单独测试。**注入的都是函数**（包括读运行态的 `getRuntime`），
 * 所以本模块不持有任何快照 —— 切换型号/日期时行为跟着变，不需要重建。
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
   * 为什么必须发这个而不是什么都不发：前端渲染器持有上一次的帧数据，不发新帧的话
   * 切换日期后画面上仍是**上一个日期的最后一帧**，用户会以为新日期的数据长这样。
   * 发一帧全零等于显式说「现在没有数据」。
   *
   * 零帧的形状必须与真实帧一致（数组长度按型号算），所以要现取 runtime 的型号 ——
   * 长度不对的话渲染器会按错误尺寸解读，出现花屏而不是空白。
   *
   * 每次都现调 `getRuntime()`：切换型号时这份 payload 的形状要跟着变。
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
   * 为什么要推：回放速度必须与录制速度一致，否则同一段数据在不同型号下播放快慢不同。
   * 而采样间隔不存在于数据库里 —— 它取决于录制时的传感器型号和串口速率，
   * 那些信息当时没存。所以只能从相邻时间戳的差值倒推。
   *
   * 三条取值策略：
   * - **取中位数而不是平均值。** 历史数据里必然有跳变（串口卡顿、进程被挂起、
   *   一天跨零点），平均值会被几个大间隔拉偏，中位数不会。
   * - **只采前 20 个差值。** 采样间隔在一次录制里是固定的，20 个足够定出中位数；
   *   几 GB 的库里全量遍历会阻塞事件循环（见 sqlite3-compat 的说明，这一层是同步的）。
   * - **丢掉 `<= 0` 和 `>= 5000ms` 的差值。** 前者是时间戳乱序或重复，后者是录制中断
   *   （用户暂停过、程序崩过）。把 30 秒的中断算进去会让回放慢到不可用。
   *   5000 是经验阈值：本仓最慢的采样也远快于 5 秒一帧。
   *
   * 推不出来时回落到 `runtime.timeNum`（当前型号的标称间隔）—— 那是次优但可用的猜测，
   * 比回一个 0（会让定时器变成忙循环）安全得多。下限 `Math.max(1, ...)` 同理。
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
   * **第一件事是 `stopPlaybackTimer()`。** 不停的话旧定时器会继续按旧的 `localData`
   * 下标推帧，而下面几行马上就把 `localData` 换掉了 —— 现象是切换日期瞬间闪出几帧
   * 越界/错位的数据。
   *
   * **一到三路数据库，按型号决定读几路：** `db` 是坐垫（永远读），`db1` 是靠背
   * （仅 `isCar`），`db2` 是头部（仅 `isThreePortFile`）。判断放在这里而不是让下游
   * 自己判断，是因为多读一路的代价是一次几 GB 表上的 COUNT 查询。
   *
   * **eager / lazy 的分界是 `historyEagerRowLimit`（默认 5 万行）。** 超过就换成
   * `createLazyHistoryRows` 返回的 Proxy —— 那个代理按下标现查数据库并带 LRU 缓存。
   * 这一条是必需的：历史库单表能到几 GB（`smallBed12B.db` 4.36 GB），
   * 全量读进内存会直接 OOM。代价是拖动进度条时会有零星的磁盘查询延迟。
   * 阈值取 `max(三路行数)` 而不是总和：三路是并行的，内存峰值由最大的一路决定。
   *
   * **长度有两个来源，优先用 `totalLength`**（来自各路 COUNT 的换算）。
   * `historySeries.length` 只在前者为 0 时兜底 —— 因为在 lazy 模式下曲线是按代理
   * 遍历算的，可能只覆盖了一部分。长度错了的直接后果是进度条刻度与实际帧数对不上。
   *
   * `indexArr` 设成 `[0, length - 2]`：末位留 2 的余量是回放推帧时要读「下一帧」，
   * 顶到最后一帧会越界。`Math.max(..., 0)` 防止空数据时算出负数。
   *
   * **catch 里不是简单记日志，而是把状态彻底清成空并广播一份空 payload。** 理由与
   * `buildZeroPlaybackPayload` 相同：加载失败时如果什么都不做，界面上留着上一个日期的
   * 数据，用户完全无法察觉这次切换失败了。清空 + 广播让失败可见。
   * 这里刻意不再抛出 —— 加载历史失败不该让后端进程挂掉。
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
   * `500` 是硬编码的条数上限（每路各 500 天）。没做分页，理由是它是「日期」而不是帧 ——
   * 500 天足够覆盖一台设备的实际使用期；真超了会看不到更早的日期，属于已知上限。
   *
   * 每次下发日期列表都**顺带发一份全零数据**（`sitData`/`backData`/`headData`），
   * 与 `buildZeroPlaybackPayload` 同一个理由：进入历史模式时界面上不能留着实时数据的残影。
   *
   * `isCar` 的传感器（见 legacyDataUtils，实际上是一批多通道型号，名字已经名不副实）
   * 要把两路日期用 `dedupli` 并集去重 —— 因为坐垫和靠背是分库存的，某一天可能只有一路
   * 有数据，取交集会漏掉那些天。
   *
   * `bigBed` 的两处特判（日期只用 `sitRows`、清零长度写死 2048 而不是 `sitTotal`）
   * 是这个型号的矩阵尺寸与全局 `sitTotal` 不一致导致的历史特例。
   *
   * ⚠️ **已知的冗余（保留原状，未改）：** `car` 分支先发一次
   * `{timeArr: mergedTimeArr, backData}`，函数末尾又用同样的方式算出 `timeArr` 再发一次，
   * 并且 `backData` 清零也发了两次。前端是幂等处理的（后一条覆盖前一条同名字段），
   * 所以现象上无差别，只是每次切到历史模式多发两条消息。合并它需要逐个型号验证前端的
   * 处理顺序，属于行为变更，不在注释任务范围内。
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
