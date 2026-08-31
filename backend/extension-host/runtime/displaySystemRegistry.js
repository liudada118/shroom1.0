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

  /**
   * 注册一个已通过校验的展示系统配置。
   *
   * ⚠️ 同 id 重复注册是**允许的覆盖**，只打 warn 不抛错 —— 用户工作区的系统要能覆盖同 id
   * 内置系统，这正是二开入口。代价是「装了两个同 id 扩展」只体现在日志里，加载顺序决定
   * 谁生效。
   *
   * ⚠️ `Object.freeze` 是**浅冻结**：`sensor`/`algorithm`/`display` 这些嵌套对象仍可被持有
   * 引用的一方就地改。别当成「配置不可变」的保证，需要真不可变的地方自己深拷。
   *
   * @param {{id: string}} config 展示系统配置，必须带 id。
   * @returns {Readonly<object>} 已注册的（浅冻结）配置副本。
   * @throws {Error} config 缺失或没有 id 时抛出。
   */
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

  /**
   * 批量注册。
   *
   * 不做整体事务：中途某个配置抛错时，之前已注册的会留在表里。调用方若需要
   * 「全成功或全不动」，要自己先校验再进来 —— 注册表刻意不承担回滚职责，
   * 因为它不知道调用方的失败语义（发现流程通常希望坏一个跳一个，而不是整批放弃）。
   *
   * @param {Array<{id: string}>} [configs=[]] 配置数组。
   * @returns {Array<Readonly<object>>} 已注册配置。
   */
  function registerMany(configs = []) {
    return configs.map((config) => register(config));
  }

  /**
   * 按 id 取展示系统。
   *
   * @param {string} id 展示系统 id。
   * @returns {Readonly<object>|null} 配置；不存在时为 null（不抛）。
   */
  function get(id) {
    return systems.get(id) || null;
  }

  /**
   * 列出全部展示系统，顺序即注册顺序。
   *
   * @returns {Array<Readonly<object>>} 配置数组。
   */
  function list() {
    return Array.from(systems.values());
  }

  /**
   * 判断某 id 是否已注册。
   *
   * @param {string} id 展示系统 id。
   * @returns {boolean} 是否存在。
   */
  function has(id) {
    return systems.has(id);
  }

  /**
   * 清空注册表。
   *
   * 供重新发现（reload）时使用：发现流程是「清空 + 重注册」而不是增量 diff，
   * 因为被删掉的 manifest 无法用增量方式表达。
   *
   * @returns {void}
   */
  function clear() {
    systems.clear();
  }

  /**
   * 按传感器类型找展示系统。
   *
   * ⚠️ 返回**第一个**匹配项。同一个 `sensor.type` 被多个展示系统声明时，
   * 谁先注册谁赢 —— 注册表不检测这种冲突，也不报警。这是旧 sensorType
   * 单值路径遗留下来的查询方式，新代码应尽量按 id 或 channelId 定位。
   *
   * @param {string} sensorType 传感器类型。
   * @returns {Readonly<object>|null} 首个匹配的配置；无匹配为 null。
   */
  function findBySensorType(sensorType) {
    return list().find((system) => system.sensor?.type === sensorType) || null;
  }

  /**
   * 生成一份用于诊断/接口展示的精简快照。
   *
   * 刻意只投影固定的十来个字段而不是整份配置：这份快照会经 HTTP 出到前端和 SDK，
   * 整份 manifest 里含文件路径、算法源码等不该外泄也不该让前端依赖的内容。
   * 新增字段前先想清楚它是否该成为对外契约的一部分。
   *
   * @returns {{count: number, systems: object[]}} 快照。
   */
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
        editable: system.editable === true,
        origin: system.origin || 'system',
        parserChannelCount: system.runtimeDefinition?.parserChannels?.length || 0,
        runtimeChannelCount: system.runtimeDefinition?.runtimeChannelCount || 0,
        defaultView: system.runtimeDefinition?.displayMetadata?.defaultView,
      })),
    };
  }

  return {
    clear,
    get,
    findBySensorType,
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
