/**
 * 运行时控制应用服务。
 * 这里承接显示配置、历史回放、采集控制、运行参数、历史维护和 CSV 导出等业务动作。
 */
function createRuntimeControlService(deps) {
  const {
    csvDownloadService,
    getRuntime,
    historyMaintenanceService,
    normalizeCollectFrequency,
    normalizeCollectOptions,
    normalizeSmallBed12BDisplayOptions,
    resetCollectionStorageClock,
    flushCollectionInsertQueues,
    startPlaybackTimer,
    stopPlaybackTimer,
    setRuntime,
  } = deps;

  /**
   * 更新 smallBed12B 的展示选项（矩阵模式 / 采样点）。
   *
   * 这个字段名带着具体型号，是**历史包袱而不是设计**：它只影响 smallBed12B 那一路的降采样
   * 展示。新传感器的展示选项应该走 display system manifest，而不是往这里加第二个型号字段。
   *
   * 一律先 `normalize` 再写：这个值来自前端下拉框，而下游是按它的两个键直接算矩阵尺寸的，
   * 写进一个形状不对的对象会让展示尺寸错乱且难以追到源头。
   *
   * @param {*} options 前端传入的展示选项。
   * @returns {void}
   */
  function updateDisplayOptions(options) {
    setRuntime({
      smallBed12BDisplayOptions: normalizeSmallBed12BDisplayOptions(options),
    });
  }

  /**
   * 处理历史回放控制命令（开关历史模式、播放/暂停、倍速、跳帧、上下阈值）。
   *
   * 全函数是「**逐字段判存在、攒一个 patch、最后一次性 setRuntime**」的形状。攒起来一次写
   * 而不是逐字段写，是因为 `setRuntime` 会走整条 patch 链（可能触发 setter 副作用），
   * 一条命令写一次才不会让中间状态被别的模块看到。
   *
   * 所有判断都是 `!= null`（而非真值判断）：`play: false`（暂停）、`index: 0`（跳到首帧）、
   * `up: 0` 都是合法值，用真值判断会把暂停命令丢掉。
   * 唯一的例外是 `history === false` 那一支 —— 它要的正是「显式关掉历史模式」这一个值，
   * 所以严格比较。注意它与上面的 `if (message.history != null)` **会同时命中**，后者把
   * `next.history` 再写一遍 false（幂等），真正的作用是顺带 `stopPlaybackTimer()`。
   *
   * 定时器的启停**不放进 patch**，而是就地调用：它是副作用而不是状态，`setRuntime` 那条
   * 路径不负责。三处启停的规则是「谁改了播放相关的东西，谁负责让定时器与新状态一致」：
   * - 关历史模式 → 一定停。
   * - 改倍速 → 按**当前** `playFlag` 决定重启还是停（重启是为了让新 interval 生效）。
   * - 改播放状态 → 按新值启停。
   *
   * ⚠️ `interval` 的算法有两个坑，改之前要知道：
   * - `parseInt(runtime.detectedInterval / speed)` **没带基数**，而且传的是数字而非字符串 ——
   *   它靠隐式转字符串工作。`speed` 很大时商会小于 1e-7，转成字符串是 `"1e-7"`，
   *   `parseInt` 会得到 1（而不是 0），`Math.max(1, ...)` 恰好也兜到 1，所以现象上没问题。
   * - `detectedInterval` 是**实测的**帧间隔（不是配置值），所以倍速是相对「这份历史数据
   *   原本的速度」，而不是相对某个固定帧率。换一份采集频率不同的历史数据，同一个倍速的
   *   实际播放速度就不同 —— 这是有意的（1x 永远等于原速）。
   *
   * `Number()` 只套在 `up`/`down`/`speed` 上，`index` 不套：阈值和倍速可能从输入框来（字符串），
   * 而 `index` 由前端滑块算出，本来就是数字。
   *
   * @param {object} message 旧字段形态的命令载荷。
   * @returns {void}
   */
  function updateHistoryPlayback(message) {
    const runtime = getRuntime();
    const next = {};
    if (message.history != null) next.history = message.history;
    if (message.up != null) next.up = Number(message.up);
    if (message.down != null) next.down = Number(message.down);
    if (message.history === false) {
      next.history = false;
      stopPlaybackTimer();
    }
    if (message.speed != null) {
      const speed = Number(message.speed);
      next.interval = Math.max(1, parseInt(runtime.detectedInterval / speed));
      if (runtime.playFlag) startPlaybackTimer();
      else stopPlaybackTimer();
    }
    if (message.play != null) {
      next.playFlag = message.play;
      if (message.play) startPlaybackTimer();
      else stopPlaybackTimer();
    }
    if (message.index != null) next.nowIndex = message.index;
    setRuntime(next);
  }

  /**
   * 处理采集控制命令（开始/停止采集、采集名、频率、采集选项）。
   *
   * **两处副作用的时机是这个函数的要点，顺序不能改：**
   * - `flag === true`（开始采集）→ 先 `resetCollectionStorageClock()`。不重置的话，存储
   *   时钟还带着上次采集结束时的时间戳，新采集的头几帧会被判成「还没到下一个采样点」而
   *   丢掉。
   * - `flag === false`（停止采集）→ **先 `flushCollectionInsertQueues()` 再把 flag 置 false**。
   *   入库是批量攒着写的，先置 flag 会让攒在队列里的最后一批帧永远等不到下一次触发 ——
   *   现象是「每次采集都丢结尾几百毫秒」。
   *
   * 两支都用严格 `=== true` / `=== false`：`flag` 缺失时两支都不能进（那表示这条命令不管
   * 采集开关，只改频率之类），真值判断做不到这个三态。
   *
   * ⚠️ `saveTime` 被写了两次：`message.time` 先写，`message.colName` **后写会覆盖它**。
   * 这不是笔误 —— 这个字段同时承担「采集起始时间」和「采集名称」两个用途（它最终作为历史
   * 库里的会话标识），前端新版本传 `colName`，旧版本传 `time`。两个都传时以名称为准。
   * 想拆成两个字段就得同时改历史库的会话键，属于历史数据兼容性改动。
   *
   * ⚠️ **`colHZ` 与 `collectOptions` 同时出现时，后者赢**：`collectOptions` 那一支会把
   * `next.colHZ` 覆盖成它归一后的 `frequencyHz`。这是刻意的 —— `collectOptions` 是完整
   * 配置对象，`colHZ` 是它的旧扁平字段，两者冲突时以完整对象为准。注意它读的是
   * `next.colHZ ?? runtime.colHZ`（先用本次命令里的新频率兜底，没有才用当前值），
   * 用 `??` 而不是 `||` 所以 `colHZ: 0` 不会被跳过（会由 normalize 兜到合法下限）。
   *
   * 反过来 `colHZ` 单独出现时也会**重算一份 collectOptions**（把新频率合进当前配置），
   * 这样两个字段永远不会不一致 —— 下游的存储时钟同时读它们。
   *
   * @param {object} message 旧字段形态的命令载荷。
   * @returns {void}
   */
  function updateCollectionControl(message) {
    const runtime = getRuntime();
    const next = {};
    if (message.time != null) next.saveTime = message.time;
    if (message.colName != null) next.saveTime = message.colName;
    if (message.flag === true) {
      next.flag = true;
      resetCollectionStorageClock();
    } else if (message.flag === false) {
      flushCollectionInsertQueues();
      next.flag = false;
    }
    if (message.colHZ != null) {
      next.colHZ = normalizeCollectFrequency(message.colHZ, runtime.colHZ);
      next.collectOptions = normalizeCollectOptions({
        ...runtime.collectOptions,
        frequencyHz: next.colHZ,
      }, next.colHZ);
    }
    if (message.collectOptions != null) {
      next.collectOptions = normalizeCollectOptions(message.collectOptions, next.colHZ ?? runtime.colHZ);
      next.colHZ = next.collectOptions.frequencyHz;
    }
    setRuntime(next);
  }

  /**
   * 更新运行参数（波特率、高斯平滑开关）。
   *
   * ⚠️ **改 `baudRate` 只改状态，不重开串口。** 已经打开的端口仍按旧波特率工作，新值要到
   * 下一次开口才生效。这是刻意的：串口重连会中断正在进行的采集。前端的交互流程是「先关
   * 串口 → 改波特率 → 再开」。
   *
   * `Number()` 只套 `baudRate`（它可能从输入框来），`gauss` 原样存 —— 它的形态由展示层
   * 定义（可能是布尔也可能是半径参数），这一层不该替它决定。
   *
   * ⚠️ 波特率这里**不校验范围**。非法值会在串口打开时由串口层报错，而不是在这里拦下。
   *
   * @param {object} message 旧字段形态的命令载荷。
   * @returns {void}
   */
  function updateRuntimeOptions(message) {
    const next = {};
    if (message.baudRate != null) next.baudRate = Number(message.baudRate);
    if (message.gauss != null) next.gauss = message.gauss;
    setRuntime(next);
  }

  /**
   * 删除某一天的历史数据。
   *
   * ⚠️ **这是不可恢复的数据删除**，没有二次确认也没有回收站 —— 确认责任在前端。整条链路
   * 只是转发，真正的删除逻辑（按日期定位表/文件、事务边界）在
   * `storage/history` 的维护服务里，要改删除行为请改那里。
   *
   * 本层留这个空转发是为了让「命令 → 应用服务」的映射保持完整：命令路由只认识应用服务，
   * 不直接依赖存储层。
   *
   * @param {string} dateLabel 日期标签（历史会话标识）。
   * @returns {void}
   */
  function deleteHistory(dateLabel) {
    historyMaintenanceService.deleteHistory(dateLabel);
  }

  /**
   * 导出某一天的历史数据为 CSV。
   *
   * 开头那句 `setRuntime({ smoothValue: 0 })` 的**原意**是「导出前关掉展示平滑」——
   * 导出该给原始测量值，带上展示用的平滑会让 CSV 与设备实际读数不符。
   *
   * ⚠️ **但它现在是一次空写。** `smoothValue` 在 `server.js` 里只有声明（初值 0）和 setter
   * 两处，全后端**没有任何读点**（导出链路也不读它），所以这行既不影响导出内容也不影响
   * 画面。留着它不删是因为它标着一个仍然成立的意图：如果哪天导出链路真的接上平滑参数，
   * 这里就是该关掉它的地方。**别把它当成「导出会关平滑」的证据来用。**
   *
   * 顺带一个真实的行为约定：它只关不恢复。真要实现「导出期间临时关掉」，得在导出完成回调
   * 里恢复，而导出是异步的 —— 那是一处真实改动，不是顺手修。
   *
   * `downloadOptions` 兜成 `{}`：导出服务按键取值，缺整个对象会让它读 undefined 的属性。
   *
   * @param {{download: string, downloadOptions?: object}} message 旧字段形态的命令载荷。
   * @returns {void}
   */
  function exportHistoryCsv(message) {
    setRuntime({ smoothValue: 0 });
    csvDownloadService.exportHistoryCsv({
      date: message.download,
      downloadOptions: message.downloadOptions || {},
    });
  }

  return {
    deleteHistory,
    exportHistoryCsv,
    updateCollectionControl,
    updateDisplayOptions,
    updateHistoryPlayback,
    updateRuntimeOptions,
  };
}

module.exports = {
  createRuntimeControlService,
};
