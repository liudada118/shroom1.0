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

/**
 * 按输出通道解析实时帧发布函数。
 *
 * sit/back/head 仍走各自原有的 publisher，行为不变（保留民真高斯处理、
 * 头枕不限频、以及采集入库）。其余通道走 publishAux：只做实时下发，不入库
 * —— 采集存储只有这三张表，未知通道没有落库目标。
 *
 * @param {object} frameOutputPipeline 实时帧输出管线。
 * @param {string} outputChannel 输出通道名。
 * @returns {Function | null} 发布函数。
 */
function resolveOutputPublisher(frameOutputPipeline, outputChannel) {
  if (!frameOutputPipeline) return null;
  if (outputChannel === 'sit') return frameOutputPipeline.publishSit;
  if (outputChannel === 'back') return frameOutputPipeline.publishBack;
  if (outputChannel === 'head') return frameOutputPipeline.publishHead;
  if (typeof frameOutputPipeline.publishAux !== 'function') return null;
  return (frame) => frameOutputPipeline.publishAux(outputChannel, frame);
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
      outputChannel: channel.outputChannel || channel.serialRole,
    };

    try {
      const parserChannel = resolveParserChannel(serialParserManager, channel.parserChannel);
      const outputPublisher = resolveOutputPublisher(frameOutputPipeline, bindingBase.outputChannel);
      const frameProcessor = createFrameProcessor({ runtimeChannel: channel });

      function publishProcessedFrame(processedFrame) {
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

      function handleFrame(frame) {
        const processedFrame = frameProcessor.processFrame(frame);
        return processedFrame && typeof processedFrame.then === 'function'
          ? processedFrame.then(publishProcessedFrame)
          : publishProcessedFrame(processedFrame);
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
