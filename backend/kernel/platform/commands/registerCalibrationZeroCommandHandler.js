/**
 * 注册 HTTP 与 legacy WebSocket 共用的 calibration.zero handler。
 *
 * handler 必须在控制命令服务初始化时注册，不能依赖 WebSocket listener 的
 * 启动时机；否则本地 HTTP 服务已开始监听但 openServer 尚未执行时会出现短暂的
 * COMMAND_NOT_SUPPORTED。
 *
 * handler 里那段 payload 构造是**两条协议合流**的地方，也是全链路唯一一处：
 * - 新 HTTP 协议 → `context.commandEnvelope.payload` **原样交给零点服务**。不重建对象是
 *   必须的：`normalizeZeroCommand` 会拒绝任何未知字段（见 zeroCommandService 的四条严格
 *   规则），在这里顺手补一个字段就会让整条命令报 400。
 * - 旧字段协议 → 从扁平的 `resetZero` 现拼一个新协议 payload。两个可选字段都用
 *   `hasOwnProperty` 判存在后才拼进去，**不能无条件写 `displaySystemId: message.xxx`** ——
 *   那会拼出 `{displaySystemId: undefined}`，而零点服务判的是「键在不在」，
 *   于是「没指定展示系统」会被当成「指定了一个空的展示系统」而报错。
 *
 * `when` 也用 `hasOwnProperty` 而不是真值判断：`resetZero: false` 正是「取消归零」这条
 * 合法命令，真值判断会让取消归零永远无人处理。
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
