const {
  createDisplaySystemRuntimeDiscovery,
} = require('./runtime/displaySystemRuntimeDiscovery');
const {
  createDisplaySystemWorkspaceService,
} = require('./workspace/displaySystemWorkspaceService');
const path = require('path');
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
  const serialProtocolDirectories = [resolveUserPresetDirectory(runtimeWritableRoot)];
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
      rebindRuntimeChannels: () => (
        runtimeBindingOptions
          ? displaySystemRuntimeController.bind(runtimeBindingOptions)
          : []
      ),
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
        const requestedId = String(input?.manifest?.id || '').trim();
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
