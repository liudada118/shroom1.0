const {
  bindDisplaySystemRuntimeChannels,
  createDisplaySystemRuntimeDispatcher,
} = require('./index');

function buildRuntimeBindingSnapshot(runtimeBindings = []) {
  return {
    count: runtimeBindings.length,
    bindings: runtimeBindings.map((binding) => ({
      id: binding.id,
      displaySystemId: binding.displaySystemId,
      serialRole: binding.serialRole,
      parserChannel: binding.parserChannel,
      outputChannel: binding.outputChannel,
      status: binding.status,
      error: binding.error || null,
      serialStatus: binding.serialStatus?.status || null,
      runtimeMode: binding.runtimeMode || null,
    })),
  };
}

/**
 * 创建 Display Systems 实时链路控制器。
 *
 * appRuntimeFactory 只负责把 discovery 和 HTTP 状态拼起来；这里集中管理 runtime channel
 * binding、dispatcher 创建、重复绑定时旧 listener 清理，以及关闭时 dispatcher stop。
 *
 * @param {object} options 创建参数。
 * @param {object} options.runtimeChannelRegistry Display Systems runtime channel 注册表。
 * @param {object} [options.logger] 日志对象。
 * @param {Function} [options.bindRuntimeChannels] runtime channel 绑定函数。
 * @param {Function} [options.createRuntimeDispatcher] dispatcher 工厂。
 * @returns {object} Display Systems runtime 控制器。
 */
function createDisplaySystemRuntimeController({
  runtimeChannelRegistry,
  logger,
  bindRuntimeChannels = bindDisplaySystemRuntimeChannels,
  createRuntimeDispatcher = createDisplaySystemRuntimeDispatcher,
} = {}) {
  let runtimeBindings = [];
  let runtimeDispatcher = null;

  function bind({
    serialManager,
    serialParserManager,
    frameOutputPipeline,
    getSensorType,
    allowParallelWithLegacy,
    allowActiveDisplaySystem,
  } = {}) {
    runtimeDispatcher?.stop?.();
    runtimeBindings = bindRuntimeChannels({
      runtimeChannelRegistry,
      serialManager,
      serialParserManager,
      frameOutputPipeline,
    });
    runtimeDispatcher = createRuntimeDispatcher({
      bindings: runtimeBindings,
      serialParserManager,
      logger,
      getSensorType,
      allowParallelWithLegacy,
      allowActiveDisplaySystem,
    });
    runtimeDispatcher.start();
    return runtimeBindings;
  }

  function stop() {
    return runtimeDispatcher?.stop?.();
  }

  function getDispatcherStatus() {
    return runtimeDispatcher?.getStatus?.() || {
      started: false,
      bindingCount: runtimeBindings.length,
      activeHandlerCount: 0,
      skippedBindingCount: 0,
      handlers: [],
      skippedBindings: [],
    };
  }

  function getStatus() {
    return {
      runtimeBindings: buildRuntimeBindingSnapshot(runtimeBindings),
      runtimeDispatcher: getDispatcherStatus(),
    };
  }

  return {
    bind,
    getRuntimeBindings: () => runtimeBindings,
    getStatus,
    stop,
  };
}

module.exports = {
  buildRuntimeBindingSnapshot,
  createDisplaySystemRuntimeController,
};
