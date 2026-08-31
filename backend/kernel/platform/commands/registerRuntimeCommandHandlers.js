/**
 * 注册运行时控制命令。
 *
 * 这一组 handler 处理不直接碰串口的控制命令：
 * - 显示参数
 * - 历史回放播放状态
 * - 采集开关和采集频率
 * - CSV 导出和历史删除
 *
 * 它同时服务旧 WebSocket 命令和新 HTTP 控制 API。
 */
const { createRuntimeControlService } = require('./runtimeControlService');

/**
 * 把六个运行时控制 handler 注册到控制命令路由器。
 *
 * 六个 handler 的 `when` 条件是**互相重叠的**：一条命令可以同时带 `flag` 和 `download`，
 * 那它会依次过采集控制和 CSV 导出两个 handler。这是责任链的正常用法（见
 * `controlCommandRouter.handle`），不是漏判 —— 每个 handler 只认它自己那几个字段，
 * 各改各的状态。
 *
 * 只有 `csv-download` 返回 `{stop: true}`，因为它之后不该再有别的处理：旧 WS 分支里
 * 存在一条会重复触发导出的路径，`stop` 是挡住它的手段。其余五个都不 stop，所以顺序在
 * 它们之间不重要 —— 只有 `csv-download` 必须留在最后。
 *
 * 每个 `when` 都是 `!= null` 或严格 `=== true/false`，理由与 runtimeControlService 里
 * 逐字段判断的理由相同：`flag: false`（停止采集）、`play: false`（暂停）、`index: 0`
 * 都是合法值，真值判断会把它们丢掉。
 *
 * @param {{register: Function}} router 控制命令路由器（责任链）。
 * @param {object} deps 依赖；可直接传 `runtimeControlService`，否则用剩余字段现建一个
 *        （测试走前者，server.js 走后者）。
 * @returns {void}
 */
function registerRuntimeCommandHandlers(router, deps) {
  const runtimeControlService = deps.runtimeControlService || createRuntimeControlService(deps);

  // 显示配置只更新运行时状态，不触发数据链路副作用。
  router.register({
    name: 'display-options',
    when: (message) => message.smallBed12BDisplayOptions != null,
    handle: (message) => {
      runtimeControlService.updateDisplayOptions(message.smallBed12BDisplayOptions);
    },
  });

  // 历史回放的播放、暂停、速度和索引控制。
  router.register({
    name: 'history-playback-state',
    when: (message) => (
      message.history != null ||
      message.up != null ||
      message.down != null ||
      message.history === false ||
      message.speed != null ||
      message.play != null ||
      message.index != null
    ),
    handle: (message) => {
      runtimeControlService.updateHistoryPlayback(message);
    },
  });

  // 采集控制：开始采集时重置存储节流时钟，停止时先 flush 入库队列。
  router.register({
    name: 'collection-control',
    when: (message) => (
      message.flag === true ||
      message.flag === false ||
      message.colHZ != null ||
      message.collectOptions != null ||
      message.time != null ||
      message.colName != null
    ),
    handle: (message) => {
      runtimeControlService.updateCollectionControl(message);
    },
  });

  // 运行时参数：串口波特率和算法/平滑开关。
  router.register({
    name: 'runtime-options',
    when: (message) => message.baudRate != null || message.gauss != null,
    handle: (message) => {
      runtimeControlService.updateRuntimeOptions(message);
    },
  });

  // 历史数据删除走独立 service，避免在 WS/HTTP 层拼 SQL。
  router.register({
    name: 'history-maintenance',
    when: (message) => message.delete != null,
    handle: (message) => {
      runtimeControlService.deleteHistory(message.delete);
    },
  });

  // CSV 导出可能耗时，handler 返回 stop 防止旧 WS 分支继续处理同一条命令。
  router.register({
    name: 'csv-download',
    when: (message) => message.download != null,
    handle: (message) => {
      runtimeControlService.exportHistoryCsv(message);
      return { stop: true };
    },
  });
}

module.exports = {
  registerRuntimeCommandHandlers,
};
