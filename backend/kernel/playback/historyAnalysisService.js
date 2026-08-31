/**
 * 历史回放和框选统计服务。
 *
 * 连接层只负责解析消息；这里承接旧主 WebSocket 中仍保留的历史差值、
 * 回放跳帧、坐面/靠背框选统计和历史曲线统计逻辑。
 *
 * ⚠️ **本模块直接读写传进来的 `runtime` 对象**（`runtime.nowIndex = value` 这类），
 * 与本仓其他模块「注入 getter/setter」的做法不同。这是旧主 WebSocket 处理逻辑原样搬出来的
 * 结果 —— 它当时就是在 server.js 的闭包里直接改那些 `let`。搬的时候保持直接写，
 * 是为了让搬迁本身零行为变化；改成访问器需要逐个字段确认没有别处依赖写入时机。
 *
 * 所以这里的 `runtime` 是**共享可变状态**，不是快照：本模块的写入会被 server.js 和
 * 回放定时器立刻看到，这正是它能工作的前提。
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
   * 用途是看一段时间内压力分布**变化了多少**（例如躺了半小时后哪里被压出来了），
   * 所以结果里会有负值 —— 前端的配色要能处理负数，这不是 bug。
   *
   * 区间端点取自 `runtime.indexArr`，也就是用户在进度条上框选的那两个下标
   * （由 `publishHistorySeries` 写入）。没框选过就直接返回。
   *
   * 坐垫与靠背各自独立判断有没有数据：单通道型号只有 `localData`，
   * 对它跑靠背分支会在 `localDataBack[...]` 上取到 undefined 然后炸在 `JSON.parse`。
   *
   * ⚠️ **没有边界检查也没有 try/catch。** `indexArr` 越界或某帧的 `data` 不是合法 JSON
   * 都会直接抛出，冒泡到 `handle` 的调用方（旧 WebSocket 消息处理）。
   * 目前靠「indexArr 只由 publishHistorySeries 写入、而它的值来自前端进度条」这条链
   * 保证不越界 —— 这是个隐式约束，直接构造一条带 `indexArr` 的消息就能触发。
   *
   * 这里发的是 `JSON.stringify` 后的**字符串**，而本文件其他三处发的是对象。
   * 两种都能走（`publishSystemEvent` → `parseOutboundSystemEvent` 会解析字符串），
   * 属于历史不一致，不是有意区分。
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
   * 输入 `backArr` 是前端给的框选矩形 `[x0, x1, y0, y1]`，来自鼠标拖拽，所以：
   * - 四个 `< 0 ? 0` / `> 31 ? 31` 是**必需的钳制**：用户拖出画布边界是常态，
   *   不钳会取到 undefined 然后让求和变成 NaN，曲线整条断掉。
   * - `31 - backArr[3]` / `31 - backArr[2]` 是**纵向翻转**：前端画布的 y 轴向下，
   *   矩阵的行号向上。少了这一步框选区域会上下颠倒 —— 而且**不会报错**，
   *   用户只会觉得「统计的不是我框的地方」。
   *
   * 32 是靠背矩阵的写死宽度（`x * 32 + y`），这一路只服务 32×32 的靠背，
   * 换尺寸的型号走的是 `publishSitSelectionStats` 的分支。
   *
   * `> 10` 是「这个点算不算被压到」的阈值，写死在两个统计函数里。它决定 area 曲线的绝对
   * 值，改了会让新旧数据不可比 —— 属于会影响历史数据解读的常量，不要随手调。
   *
   * ⚠️ **每帧都 `JSON.parse(localDataBack[i].data)` 一次，而且是在最内层双重循环里。**
   * 一个 100×100 的框选在 5 万帧上会解析 5 亿次 —— 同一帧被反复解析。
   * 这是本函数的主要耗时来源，且因为 sqlite3-compat 那层是同步的，
   * 整个后端在这期间会卡住。提到循环外只需要一行，但属于行为外的性能修改，未动。
   *
   * ⚠️ `runtime.newback` 被当**临时变量**用（每帧重置），写在共享的 runtime 对象上。
   * 对比 `publishSitSelectionStats` 里同样用途的 `newsit` 是个局部 `const` ——
   * 那才是对的写法。这里之所以没问题，只是因为没有别的代码读 `runtime.newback`。
   *
   * ⚠️ `totalToN(total, 1.3)` 的第二个参数**是死的**：`legacyDataUtils.totalToN` 现在
   * 直接 `return x`，整个换算公式被注释掉了。所以 1.3 这个系数不生效，
   * 靠背压力值就是原始求和。删掉它需要确认没人依赖将来恢复那个公式，故保留。
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
   * **分两条完全不同的取数路径，因为存储格式不同：**
   * - 床垫族（`isSmallBedMatrixType` / `smallBed12B` / `tempFullBed`）—— 存的不是裸数组，
   *   要各自走专门的还原函数（`buildTempFullBedPlaybackPayload` / `normalizeHistoryPressureData`
   *   / `getStoredSitData`），矩阵宽度也从帧里读（`tempFullBed` 写死 15，其余读
   *   `matrixWidth`，兜底 32）。
   * - 其他型号 —— `data` 就是一个 JSON 数组，宽度固定 32。
   *
   * ⚠️ **两条路径的 x/y 循环顺序是相反的**（床垫族 `x = sitArr[0..1]` 配
   * `y = sitArr[2..3]`，另一条 `x = sitArr[2..3]` 配 `y = sitArr[0..1]`）。
   * 这不是笔误 —— 两族的存储行列序本来就不同，交换回来正是为了让**同一个框选矩形**
   * 在两族上都框到用户看到的那块区域。改任何一边都会让那一族的框选统计错位，
   * 而且不会报错，只是数字不对。
   *
   * 与靠背版的另外两处不同：
   * - **没有边界钳制**。越界会取到 undefined，求和变 NaN，曲线断掉。靠背那边钳了，
   *   这边没有 —— 是遗漏而非设计，但补上属于行为变更（会把「断掉」变成「按边缘统计」）。
   * - 压力值走 `formatMatrixTotalForFile`（按型号换算）而不是 `totalToN`。
   *
   * `> 10` 面积阈值与靠背版相同，同样是影响历史数据可比性的常量。
   *
   * ⚠️ 与靠背版同样的性能问题：非床垫族那一支在最内层循环里反复 `JSON.parse` 同一帧。
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
   * 与两个框选统计的区别是**这里是按时间截取、全矩阵求和**，那两个是按空间截取、全时段。
   *
   * `runtime.historyArr` 与 `runtime.indexArr` 都被写成同一个值，用途不同：
   * - `historyArr` 给别处（server.js 的回放推帧）读，表示「当前关注的时间区间」。
   * - `indexArr` 是 `publishHistoryDiffFrames` 取差值端点的来源 —— 也就是说，
   *   **用户必须先框选过区间，差值帧功能才有端点可用**。这是两个功能之间的隐式耦合。
   *
   * `indexArr` 在函数开头写 `historyArr`、结尾写 `indexArr`（中间隔着一次计算），
   * 顺序上没有依赖，是历史写法。
   *
   * ⚠️ 不校验 `indexArr` 的范围与顺序。传进来的是前端进度条的值，
   * 反序或越界会让曲线为空或让后续差值帧抛错（见 publishHistoryDiffFrames）。
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
