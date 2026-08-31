/**
 * 历史回放和框选统计服务。
 *
 * 连接层只解析消息；这里承接旧主 WebSocket 里的历史差值、回放跳帧、坐面/靠背框选统计和历史
 * 曲线统计。用法：`createHistoryAnalysisService(deps).handle(message, { clientName })`。
 *
 * ⚠️ **直接读写传进来的 `runtime` 对象**（`runtime.nowIndex = value`），不同于本仓别处注入
 * getter/setter 的做法 —— 它是共享可变状态而非快照，写入会被 server.js 和回放定时器立刻看到，
 * 这正是它能工作的前提。改成访问器要逐个字段确认没有别处依赖写入时机。
 */

function createHistoryAnalysisService({
  SMALL_BED_12B_TYPE,
  TEMP_FULL_BED_TYPE,
  buildTempFullBedPlaybackPayload,
  formatMatrixTotalForFile,
  getHistorySeries,
  getStoredSitData,
  isSmallBedMatrixType,
  logger,
  normalizeHistoryPressureData,
  parseStoredFrameData,
  publishPlaybackFrame,
  publishSystemEvent,
  runtime,
  totalToN,
}) {
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('history analysis runtime is required');
  }

  /**
   * 处理授权有效期内的旧 WebSocket 历史/框选命令。
   *
   * @param {object} message 标准化后的前端消息。
   * @param {object} options 处理选项。
   * @param {string} options.clientName 当前连接标识。
   */
  function handle(message, options = {}) {
    if (runtime.nowDate >= runtime.endDate) return;

    if (message.variety != null) {
      publishHistoryDiffFrames();
    }

    if (runtime.localFlag && message.value != null) {
      const value = Number(message.value);
      logger.debug('received playback index %s from %s', value, options.clientName);
      runtime.nowIndex = value;
      publishPlaybackFrame(value, { includeIndex: false });
    }

    if (message.backIndex != null) {
      publishBackSelectionStats(message.backIndex);
    }

    if (message.sitIndex != null) {
      publishSitSelectionStats(message.sitIndex);
    }

    if (message.indexArr != null) {
      publishHistorySeries(message.indexArr);
    }
  }

  /**
   * 发布「差值帧」：区间末帧减区间首帧，逐点相减。
   *
   * 用途是看一段时间内压力分布变化了多少，所以**结果里会有负值**，前端配色要能处理，不是 bug。
   * 端点取自 `runtime.indexArr`（由 `publishHistorySeries` 写入），没框选过就直接返回。坐垫与
   * 靠背各自独立判有没有数据：单通道型号只有 `localData`，跑靠背分支会炸在 `JSON.parse`。
   * 这里发的是字符串而本文件其他三处发对象，两种都能走，属历史不一致。
   *
   * ⚠️ **没有边界检查也没有 try/catch**：`indexArr` 越界或某帧 `data` 不是合法 JSON 都会直接
   * 抛到 `handle` 的调用方。目前靠「indexArr 只由 publishHistorySeries 写、值来自前端进度条」
   * 这条隐式约束保证不越界 —— 直接构造一条带 `indexArr` 的消息就能触发。
   *
   * @returns {void}
   */
  function publishHistoryDiffFrames() {
    if (!runtime.indexArr) return;

    if (runtime.localDataBack.length) {
      const startArr = JSON.parse(runtime.localDataBack[runtime.indexArr[0]].data);
      const endArr = JSON.parse(runtime.localDataBack[runtime.indexArr[1]].data);
      const newArr = startArr.map((a, index) => endArr[index] - a);
      publishSystemEvent(JSON.stringify({ backData: newArr }));
    }

    if (runtime.localData.length) {
      const startArr = JSON.parse(runtime.localData[runtime.indexArr[0]].data);
      const endArr = JSON.parse(runtime.localData[runtime.indexArr[1]].data);
      const newArr = startArr.map((a, index) => endArr[index] - a);
      publishSystemEvent(JSON.stringify({ sitData: newArr }));
    }
  }

  /**
   * 算靠背框选区域在**整段历史**上的压力和与接触面积两条曲线。
   *
   * `backArr` 是前端鼠标拖拽出的框选矩形 `[x0, x1, y0, y1]`，所以四个 `< 0 ? 0` / `> 31 ? 31`
   * 的钳制是必需的（不钳会取到 undefined、求和变 NaN、曲线整条断掉）。32 是靠背矩阵写死宽度，
   * 换尺寸的型号走 `publishSitSelectionStats`。`> 10` 是「这点算不算被压到」的阈值，决定 area
   * 曲线的绝对值 —— 改了新旧数据不可比，不要随手调。
   *
   * ⚠️ `31 - backArr[3]` / `31 - backArr[2]` 是**纵向翻转**（画布 y 轴向下、矩阵行号向上）。
   * 少了这一步框选区域上下颠倒，且不报错 —— 用户只觉得「统计的不是我框的地方」。
   *
   * ⚠️ `totalToN(total, 1.3)` 的第二个参数**是死的**（`legacyDataUtils.totalToN` 现在直接
   * `return x`），所以靠背压力值就是原始求和。保留是为了将来恢复那个公式。
   *
   * ⚠️ 已知性能问题：`JSON.parse` 在最内层双重循环里，同一帧被反复解析（100×100 框选 × 5 万帧
   * ≈ 5 亿次），而 sqlite3-compat 那层是同步的，整个后端在这期间卡住。提到循环外只需一行，
   * 属行为外的性能修改，未动。`runtime.newback` 当临时变量写在共享 runtime 上（对比 `newsit`
   * 是局部 `const`），目前无害只因为没别的代码读它。
   *
   * @param {number[]} backArr 框选矩形 `[x0, x1, y0, y1]`，可能越界。
   * @returns {void} 结果通过 publishSystemEvent 下发。
   */
  function publishBackSelectionStats(backArr) {
    if (!runtime.localDataBack.length) return;

    runtime.backPressSelect = [];
    runtime.backAreaSelect = [];
    for (let i = 0; i < runtime.localDataBack.length; i++) {
      runtime.newback = [];
      for (
        let x = backArr[0] < 0 ? 0 : backArr[0];
        x <= (backArr[1] > 31 ? 31 : backArr[1]);
        x++
      ) {
        for (
          let y = 31 - backArr[3] < 0 ? 0 : 31 - backArr[3];
          y <= (31 - backArr[2] > 31 ? 31 : 31 - backArr[2]);
          y++
        ) {
          runtime.newback.push(JSON.parse(runtime.localDataBack[i].data)[x * 32 + y]);
        }
      }

      const total = runtime.newback.reduce((a, b) => a + b, 0);
      const area = runtime.newback.filter((a) => a > 10).length;
      runtime.backPressSelect.push(totalToN(total, 1.3));
      runtime.backAreaSelect.push(area);
    }

    publishSystemEvent({
      pressArr: runtime.backPressSelect,
      areaArr: runtime.backAreaSelect,
      length: runtime.length,
      time: runtime.timeStamp,
      index: runtime.nowIndex,
    });
  }

  /**
   * 算坐面框选区域在整段历史上的压力和与接触面积两条曲线。
   *
   * 因存储格式不同分两条取数路径：床垫族（`isSmallBedMatrixType` / `smallBed12B` /
   * `tempFullBed`）存的不是裸数组，各走专门的还原函数，宽度从帧里读（`tempFullBed` 写死 15，
   * 其余读 `matrixWidth` 兜底 32）；其他型号 `data` 就是 JSON 数组、宽度固定 32。压力值走
   * `formatMatrixTotalForFile` 而不是 `totalToN`；`> 10` 面积阈值同靠背版。
   *
   * ⚠️ **两条路径的 x/y 循环顺序是相反的**（床垫族 `x = sitArr[0..1]`，另一条
   * `x = sitArr[2..3]`）。不是笔误 —— 两族存储行列序本来就不同，交换正是为了让同一个框选矩形
   * 在两族上都框到用户看到的那块。改任何一边都让那一族统计错位，且不报错，只是数字不对。
   *
   * ⚠️ **这边没有边界钳制**（靠背版钳了）：越界取到 undefined、求和变 NaN、曲线断掉。是遗漏而
   * 非设计，但补上属行为变更。非床垫族那一支还有和靠背版一样的内层循环反复 `JSON.parse`。
   *
   * @param {number[]} sitArr 框选矩形，四个分量的含义随上面两条路径而不同。
   * @returns {void} 结果通过 publishSystemEvent 下发。
   */
  function publishSitSelectionStats(sitArr) {
    runtime.sitPressSelect = [];
    runtime.sitAreaSelect = [];
    for (let i = 0; i < runtime.localData.length; i++) {
      const newsit = [];

      if (isSmallBedMatrixType(runtime.file) || runtime.file === SMALL_BED_12B_TYPE || runtime.file === TEMP_FULL_BED_TYPE) {
        const storedSitData = runtime.file === TEMP_FULL_BED_TYPE
          ? buildTempFullBedPlaybackPayload(runtime.localData[i]).sitData
          : runtime.file === SMALL_BED_12B_TYPE
            ? normalizeHistoryPressureData(runtime.localData[i], runtime.file)
            : getStoredSitData(runtime.localData[i]);
        const storedFrame = parseStoredFrameData(runtime.localData[i]);
        const storedWidth = runtime.file === TEMP_FULL_BED_TYPE ? 15 : Number(storedFrame?.matrixWidth) || 32;
        for (let x = sitArr[0]; x < sitArr[1]; x++) {
          for (let y = sitArr[2]; y < sitArr[3]; y++) {
            newsit.push(storedSitData[x * storedWidth + y]);
          }
        }
      } else {
        for (let x = sitArr[2]; x < sitArr[3]; x++) {
          for (let y = sitArr[0]; y < sitArr[1]; y++) {
            newsit.push(JSON.parse(runtime.localData[i].data)[x * 32 + y]);
          }
        }
      }

      const total = newsit.reduce((a, b) => a + b, 0);
      const area = newsit.filter((a) => a > 10).length;
      runtime.sitPressSelect.push(formatMatrixTotalForFile(total, runtime.file));
      runtime.sitAreaSelect.push(area);
    }

    publishSystemEvent({
      length: runtime.length,
      time: runtime.timeStamp,
      index: runtime.nowIndex,
      pressArr: runtime.sitPressSelect,
      areaArr: runtime.sitAreaSelect,
    });
  }

  /**
   * 用户在进度条上改了区间：重算该区间的两条曲线并下发。
   *
   * 与两个框选统计的区别：**这里按时间截取、全矩阵求和**，那两个按空间截取、全时段。
   *
   * ⚠️ `historyArr` 与 `indexArr` 写成同一个值但用途不同：`historyArr` 给 server.js 的回放推帧
   * 读；`indexArr` 是 `publishHistoryDiffFrames` 取差值端点的唯一来源 —— 即**用户必须先框选过
   * 区间，差值帧功能才有端点可用**，这是两个功能之间的隐式耦合。两处写入顺序无依赖。
   *
   * ⚠️ 不校验范围与顺序：反序或越界会让曲线为空，或让后续差值帧抛错。
   *
   * @param {number[]} indexArr 时间区间 `[起始下标, 结束下标]`。
   * @returns {void} 结果通过 publishSystemEvent 下发。
   */
  function publishHistorySeries(indexArr) {
    runtime.historyArr = indexArr;
    const historySeries = getHistorySeries({
      sitRows: runtime.localData,
      backRows: runtime.localDataBack,
      start: indexArr[0],
      end: indexArr[1],
      file: runtime.file,
    });

    publishSystemEvent({
      pressArr: historySeries.press,
      areaArr: historySeries.area,
    });

    runtime.indexArr = indexArr;
  }

  return {
    handle,
  };
}

module.exports = {
  createHistoryAnalysisService,
};
