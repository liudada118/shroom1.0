const {
  createDisplaySystemFrameProcessor,
} = require('./displaySystemFrameProcessorFactory');
const {
  getRuntimeMode,
} = require('./displaySystemRuntimePolicy');

function resolveParserChannel(serialParserManager, parserChannel) {
  const role = parserChannel?.role || parserChannel;
  if (!role) return null;

  if (parserChannel?.protocol && parserChannel?.id && serialParserManager?.registerChannel) {
    return serialParserManager.registerChannel(parserChannel.id, parserChannel.protocol);
  }

  const channels = serialParserManager?.channels || {};
  const direct = Object.values(channels).find((channel) => channel === role);
  if (direct) return direct;

  const key = String(role).replace(/[-\s]/g, '_').toUpperCase();
  return channels[key] || null;
}

function resolveOutputPublisher(frameOutputPipeline, serialRole) {
  if (!frameOutputPipeline) return null;
  if (serialRole === 'sit') return frameOutputPipeline.publishSit;
  if (serialRole === 'back') return frameOutputPipeline.publishBack;
  if (serialRole === 'head') return frameOutputPipeline.publishHead;
  return null;
}

/**
 * 把 Display System runtime channel 注册计划绑定成可执行记录。
 *
 * 该函数不打开串口；它只解析 serial role、parser channel、JSON frame processor
 * 和 frameOutputPipeline 输出函数，真实串口生命周期仍由 serialManager 控制。
 *
 * @param {object} options 绑定参数。
 * @param {object} options.runtimeChannelRegistry 运行时通道注册表。
 * @param {object} options.serialManager 串口管理器。
 * @param {object} options.serialParserManager parser 管理器。
 * @param {object} options.frameOutputPipeline 实时帧输出管线。
 * @param {Function} [options.createFrameProcessor] 帧处理器工厂。
 * @returns {object[]} 绑定记录。
 */
function bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry,
  serialManager,
  serialParserManager,
  frameOutputPipeline,
  createFrameProcessor = createDisplaySystemFrameProcessor,
}) {
  const channels = runtimeChannelRegistry?.list?.() || [];

  return channels.map((channel) => {
    const serialStatus = serialManager?.getStatus?.(channel.serialRole) || null;
    const runtimeMode = channel.runtimeMode || channel.metadata?.runtimeMode || null;
    const bindingBase = {
      id: channel.id,
      displaySystemId: channel.displaySystemId,
      serialRole: channel.serialRole,
      sensorType: channel.sensor?.type || channel.parserChannel?.sensorType || null,
      runtimeMode,
      metadata: { ...(channel.metadata || {}) },
      runtimeChannel: channel,
      serialStatus,
      outputChannel: channel.serialRole,
    };

    try {
      const parserChannel = resolveParserChannel(serialParserManager, channel.parserChannel);
      const outputPublisher = resolveOutputPublisher(frameOutputPipeline, channel.serialRole);
      const frameProcessor = createFrameProcessor({ runtimeChannel: channel });

      function handleFrame(frame) {
        const processedFrame = frameProcessor.processFrame(frame);
        if (getRuntimeMode({ runtimeMode }) === 'shadow') {
          return {
            published: false,
            processedFrame,
            reason: 'runtime mode shadow does not publish output',
          };
        }
        if (!outputPublisher) {
          return {
            published: false,
            processedFrame,
            reason: 'output publisher is not available',
          };
        }
        return {
          published: true,
          processedFrame,
          output: outputPublisher(processedFrame),
        };
      }

      return {
        ...bindingBase,
        parserChannel,
        status: parserChannel && outputPublisher ? 'bound' : 'registered',
        error: null,
        handleFrame,
      };
    } catch (error) {
      const reason = error?.message || String(error);
      return {
        ...bindingBase,
        parserChannel: null,
        status: 'error',
        error: reason,
        handleFrame: () => ({
          published: false,
          reason: `display system runtime binding failed: ${reason}`,
        }),
      };
    }
  });
}

module.exports = {
  bindDisplaySystemRuntimeChannels,
  resolveOutputPublisher,
  resolveParserChannel,
};
