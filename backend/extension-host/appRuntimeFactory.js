const {
  createDisplaySystemRuntimeDiscovery,
} = require('./runtime/displaySystemRuntimeDiscovery');
const {
  createDisplaySystemWorkspaceService,
} = require('./workspace/displaySystemWorkspaceService');
const {
  discoverBuiltinAlgorithmPackages,
} = require('./manifest/builtinAlgorithmPackageCatalog');
const {
  createAgentAppService,
} = require('./agent-apps/agentAppService');
const path = require('path');
const { createRealtimeAlgorithmCatalog } = require('../agent-runtime/algorithm-lab/realtimeCatalog');
const { createBuiltinSystemTemplates } = require('./workspace/builtinSystemTemplates');
const { createManifestAlgorithmBindings } = require('./workspace/manifestAlgorithmBindings');
const {
  buildRuntimeBindingSnapshot,
  createDisplaySystemRuntimeController,
} = require('./runtime/displaySystemRuntimeFactory');
const {
  loadSerialProtocolPresets,
  resolveUserPresetDirectory,
} = require('@shroom/backend/protocol/presets/index.js');

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
  agentRoot = path.join(runtimeWritableRoot, 'agent'),
}) {
  const userAlgorithms = createRealtimeAlgorithmCatalog(agentRoot);
  const agentAppService = createAgentAppService({
    logger,
    runtimeResourceRoot,
    runtimeWritableRoot,
  });
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
  const builtinTemplates = createBuiltinSystemTemplates({
    root: path.join(runtimeWritableRoot, 'builtin-system-copies'), logger,
    listPackages: () => displaySystemWorkspace.getCatalog().algorithmPackages || [],
    isOccupied: (id) => Boolean(displaySystemRuntimeDiscovery.getById(id) || displaySystemRuntimeDiscovery.getBySensorType(id)),
  });
  const serialProtocolDirectories = [resolveUserPresetDirectory(runtimeWritableRoot)];
  const builtinAlgorithmPackageRoots = [
    path.join(runtimeResourceRoot, 'agent-resources', 'algorithm-packages'),
    path.join(runtimeResourceRoot, 'agent', 'algorithm-packages'),
  ];
  const displaySystemWorkspace = createDisplaySystemWorkspaceService({
    writableRoot: path.join(runtimeWritableRoot, 'display-systems'),
    // 「新建传感器」的串口模板列表直接来自协议预设库，和 GET /api/serial/protocols 同源。
    // 读不出来时退化成只有三份内置模板的旧行为 —— 目录页不能因为一个坏 JSON 打不开。
    listSerialProtocolPresets: () => {
      try {
        const result = loadSerialProtocolPresets({ extraDirectories: serialProtocolDirectories });
        result.invalid.forEach((entry) => {
          logger?.warn?.('[displaySystems] 串口协议预设无效', entry.filePath, entry.errors.join('; '));
        });
        return result.presets;
      } catch (error) {
        logger?.warn?.('[displaySystems] 串口协议预设加载失败', error.message || error);
        return [];
      }
    },
    listAlgorithmPackages: () => {
      const discovered = discoverBuiltinAlgorithmPackages({ roots: builtinAlgorithmPackageRoots });
      discovered.invalid.forEach((entry) => {
        logger?.warn?.('[displaySystems] 内置算法包无效', entry.source, entry.errors.join('; '));
      });
      return [...discovered.packages, ...userAlgorithms.list()];
    },
  });
  const manifestAlgorithmBindings = createManifestAlgorithmBindings({
    // 与 Agent 已保存算法共处 userData；开发版升级到打包版仍能读到绑定。
    root: path.join(path.dirname(agentRoot), 'manifest-algorithm-bindings'),
    getSystem: (id) => displaySystemRuntimeDiscovery.getById(id),
    getEditor: (id) => {
      const system = displaySystemRuntimeDiscovery.getById(id);
      return system ? displaySystemWorkspace.read(system) : null;
    },
    listPackages: () => displaySystemWorkspace.getCatalog().algorithmPackages || [],
  });
  let runtimeBindingOptions = null;

  /**
   * 重新发现展示系统，并在已经绑定过实时链路时顺带重新绑定。
   *
   * ⚠️ 这是二开闭环的关键一步，**所有写操作（save / saveDisplaySection / duplicate）保存后
   * 都必须调它**：只重新发现不重新绑定的话，注册表更新了而实时流还挂在旧 binding 上，现象
   * 是「保存成功、界面也列出来了，就是没数据」。
   *
   * `runtimeBindingOptions` 是首次 `bindRuntimeChannels` 时缓存的那套依赖 —— 重载发生在 HTTP
   * 请求上下文里，那里拿不到这些运行时对象。为 null 表示还没走过启动绑定，此时只重新发现、
   * 不绑定，不是错误。返回发现层状态而非绑定结果，因为调用方要回给前端的是加载情况。
   *
   * @returns {object} 发现层状态快照，见 displaySystemRuntimeDiscovery.getStatus。
   */
  function reloadDisplaySystems() {
    displaySystemRuntimeDiscovery.reload();
    builtinTemplates.reload();
    if (runtimeBindingOptions) {
      displaySystemRuntimeController.bind(runtimeBindingOptions);
    }
    return displaySystemRuntimeDiscovery.getStatus();
  }

  return {
    builtinTemplates,
    // Agent 生成的展示包只作为静态浏览器资源加载；宿主不会执行包内 JS/Node 代码。
    agentApps: agentAppService,
    // 仅供进程内算法超市装配；HTTP 层不能直接返回含绝对路径的这份清单。
    getAlgorithmMarketPackages: () => discoverBuiltinAlgorithmPackages({ roots: builtinAlgorithmPackageRoots, includeResolved: true }).packages,
    getUserAlgorithmPackages: () => userAlgorithms.list({ includeResolved: true }),
    displaySystems: {
      bindRuntimeChannels: ({
        serialManager,
        serialParserManager,
        frameOutputPipeline,
        getSensorType,
        allowParallelWithLegacy,
        allowActiveDisplaySystem,
        zeroStateStore,
      }) => {
        runtimeBindingOptions = {
          serialManager,
          serialParserManager,
          frameOutputPipeline,
          getSensorType,
          allowParallelWithLegacy,
          allowActiveDisplaySystem,
          zeroStateStore,
        };
        return displaySystemRuntimeController.bind(runtimeBindingOptions);
      },
      rebindRuntimeChannels: () => (
        runtimeBindingOptions
          ? displaySystemRuntimeController.bind(runtimeBindingOptions)
          : []
      ),
      stopRuntimeDispatch: () => displaySystemRuntimeController.stop(),
      resetRuntimeAlgorithms: (reason) => displaySystemRuntimeController.resetAlgorithms(reason),
      getRuntimeBindings: () => displaySystemRuntimeController.getRuntimeBindings(),
      getStatus: () => {
        const status = displaySystemRuntimeDiscovery.getStatus();
        const copies = builtinTemplates.list();
        return { ...status, ...displaySystemRuntimeController.getStatus(),
          count: status.count + copies.length,
          systems: [...status.systems, ...copies],
          runtimeDefinitions: [...status.runtimeDefinitions, ...copies.map((item) => item.runtimeDefinition)] };
      },
      getById: (id) => builtinTemplates.get(id) || displaySystemRuntimeDiscovery.getById(id),
      readManifestAlgorithmBindings: manifestAlgorithmBindings.read,
      updateManifestAlgorithmBindings: manifestAlgorithmBindings.update,
      getManifestAlgorithmConfiguration: manifestAlgorithmBindings.getRuntimeConfiguration,
      /** 标出当前 Manifest 已占用的 Python 包，超市不能重复初始化同一原生库。 */
      getActiveAlgorithmPackageIds: (sensorType) => (displaySystemRuntimeDiscovery.getBySensorType(sensorType)?.sensors || []).map((sensor) => sensor.algorithm?.package?.id).filter(Boolean),
      getEditorById: (id) => {
        const config = displaySystemRuntimeDiscovery.getById(id);
        return config ? displaySystemWorkspace.read(config) : builtinTemplates.editor(id);
      },
      getBuilderCatalog: () => ({ ...displaySystemWorkspace.getCatalog(), builtinTemplates: builtinTemplates.catalog,
        builtinTemplateCreation: { supported: true, version: 1 },
        nativeSystemEditing: { supported: true, version: 1, maxAlgorithms: 8, maxCharts: 12,
          fields: ['name', 'configuration.algorithms', 'configuration.charts', 'configuration.showPressure', 'configuration.showArea'],
          updateRoute: '/api/display-systems/:id/native', deleteRoute: '/api/display-systems/:id/native' },
        manifestAlgorithmEditing: { supported: true, version: 1, maxAlgorithms: 8, maxCharts: 12,
          fields: ['configuration.algorithms', 'configuration.charts'], updateRoute: '/api/display-systems/:id/algorithm-bindings' } }),
      reload: reloadDisplaySystems,
      save: (input) => {
        if (input?.builtinTemplate) {
          if (Object.keys(input).some((key) => key !== 'builtinTemplate')) throw new Error('内置模板创建不接受其他配置字段。');
          return builtinTemplates.create(input.builtinTemplate);
        }
        const requestedId = String(input?.manifest?.id || '').trim();
        if (builtinTemplates.get(requestedId)) throw Object.assign(new Error('这个标识已被内置模板副本使用。'), { code: 'DISPLAY_SYSTEM_EXISTS' });
        const existing = requestedId
          ? displaySystemRuntimeDiscovery.getById(requestedId)
          : null;
        if (existing && existing.editable !== true) {
          const error = new Error('system display systems are read-only');
          error.code = 'DISPLAY_SYSTEM_READ_ONLY';
          throw error;
        }
        const saved = displaySystemWorkspace.save(input);
        reloadDisplaySystems();
        return {
          ...saved,
          displaySystem: displaySystemRuntimeDiscovery.getById(saved.id),
        };
      },
      saveDisplaySection: (id, patch) => {
        const existing = displaySystemRuntimeDiscovery.getById(String(id || '').trim());
        if (!existing) return null;
        // 和 save 同一个方向的检查：自带系统的目录在只读资源目录里，写不进去。
        // 它的出路是 duplicate，不是这里。
        if (existing.editable !== true) {
          const error = new Error('system display systems are read-only');
          error.code = 'DISPLAY_SYSTEM_READ_ONLY';
          throw error;
        }
        const saved = displaySystemWorkspace.saveDisplaySection(existing, patch);
        reloadDisplaySystems();
        return {
          ...saved,
          displaySystem: displaySystemRuntimeDiscovery.getById(saved.id),
        };
      },
      duplicate: (id, options) => {
        if (builtinTemplates.get(options?.id)) throw Object.assign(new Error('这个标识已被内置模板副本使用。'), { code: 'DISPLAY_SYSTEM_EXISTS' });
        const existing = displaySystemRuntimeDiscovery.getById(String(id || '').trim());
        if (!existing) return null;
        // **刻意不检查 `existing.editable`。** 自带展示系统正是要能被另存为 ——
        // 那是它唯一的保存出路。这里检查的是目标 id 有没有被占，
        // 而这一条 workspace.duplicate 自己会抛 DISPLAY_SYSTEM_EXISTS。
        const created = displaySystemWorkspace.duplicate(existing, options);
        reloadDisplaySystems();
        return {
          ...created,
          displaySystem: displaySystemRuntimeDiscovery.getById(created.id),
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
      /**
       * 列出某个展示系统声明的全部串口通道。
       *
       * 串口编排器和共享 WebSocket 都读取这份列表：有几个 sensors 条目就有几路
       * 可打开、解析和按 canonical channelId 发布，不需要新增后端端口或通道常量。
       *
       * @param {string} sensorType 传感器类型。
       * @returns {Array<{channelId: string, displaySystemId: string, sensorId: string,
       *   serialRole: string, outputChannel: string, label: string, baudRate: number,
       *   parserChannel: string, protocol: object}>} 通道列表。
       */
      listSerialChannels: (sensorType) => {
        const system = displaySystemRuntimeDiscovery.getBySensorType(sensorType);
        const channels = system?.runtimeDefinition?.runtimeChannels || [];
        return channels
          .filter((channel) => channel.protocol)
          .map((channel) => ({
            channelId: channel.id,
            displaySystemId: channel.displaySystemId,
            sensorId: channel.serialRole,
            sensorType: channel.sensor?.type || channel.parserChannel?.sensorType || sensorType,
            serialRole: channel.serialRole,
            outputChannel: channel.outputChannel || channel.serialRole,
            label: channel.label || channel.serialRole,
            sensorLabel: channel.label || channel.serialRole,
            baudRate: channel.protocol.baudRate,
            parserChannel: channel.parserChannel?.id || channel.serialRole,
            protocol: channel.protocol,
          }));
      },
    },
    // 用户自定义串口协议预设目录。HTTP 层的 GET /api/serial/protocols 要用同一份，
    // 从这里取而不是各自再拼一次，避免两处路径拼法漂移。
    serialProtocolDirectories,
  };
}

module.exports = {
  buildRuntimeBindingSnapshot,
  createAppRuntime,
};
