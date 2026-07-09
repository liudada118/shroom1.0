const {
  createDisplaySystemRuntimeDiscovery,
} = require('../displaySystems');
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
        return displaySystemRuntimeController.bind({
          serialManager,
          serialParserManager,
          frameOutputPipeline,
          getSensorType,
          allowParallelWithLegacy,
          allowActiveDisplaySystem,
        });
      },
      stopRuntimeDispatch: () => displaySystemRuntimeController.stop(),
      getRuntimeBindings: () => displaySystemRuntimeController.getRuntimeBindings(),
      getStatus: () => ({
        ...displaySystemRuntimeDiscovery.getStatus(),
        ...displaySystemRuntimeController.getStatus(),
      }),
      getById: (id) => displaySystemRuntimeDiscovery.getById(id),
    },
  };
}

module.exports = {
  buildRuntimeBindingSnapshot,
  createAppRuntime,
};
