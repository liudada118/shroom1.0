const path = require('path');
const { discoverDisplaySystems } = require('./displaySystemConfigLoader');
const {
  buildDisplaySystemRuntimeDefinition,
} = require('./displaySystemDefinitionBuilder');
const {
  attachRuntimeChannelPlan,
} = require('./displaySystemRuntimeChannelPlanner');
const { createDisplaySystemRegistry } = require('./displaySystemRegistry');
const {
  createDisplaySystemRuntimeRegistry,
} = require('./displaySystemRuntimeRegistry');

/**
 * 构建运行时需要扫描的展示系统根目录。
 *
 * 打包后用户自定义配置通常落在可写目录，开发态配置通常落在项目资源目录；
 * 同时兼容 display-systems 和 displaySystems 两种命名。
 *
 * @param {object} options 路径参数。
 * @param {string} options.runtimeResourceRoot 资源根目录。
 * @param {string} options.runtimeWritableRoot 可写根目录。
 * @returns {string[]} 去重后的扫描目录。
 */
function buildDisplaySystemRoots({
  runtimeResourceRoot,
  runtimeWritableRoot,
}) {
  return Array.from(new Set([
    path.join(runtimeResourceRoot, 'display-systems'),
    path.join(runtimeResourceRoot, 'displaySystems'),
    path.join(runtimeWritableRoot, 'display-systems'),
    path.join(runtimeWritableRoot, 'displaySystems'),
  ]));
}

/**
 * 创建展示系统运行时发现服务。
 *
 * 该服务只负责发现、校验、注册和查询 manifest，不直接打开串口、不绑定 parser、
 * 不处理实时帧。这样可以先建立“打包后自定义添加展示系统”的发现边界。
 *
 * @param {object} options 创建参数。
 * @param {object} [options.logger] 日志对象。
 * @param {string} options.runtimeResourceRoot 资源根目录。
 * @param {string} options.runtimeWritableRoot 可写根目录。
 * @param {boolean} [options.validateFiles] 是否校验 manifest 引用文件存在。
 * @returns {{ getById: Function, getStatus: Function, registry: object, roots: string[] }}
 */
function createDisplaySystemRuntimeDiscovery({
  logger,
  runtimeResourceRoot,
  runtimeWritableRoot,
  validateFiles = true,
}) {
  const roots = buildDisplaySystemRoots({
    runtimeResourceRoot,
    runtimeWritableRoot,
  });
  const registry = createDisplaySystemRegistry({ logger });
  const runtimeRegistry = createDisplaySystemRuntimeRegistry({ logger });
  let discoveryErrors = [];

  function reload() {
    const discovery = discoverDisplaySystems(roots, {
      logger,
      validateFiles,
    });
    const configs = discovery.configs.map((config) => ({
      ...config,
      runtimeDefinition: attachRuntimeChannelPlan(buildDisplaySystemRuntimeDefinition(config)),
    }));
    registry.clear();
    runtimeRegistry.clear();
    registry.registerMany(configs);
    configs.forEach((config) => {
      runtimeRegistry.registerMany(config.runtimeDefinition?.runtimeChannels || []);
    });
    discoveryErrors = discovery.errors;
    return configs;
  }

  reload();

  return {
    roots,
    registry,
    runtimeRegistry,
    getStatus() {
      return {
        ...registry.snapshot(),
        roots,
        runtimeDefinitions: registry.list().map((system) => system.runtimeDefinition),
        runtimeChannelRegistry: runtimeRegistry.snapshot(),
        errors: discoveryErrors,
      };
    },
    getById(id) {
      return registry.get(id);
    },
    getBySensorType(sensorType) {
      return registry.findBySensorType(sensorType);
    },
    reload,
  };
}

module.exports = {
  buildDisplaySystemRoots,
  createDisplaySystemRuntimeDiscovery,
};
