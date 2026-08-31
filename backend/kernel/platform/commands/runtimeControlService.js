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
   * 形状是「逐字段判存在、攒一个 patch、最后一次性 `setRuntime`」—— 攒起来一次写，中间状态才不会
   * 被别的模块看到（`setRuntime` 会走整条 patch 链、可能触发 setter 副作用）。定时器启停**不进
   * patch**（它是副作用不是状态）：关历史一定停，改倍速按**当前** `playFlag` 决定重启还是停（重启
   * 是为了让新 interval 生效），改播放状态按新值启停。`Number()` 只套 `up`/`down`/`speed`（可能从
   * 输入框来），`index` 由滑块算出本来就是数字。
   *
   * ⚠️ 判断一律用 `!= null` 而非真值判断：`play: false`（暂停）、`index: 0`（跳首帧）、`up: 0` 都
   * 是合法值，真值判断会把暂停命令整条丢掉。唯一例外是 `history === false` 那支要的正是这一个值。
   *
   * ⚠️ 倍速是相对「**这份历史数据原本的速度**」：`detectedInterval` 是实测帧间隔而非配置值，所以
   * 换一份采集频率不同的数据，同一个倍速的实际播放速度就不同（有意如此，1x 永远等于原速）。
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
   * 两支都用严格 `=== true`/`=== false`：`flag` 缺失时两支都不进（那表示这条命令只改频率之类），
   * 真值判断做不到这个三态。`colHZ` 与 `collectOptions` 互相同步（任一单独出现都会重算另一个），
   * 冲突时以 `collectOptions` 为准 —— 下游存储时钟同时读这两个字段，不能不一致。
   *
   * ⚠️ 两处副作用的时机是要点，顺序不能改：开始采集要**先** `resetCollectionStorageClock()`
   * （不重置的话时钟还带着上次结束的时间戳，新采集头几帧会被判成「没到采样点」而丢掉）；停止采集
   * 要**先 flush 队列再置 flag 为 false**（入库是批量攒的，先置 flag 会让最后一批帧永远等不到下次
   * 触发 —— 现象是每次采集都丢结尾几百毫秒）。
   *
   * ⚠️ `saveTime` 被写两次、后面的 `colName` **覆盖前面的 `time`**，不是笔误：这个字段同时承担
   * 「采集起始时间」和「采集名称」（它最终是历史库的会话标识），新前端传 `colName`、旧的传 `time`。
   * 拆成两个字段就得同时改历史库会话键，属历史数据兼容性改动。
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
