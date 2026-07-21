const {
  createDisplaySystemRuntimeDiscovery,
  createDisplaySystemWorkspaceService,
} = require('../displaySystems');
const path = require('path');
const {
  buildRuntimeBindingSnapshot,
  createDisplaySystemRuntimeController,
} = require('./displaySystemRuntimeFactory');

/**
 * 创建应用运行时装配对象。
 *
 * 这里承接和“应用运行期能力发现/注册”相关的对象，避免 `server.js` 继续堆叠
 * display systems、后续动态 sensor runtime 等装配细节。
 *
 * @param {object} options 创建参数。
 * @param {object} options.logger 日志对象。
 * @param {string} options.runtimeResourceRoot 打包资源根目录。
 * @param {string} options.runtimeWritableRoot 用户可写根目录。
 * @returns {object} 应用运行时装配对象。
 */
function createAppRuntime({
  logger,
  runtimeResourceRoot,
  runtimeWritableRoot,
}) {
  const displaySystemRuntimeDiscovery = createDisplaySystemRuntimeDiscovery({
    logger,
    runtimeResourceRoot,
    runtimeWritableRoot,
    validateFiles: true,
  });
  const displaySystemRuntimeController = createDisplaySystemRuntimeController({
    runtimeChannelRegistry: displaySystemRuntimeDiscovery.runtimeRegistry,
    logger,
  });
  const displaySystemWorkspace = createDisplaySystemWorkspaceService({
    writableRoot: path.join(runtimeWritableRoot, 'display-systems'),
  });
  let runtimeBindingOptions = null;

  function reloadDisplaySystems() {
    displaySystemRuntimeDiscovery.reload();
    if (runtimeBindingOptions) {
      displaySystemRuntimeController.bind(runtimeBindingOptions);
    }
    return displaySystemRuntimeDiscovery.getStatus();
  }

  return {
    displaySystems: {
      bindRuntimeChannels: ({
        serialManager,
        serialParserManager,
        frameOutputPipeline,
        getSensorType,
        allowParallelWithLegacy,
        allowActiveDisplaySystem,
      }) => {
        runtimeBindingOptions = {
          serialManager,
          serialParserManager,
          frameOutputPipeline,
          getSensorType,
          allowParallelWithLegacy,
          allowActiveDisplaySystem,
        };
        return displaySystemRuntimeController.bind(runtimeBindingOptions);
      },
      stopRuntimeDispatch: () => displaySystemRuntimeController.stop(),
      getRuntimeBindings: () => displaySystemRuntimeController.getRuntimeBindings(),
      getStatus: () => ({
        ...displaySystemRuntimeDiscovery.getStatus(),
        ...displaySystemRuntimeController.getStatus(),
      }),
      getById: (id) => displaySystemRuntimeDiscovery.getById(id),
      getEditorById: (id) => {
        const config = displaySystemRuntimeDiscovery.getById(id);
        return config ? displaySystemWorkspace.read(config) : null;
      },
      getBuilderCatalog: () => displaySystemWorkspace.getCatalog(),
      reload: reloadDisplaySystems,
      save: (input) => {
        const saved = displaySystemWorkspace.save(input);
        reloadDisplaySystems();
        return {
          ...saved,
          displaySystem: displaySystemRuntimeDiscovery.getById(saved.id),
        };
      },
      getSerialConfig: (sensorType, role) => {
        const system = displaySystemRuntimeDiscovery.getBySensorType(sensorType);
        const channel = system?.runtimeDefinition?.runtimeChannels?.find((item) => item.serialRole === role);
        if (!channel?.protocol) return null;
        return {
          baudRate: channel.protocol.baudRate,
          parserChannel: channel.parserChannel?.id || channel.serialRole,
          protocol: channel.protocol,
        };
      },
    },
  };
}

module.exports = {
  buildRuntimeBindingSnapshot,
  createAppRuntime,
};
