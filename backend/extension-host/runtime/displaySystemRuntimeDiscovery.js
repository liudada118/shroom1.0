const path = require('path');
const { discoverDisplaySystems } = require('../manifest/displaySystemConfigLoader');
const {
  buildDisplaySystemRuntimeDefinition,
} = require('../manifest/displaySystemDefinitionBuilder');
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
 * 判断 target 是否位于 root 之内（含 root 自身）。
 *
 * 用 `path.relative` 而**不是字符串前缀比较**，三个理由都会真实踩到：
 * 1. 前缀法会把 `/app/resources-backup` 判成在 `/app/resources` 里面 —— 只差一个
 *    后缀的兄弟目录会被误判为子目录，进而把用户目录当成只读资源目录。
 * 2. `relative` 会先 `resolve`，于是 `..`、`.` 和大小写/分隔符差异都被折平，
 *    manifest 里写相对路径也能判对。
 * 3. Windows 上跨盘符（`C:\` 与 `D:\`）算不出相对路径，`relative` 会返回一个绝对
 *    路径 —— 这就是 `!path.isAbsolute(relative)` 那一项的用途，少了它跨盘符会误判
 *    为「在里面」。
 *
 * `relative === ''` 单独放行，表示 root 自己也算「在 root 之内」：manifest 直接放在
 * 根目录下（没有子目录）时 sourceDirectory 就等于 root。
 *
 * @param {string} root 根目录。
 * @param {string} target 待判目录或文件路径。
 * @returns {boolean} target 是否在 root 之内；任一为空时为 false。
 */
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

  /**
   * 重新扫描所有根目录，全量重建两张注册表。
   *
   * **全量重建（clear + registerMany）而不是增量更新**：manifest 被删掉这件事无法
   * 用增量表达 —— 没有「删除事件」可听，只能靠「这一轮没扫到」推断。清空重注册是
   * 唯一能让注册表跟磁盘一致的做法。代价是重载瞬间两张表是空的，所以这个函数不能
   * 在实时流跑着的时候随便调（调用方会先停 dispatcher）。
   *
   * 顺序有讲究：先 `classifyDisplaySystemAccess` 定 origin，**再**做冲突消解 ——
   * 因为「内置优先于用户」这条规则需要先知道每份配置的 origin 才能比较。
   * `attachRuntimeChannelPlan` 在分类之后、冲突消解之前跑，是为了让被丢弃的重复
   * 配置也已经建好计划（多花一点计算，换来两条路径的代码一致，不必区分对待）。
   *
   * `discoveryErrors` 每次重载整体替换而非累加：它表达的是「当前磁盘状态有哪些
   * 问题」，累加会让修好的问题一直留在诊断里。⚠️ 注意扫描错误只进这个数组、
   * **不抛出** —— 一份坏 manifest 不该让整个应用起不来，但也意味着二开时写错了
   * manifest 界面只是少一个展示系统，必须去 `getStatus().errors` 里看。
   *
   * @returns {object[]} 本轮注册成功的展示系统配置（已去重）。
   */
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
    /**
     * 发现层的对外状态：注册表快照 + 扫描目录 + 运行时定义 + 错误列表。
     *
     * 这是「打包后二开为什么没生效」的第一落点，所以四块都要在：`roots` 说明去哪
     * 几个目录找过（放错目录是最常见的原因），`errors` 说明找到了但没通过校验，
     * 快照说明通过校验并注册成功的有哪些。
     *
     * ⚠️ `runtimeDefinitions` 是**未收窄的完整定义**（含算法与顺序文件的源路径），
     * 与 registry/runtimeRegistry 那两份刻意投影过的快照不同。它会出到 HTTP 状态
     * 接口上，把这个接口暴露到不受信网络前需要先想清楚这一点。
     *
     * @returns {object} 发现层状态。
     */
    getStatus() {
      return {
        ...registry.snapshot(),
        roots,
        runtimeDefinitions: registry.list().map((system) => system.runtimeDefinition),
        runtimeChannelRegistry: runtimeRegistry.snapshot(),
        errors: discoveryErrors,
      };
    },
    /**
     * 按 id 取展示系统。转发给注册表，这里存在只是为了不把 registry 的写方法
     * 一起暴露给只需要读的调用方。
     *
     * @param {string} id 展示系统 id。
     * @returns {object|null} 配置；不存在为 null。
     */
    getById(id) {
      return registry.get(id);
    },
    /**
     * 按传感器类型取展示系统。
     *
     * ⚠️ 底层是 `findBySensorType`，**返回第一个匹配**且不检测冲突。两份 manifest
     * 声明同一 `sensor.type` 时，谁先被扫到谁生效（扫描顺序 = `roots` 的顺序，
     * 即资源目录先于可写目录）。冲突消解只按 id 做，不按 sensorType 做。
     *
     * @param {string} sensorType 传感器类型。
     * @returns {object|null} 第一个匹配的配置；没有为 null。
     */
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
