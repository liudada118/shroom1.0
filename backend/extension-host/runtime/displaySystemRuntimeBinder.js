const {
  createDisplaySystemFrameProcessor,
} = require('./displaySystemFrameProcessorFactory');
const {
  getRuntimeMode,
} = require('./displaySystemRuntimePolicy');

/**
 * 把 manifest 声明的 parser 通道解析成 parser 管理器认识的通道标识。
 *
 * 三条路径按优先级：
 * 1. **自带协议就现场注册**：manifest 同时给了 `protocol` 和 `id` 时，说明这是
 *    二开自定义的协议，直接注册一个新通道 —— 这是扩展能引入新串口协议的入口。
 * 2. **按值直查**：`serialParserManager.channels` 是个枚举式映射
 *    （形如 `{ SIT: 'sit' }`），先看 role 是否本身就是一个合法的通道值。
 * 3. **按键名兜底**：把 role 里的连字符和空格换成下划线再转大写去查键
 *    （`'small-bed'` → `'SMALL_BED'`），兼容 manifest 用短横线写、常量用下划线
 *    大写的两套命名习惯。
 *
 * `parserChannel` 既接受对象也接受裸字符串（第 1 行的 `?.role || parserChannel`）——
 * 迁移期两种写法都在用。
 *
 * @param {{channels?: Record<string, string>, registerChannel?: Function}} serialParserManager parser 管理器。
 * @param {{role?: string, id?: string, protocol?: *}|string} parserChannel manifest 声明的通道。
 * @returns {string|*|null} parser 通道标识；解析不出为 null（调用方据此把 binding 判为未就绪）。
 */
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
  zeroStateStore,
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
      const frameProcessor = createFrameProcessor({ runtimeChannel: channel, zeroStateStore });

      /**
       * 把处理完的帧发出去，并把「发没发、为什么没发」一起返回。
       *
       * 两种不发的情况都返回 `published: false` + `reason` 而**不抛错**：
       * 调用方是每一帧都会跑到的热路径，抛错等于每帧一个异常。带 reason 返回
       * 让上层能在诊断里说清是「shadow 模式本来就不发」还是「没有可用的发布器」——
       * 这两件事的处置完全不同（前者正常，后者是装配错）。
       *
       * `getRuntimeMode({ runtimeMode })` 这个包一层的写法是为了复用策略模块里的
       * 归一逻辑（去空白 + 转小写），不是多余的对象构造 —— manifest 里写
       * `'Shadow'` 或 `' shadow '` 也要能判出来。
       *
       * @param {object} processedFrame 处理器输出的帧。
       * @returns {{published: boolean, processedFrame: object, reason?: string, output?: *}} 发布结果。
       */
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

      /**
       * binding 对外的唯一入口：处理一帧并发布。
       *
       * 处理器可能同步也可能异步（走 Python/外部算法通道时是 Promise），这里按
       * thenable 分流而不是一律 `await`：同步路径占绝大多数帧，无谓地包一层
       * Promise 会给每帧加一次微任务调度，在 1000Hz 级的串口流上不是可忽略的开销。
       *
       * 返回值形状因此也是两种（对象 或 Promise<对象>）—— dispatcher 的 bindOne
       * 正是按这个分流接错误的。
       *
       * @param {number[]|*} frame 归一后的原始帧。
       * @returns {object|Promise<object>} 发布结果，见 publishProcessedFrame。
       */
      function handleFrame(frame) {
        const processedFrame = frameProcessor.processFrame(frame);
        return processedFrame && typeof processedFrame.then === 'function'
          ? processedFrame.then(publishProcessedFrame)
          : publishProcessedFrame(processedFrame);
      }

      return {
        ...bindingBase,
        parserChannel,
        // ⚠️ parser 通道或输出发布器缺一个就降为 'registered'，而 dispatcher 的
        // start() 只挂 `status === 'bound'` 的 binding，且这类被过滤掉的 binding
        // **不会**进 skippedBindings。所以「展示系统没数据」有两个静默来源：
        // 这里降级成 registered，和 dispatcher 里 bindOne 判畸形返回 null。
        // 两者都只能靠 getStatus() 的三个计数对账发现。
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
