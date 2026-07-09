/**
 * 创建展示系统注册表。
 *
 * 注册表只保存已经通过 manifest 校验的系统配置，不直接读文件、不打开串口、不启动算法。
 * 这样可以作为后续 HTTP、SDK、前端动态页面生成共同依赖的稳定边界。
 *
 * @param {object} options 依赖。
 * @param {object} [options.logger] 日志对象。
 * @returns {object} 注册表能力。
 */
function createDisplaySystemRegistry({ logger } = {}) {
  const systems = new Map();

  function register(config) {
    if (!config || !config.id) {
      throw new Error('display system config with id is required');
    }

    if (systems.has(config.id)) {
      logger?.warn?.('[DisplaySystems] override display system', config.id);
    }

    systems.set(config.id, Object.freeze({ ...config }));
    return systems.get(config.id);
  }

  function registerMany(configs = []) {
    return configs.map((config) => register(config));
  }

  function get(id) {
    return systems.get(id) || null;
  }

  function list() {
    return Array.from(systems.values());
  }

  function has(id) {
    return systems.has(id);
  }

  function snapshot() {
    return {
      count: systems.size,
      systems: list().map((system) => ({
        id: system.id,
        name: system.name,
        version: system.version,
        sensorType: system.sensor?.type,
        matrix: system.sensor?.matrix,
        algorithmType: system.algorithm?.type,
        parserChannelCount: system.runtimeDefinition?.parserChannels?.length || 0,
        runtimeChannelCount: system.runtimeDefinition?.runtimeChannelCount || 0,
        defaultView: system.runtimeDefinition?.displayMetadata?.defaultView,
      })),
    };
  }

  return {
    get,
    has,
    list,
    register,
    registerMany,
    snapshot,
  };
}

module.exports = {
  createDisplaySystemRegistry,
};
