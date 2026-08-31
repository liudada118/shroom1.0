/**
 * 注册 HTTP 与 legacy WebSocket 共用的 calibration.zero handler。
 *
 * handler 必须在控制命令服务初始化时注册，不能依赖 WebSocket listener 的
 * 启动时机；否则本地 HTTP 服务已开始监听但 openServer 尚未执行时会出现短暂的
 * COMMAND_NOT_SUPPORTED。
 */
function registerCalibrationZeroCommandHandler(controlCommandService, {
  zeroCommandService,
} = {}) {
  if (!controlCommandService || typeof controlCommandService.registerHandler !== 'function') {
    throw new Error('controlCommandService with registerHandler is required');
  }
  if (!zeroCommandService || typeof zeroCommandService.handle !== 'function') {
    throw new Error('zeroCommandService with handle is required');
  }

  return controlCommandService.registerHandler({
    name: 'calibration-zero',
    when: (message) => Object.prototype.hasOwnProperty.call(message || {}, 'resetZero'),
    handle: (message, context = {}) => {
      const payload = context.commandEnvelope?.type === 'calibration.zero'
        ? context.commandEnvelope.payload
        : {
          enabled: message.resetZero,
          ...(Object.prototype.hasOwnProperty.call(message, 'displaySystemId')
            ? { displaySystemId: message.displaySystemId }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(message, 'channelIds')
            ? { channelIds: message.channelIds }
            : {}),
        };
      return zeroCommandService.handle(payload);
    },
  });
}

module.exports = {
  registerCalibrationZeroCommandHandler,
};
