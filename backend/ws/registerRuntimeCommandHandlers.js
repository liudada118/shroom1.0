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
const { createRuntimeControlService } = require('../application/runtimeControlService');

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
