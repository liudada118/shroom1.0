const {
  evaluateDisplaySystemDispatchPolicy,
} = require('./displaySystemRuntimePolicy');

/**
 * 把 parser 输出的帧归一成普通数组。
 *
 * Buffer 和各种 TypedArray 转成 number[]，其余类型**原样透传**（已解析成对象的帧 ——
 * 回放、算法通道 —— 不该被这层碰，谁的格式谁负责）。
 *
 * ⚠️ 转数组不是为了好看：处理器是二开可写的代码，拿到 Buffer 就能通过 `buffer.buffer`
 * 摸到底层 ArrayBuffer、改掉 parser 复用的缓冲区。统一成普通数组把这条路挡掉。
 *
 * @param {Buffer|ArrayBufferView|*} frame parser 输出。
 * @returns {number[]|*} Buffer/TypedArray 转成的数组，或原值。
 */
function normalizeIncomingFrame(frame) {
  if (Buffer.isBuffer(frame)) return [...frame];
  if (ArrayBuffer.isView(frame)) return Array.from(frame);
  return frame;
}

/**
 * 把 Display System runtime binding 挂到 serial parser 数据事件。
 *
 * dispatcher 只负责把 parser 输出送进已经绑定的 Display System 处理器；
 * 串口打开、关闭和重连仍由 serialManager 管理。
 *
 * @param {object} options 创建参数。
 * @param {object[]} options.bindings Display System runtime binding 列表。
 * @param {object} options.serialParserManager 串口 parser 管理器。
 * @param {object} [options.logger] 日志对象。
 * @param {Function} [options.dispatchPolicy] binding 调度策略。
 * @param {Function} [options.getSensorType] 当前传感器类型 getter。
 * @param {boolean} [options.allowParallelWithLegacy] 是否允许默认并行消费 legacy 通道。
 * @param {string[]} [options.legacyParserChannels] legacy runtime 保护的 parser 通道。
 * @returns {{ start: Function, stop: Function, getStatus: Function }} dispatcher 控制器。
 */
function createDisplaySystemRuntimeDispatcher({
  bindings = [],
  serialParserManager,
  logger,
  dispatchPolicy = evaluateDisplaySystemDispatchPolicy,
  getSensorType,
  allowParallelWithLegacy = false,
  allowActiveDisplaySystem = false,
  legacyParserChannels,
} = {}) {
  const activeHandlers = [];
  const skippedBindings = [];
  let started = false;

  /**
   * 问策略：这个 binding 能不能挂上实时流。
   *
   * ⚠️ `dispatchPolicy` 不是函数时**直接放行（fail-open，不是 fail-closed）**。默认值是
   * 真实策略，走到这条分支只可能是调用方显式传了非函数 —— 按「主动放弃闸门」处理。
   * 想加强规则，这里是要一起改的地方之一。
   *
   * 即时值 `currentSensorType` 与 getter 两个都传给策略：前者做类型匹配，后者留给它自己
   * 需要时重取。
   *
   * @param {object} binding runtime binding。
   * @returns {{allowed: boolean, reason: string|null}} 策略判断结果。
   */
  function canBind(binding) {
    if (typeof dispatchPolicy !== 'function') {
      return { allowed: true, reason: null };
    }
    return dispatchPolicy(binding, {
      getSensorType,
      currentSensorType: getSensorType?.(),
      allowParallelWithLegacy,
      allowActiveDisplaySystem,
      legacyParserChannels,
    });
  }

  /**
   * 给一个 binding 挂上 parser 的 data 监听。
   *
   * 帧处理异常一律吞掉只打 warn（一个处理器抛错不该打断整条串口流，别的展示系统还在用
   * 同一个 parser），同步异步两条路都要接 —— `handleFrame` 可能返回 Promise。
   * `DISPLAY_ALGORITHM_FRAME_DROPPED` 连 warn 都不打：那是背压信号，高频下会刷爆日志。
   *
   * ⚠️ binding 没有 `parserChannel` 或 `handleFrame` 不是函数时**静默返回 null**：既不进
   * `activeHandlers` 也**不进** `skippedBindings`（那个只收策略拒绝的）。所以排查「展示系统
   * 没数据」时先用 `getStatus()` 的三个数对账 —— `active + skipped < bindingCount` 的差额
   * 就是这里丢掉的，说明 binding 本身没成形，不是策略拦的。
   *
   * @param {object} binding runtime binding。
   * @returns {{bindingId: string, parserChannel: string, handler: Function}|null}
   *          已挂载记录；binding 畸形时为 null。
   */
  function bindOne(binding) {
    if (!binding?.parserChannel || typeof binding.handleFrame !== 'function') {
      return null;
    }

    // 实际挂到 parser 上的监听器。必须保留这个引用（随返回值一起交出去），
    // stop() 摘监听时要用同一个函数身份去 offData —— 重新构造一个等价函数摘不掉。
    const handler = (frame) => {
      try {
        const result = binding.handleFrame(normalizeIncomingFrame(frame));
        if (result && typeof result.catch === 'function') {
          result.catch((error) => {
            if (error?.code === 'DISPLAY_ALGORITHM_FRAME_DROPPED') return;
            logger?.warn?.('[DisplaySystems] async runtime frame dispatch failed', {
              bindingId: binding.id,
              message: error.message || String(error),
            });
          });
        }
      } catch (error) {
        logger?.warn?.('[DisplaySystems] runtime frame dispatch failed', {
          bindingId: binding.id,
          message: error.message || String(error),
        });
      }
    };

    serialParserManager.onData(binding.parserChannel, handler);
    return {
      bindingId: binding.id,
      parserChannel: binding.parserChannel,
      handler,
    };
  }

  /**
   * 启动调度：把所有 `status === 'bound'` 的 binding 过一遍策略再挂上 parser。
   *
   * 幂等 —— 已启动时直接返回当前状态，不会重复挂监听（重复挂会让同一帧被处理
   * 两次，而 parser 那边不去重）。
   *
   * 只挂 `status === 'bound'` 的 binding：其它状态（规划中、绑定失败）意味着
   * 通道还没成形，挂上去只会在每一帧上抛错。
   *
   * `skippedBindings` 每次启动前清空，所以它记录的始终是**本次**启动的拒绝原因，
   * 不是历史累积。
   *
   * @returns {object} 启动后的状态快照（见 getStatus）。
   * @throws {Error} serialParserManager 没有 onData 时抛出 —— 这是装配错误，
   *         静默降级会让整个展示系统链路看起来「启动成功但永远没数据」。
   */
  function start() {
    if (started) return getStatus();
    if (!serialParserManager?.onData) {
      throw new Error('serialParserManager with onData is required');
    }

    skippedBindings.splice(0);
    bindings
      .filter((binding) => binding.status === 'bound')
      .forEach((binding) => {
        const policyResult = canBind(binding);
        if (!policyResult.allowed) {
          skippedBindings.push({
            bindingId: binding.id,
            parserChannel: binding.parserChannel,
            reason: policyResult.reason,
          });
          return;
        }
        const active = bindOne(binding);
        if (active) activeHandlers.push(active);
      });
    started = true;
    return getStatus();
  }

  /**
   * 停止调度：摘掉所有已挂的监听。
   *
   * `splice(0)` 是「取出并清空」的惯用法：先把数组清干净再逐个摘，这样即便
   * `offData` 抛错也不会留下「已清空一半」的中间态。
   *
   * ⚠️ `offData?.()` 是可选调用：`serialParserManager` 没实现 `offData` 时，
   * 监听器**摘不掉但本地记录已清空** —— 之后再 start() 就会挂第二份，同一帧被
   * 处理两次。`start()` 强制要求 `onData` 存在却对 `offData` 宽容，这个不对称是
   * 现状；换 parser 管理器实现时必须确认 `offData` 存在，否则反复启停会累积监听。
   *
   * @returns {object} 停止后的状态快照。
   */
  function stop() {
    if (!started) return getStatus();
    activeHandlers.splice(0).forEach((active) => {
      serialParserManager.offData?.(active.parserChannel, active.handler);
    });
    skippedBindings.splice(0);
    started = false;
    return getStatus();
  }

  /**
   * 当前调度状态快照，供诊断使用。
   *
   * 三个计数一起看才有意义：`bindingCount` 是总数，`activeHandlerCount` 是真正
   * 挂上的，`skippedBindingCount` 是被策略拒绝的。**三者之差是 bindOne 静默丢弃
   * 的畸形 binding**（详见 bindOne 注释），这是目前唯一能发现那类问题的办法。
   *
   * `skippedBindings` 逐项浅拷后返回，不把内部数组的引用漏给调用方 ——
   * 调用方拿到引用后 push/清空会破坏下一次 getStatus 的准确性。
   *
   * @returns {{started: boolean, bindingCount: number, activeHandlerCount: number,
   *            skippedBindingCount: number, handlers: object[], skippedBindings: object[]}}
   *          状态快照。
   */
  function getStatus() {
    return {
      started,
      bindingCount: bindings.length,
      activeHandlerCount: activeHandlers.length,
      skippedBindingCount: skippedBindings.length,
      handlers: activeHandlers.map((active) => ({
        bindingId: active.bindingId,
        parserChannel: active.parserChannel,
      })),
      skippedBindings: skippedBindings.map((binding) => ({ ...binding })),
    };
  }

  return {
    getStatus,
    start,
    stop,
  };
}

module.exports = {
  createDisplaySystemRuntimeDispatcher,
  normalizeIncomingFrame,
};
