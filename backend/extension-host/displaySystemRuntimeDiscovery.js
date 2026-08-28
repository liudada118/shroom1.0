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

function isPathInside(root, target) {
  if (!root || !target) return false;
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * 区分应用内置展示系统和用户创建的展示系统。
 *
 * 打包后资源目录只读、用户目录可写，可以直接按目录区分。开发环境中两个根目录相同，
 * 因此还要读取 builder 写入的 createdBy 标记，避免把项目内置配置误判为可编辑。
 *
 * @param {object} config 已加载的展示系统配置。
 * @param {string} runtimeResourceRoot 应用资源根目录。
 * @param {string} runtimeWritableRoot 用户可写根目录。
 * @returns {{ origin: 'system' | 'user', editable: boolean }}
 */
function classifyDisplaySystemAccess(config, {
  runtimeResourceRoot,
  runtimeWritableRoot,
}) {
  const metadata = config?.metadata || {};
  const explicitOrigin = metadata.origin === 'user' || metadata.origin === 'system'
    ? metadata.origin
    : null;
  const createdByBuilder = metadata.createdBy === 'display-system-builder';
  const sourceDirectory = config?.sourceDirectory || path.dirname(config?.manifestPath || '');
  const resourceRoots = [
    path.join(runtimeResourceRoot, 'display-systems'),
    path.join(runtimeResourceRoot, 'displaySystems'),
  ];
  const writableRoots = [
    path.join(runtimeWritableRoot, 'display-systems'),
    path.join(runtimeWritableRoot, 'displaySystems'),
  ];
  const inResourceRoot = resourceRoots.some((root) => isPathInside(root, sourceDirectory));
  const inWritableRoot = writableRoots.some((root) => isPathInside(root, sourceDirectory));
  const rootsOverlap = resourceRoots.some((resourceRoot) => (
    writableRoots.some((writableRoot) => path.resolve(resourceRoot) === path.resolve(writableRoot))
  ));

  const origin = explicitOrigin
    || (createdByBuilder ? 'user' : null)
    || (inWritableRoot && (!inResourceRoot || !rootsOverlap) ? 'user' : 'system');
  return {
    origin,
    editable: origin === 'user',
  };
}

/**
 * 处理不同扫描目录中重复的展示系统 ID。
 *
 * 内置系统始终优先于用户系统，避免用户通过手工复制同名 manifest 绕过只读限制。
 * 同一来源出现重复 ID 时保留最先发现的配置，并把冲突暴露到发现状态中。
 *
 * @param {object[]} configs 已补充访问属性的展示系统配置。
 * @returns {{ configs: object[], errors: string[] }} 去重后的配置和冲突信息。
 */
function resolveDisplaySystemAccessConflicts(configs) {
  const configsById = new Map();
  const errors = [];

  configs.forEach((config) => {
    const existing = configsById.get(config.id);
    if (!existing) {
      configsById.set(config.id, config);
      return;
    }

    if (existing.origin === 'system' && config.origin === 'user') {
      errors.push(
        `${config.manifestPath}: user display system cannot override read-only system "${config.id}"`,
      );
      return;
    }

    if (existing.origin === 'user' && config.origin === 'system') {
      configsById.set(config.id, config);
      errors.push(
        `${existing.manifestPath}: user display system cannot override read-only system "${config.id}"`,
      );
      return;
    }

    errors.push(`${config.manifestPath}: duplicate display system id "${config.id}"`);
  });

  return {
    configs: Array.from(configsById.values()),
    errors,
  };
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
    const accessibleConfigs = discovery.configs.map((config) => {
      const access = classifyDisplaySystemAccess(config, {
        runtimeResourceRoot,
        runtimeWritableRoot,
      });
      const accessibleConfig = {
        ...config,
        ...access,
      };
      return {
        ...accessibleConfig,
        runtimeDefinition: attachRuntimeChannelPlan(
          buildDisplaySystemRuntimeDefinition(accessibleConfig),
        ),
      };
    });
    const conflictResolution = resolveDisplaySystemAccessConflicts(accessibleConfigs);
    const configs = conflictResolution.configs;
    registry.clear();
    runtimeRegistry.clear();
    registry.registerMany(configs);
    configs.forEach((config) => {
      runtimeRegistry.registerMany(config.runtimeDefinition?.runtimeChannels || []);
    });
    discoveryErrors = [
      ...discovery.errors,
      ...conflictResolution.errors,
    ];
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
  classifyDisplaySystemAccess,
  createDisplaySystemRuntimeDiscovery,
  isPathInside,
  resolveDisplaySystemAccessConflicts,
};
