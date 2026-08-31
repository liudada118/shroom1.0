/**
 * 注册 HTTP 与 legacy WebSocket 共用的 calibration.zero handler。
 *
 * 必须在控制命令服务初始化时注册、不能依赖 WebSocket listener 的启动时机，否则 HTTP 已开始监听但
 * openServer 未执行的那段窗口里会报 COMMAND_NOT_SUPPORTED。handler 里那段 payload 构造是两条协议
 * 合流处（全链路唯一一处）：新 HTTP 协议把 `commandEnvelope.payload` **原样**交给零点服务，旧字段
 * 协议从扁平的 `resetZero` 现拼一个。
 *
 * ⚠️ 三处都必须用 `hasOwnProperty` 判存在、不能判真值也不能顺手补字段：`resetZero: false` 正是
 * 「取消归零」这条合法命令（真值判断会让它永远无人处理）；`normalizeZeroCommand` 拒绝任何未知字段，
 * 重建对象时多补一个就整条 400；无条件写 `displaySystemId: message.xxx` 会拼出
 * `{displaySystemId: undefined}`，而零点服务判的是「键在不在」—— 于是「没指定展示系统」被当成
 * 「指定了一个空的」而报错。
 *
 * @param {object} controlCommandService 控制命令服务（需要 registerHandler）。
 * @param {object} options 依赖。
 * @param {object} options.zeroCommandService 零点命令服务（需要 handle）。
 * @returns {object} 已注册的 handler。
 * @throws {Error} 两个依赖任一缺失或形状不对（装配期错误，立刻抛）。
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
