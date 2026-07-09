const {
  evaluateDisplaySystemDispatchPolicy,
} = require('./displaySystemRuntimePolicy');

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

  function bindOne(binding) {
    if (!binding?.parserChannel || typeof binding.handleFrame !== 'function') {
      return null;
    }

    const handler = (frame) => {
      try {
        binding.handleFrame(normalizeIncomingFrame(frame));
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

  function stop() {
    if (!started) return getStatus();
    activeHandlers.splice(0).forEach((active) => {
      serialParserManager.offData?.(active.parserChannel, active.handler);
    });
    skippedBindings.splice(0);
    started = false;
    return getStatus();
  }

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
