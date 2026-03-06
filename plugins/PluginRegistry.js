/**
 * PluginRegistry - 插件注册表
 * 
 * 管理所有传感器插件的注册、查找和激活。
 * 主应用通过注册表获取当前激活的插件实例，而不是通过 if/else 分支。
 * 
 * 使用方式:
 *   const registry = require('./plugins/PluginRegistry');
 *   const plugin = registry.get('hand0205');
 *   const baudRate = plugin.baudRate;
 *   const mappedData = plugin.mapLineOrder(rawData);
 */

const { BaseSensorPlugin } = require('./BaseSensorPlugin');
const logger = require('../logger');

class PluginRegistry {
  constructor() {
    /** @type {Map<string, BaseSensorPlugin>} */
    this._plugins = new Map();
    this._activePluginId = null;
  }

  /**
   * 注册一个插件
   * @param {BaseSensorPlugin} plugin - 插件实例
   */
  register(plugin) {
    if (!(plugin instanceof BaseSensorPlugin)) {
      throw new Error(`注册失败: ${plugin?.id || 'unknown'} 不是 BaseSensorPlugin 的实例`);
    }
    if (this._plugins.has(plugin.id)) {
      logger.warn(`[PluginRegistry] 插件 ${plugin.id} 已存在，将被覆盖`);
    }
    this._plugins.set(plugin.id, plugin);
    logger.info(`[PluginRegistry] 已注册插件: ${plugin.id} (${plugin.name})`);
  }

  /**
   * 批量注册插件
   * @param {BaseSensorPlugin[]} plugins - 插件实例数组
   */
  registerAll(plugins) {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * 获取指定 ID 的插件
   * @param {string} id - 插件 ID
   * @returns {BaseSensorPlugin|null}
   */
  get(id) {
    return this._plugins.get(id) || null;
  }

  /**
   * 设置当前激活的插件
   * @param {string} id - 插件 ID
   * @returns {BaseSensorPlugin} 激活的插件实例
   */
  setActive(id) {
    const plugin = this._plugins.get(id);
    if (!plugin) {
      logger.error(`[PluginRegistry] 未找到插件: ${id}，保持当前激活状态`);
      return this.getActive();
    }
    this._activePluginId = id;
    logger.info(`[PluginRegistry] 激活插件: ${id} (${plugin.name})`);
    return plugin;
  }

  /**
   * 获取当前激活的插件
   * @returns {BaseSensorPlugin|null}
   */
  getActive() {
    if (!this._activePluginId) return null;
    return this._plugins.get(this._activePluginId) || null;
  }

  /**
   * 获取当前激活插件的 ID
   * @returns {string|null}
   */
  getActiveId() {
    return this._activePluginId;
  }

  /**
   * 检查插件是否已注册
   * @param {string} id - 插件 ID
   * @returns {boolean}
   */
  has(id) {
    return this._plugins.has(id);
  }

  /**
   * 获取所有已注册插件的 ID 列表
   * @returns {string[]}
   */
  getAllIds() {
    return Array.from(this._plugins.keys());
  }

  /**
   * 获取所有已注册插件的元数据（用于前端展示传感器列表）
   * @returns {object[]}
   */
  getAllMeta() {
    return Array.from(this._plugins.values()).map(p => p.getMeta());
  }

  /**
   * 根据密钥中的 allowedTypes 过滤出可用的插件元数据
   * @param {string|string[]|null} allowedTypes - 密钥中的授权类型
   *   - 'all': 返回所有插件
   *   - string[]: 返回指定 ID 的插件
   *   - null/undefined: 返回所有插件（无限制）
   * @returns {object[]}
   */
  getFilteredMeta(allowedTypes) {
    if (!allowedTypes || allowedTypes === 'all') {
      return this.getAllMeta();
    }
    if (Array.isArray(allowedTypes)) {
      return allowedTypes
        .filter(id => this._plugins.has(id))
        .map(id => this._plugins.get(id).getMeta());
    }
    // 单个类型字符串
    const plugin = this._plugins.get(allowedTypes);
    return plugin ? [plugin.getMeta()] : [];
  }

  /**
   * 获取已注册插件的总数
   * @returns {number}
   */
  get size() {
    return this._plugins.size;
  }
}

// 单例模式 - 全局唯一的插件注册表
const registry = new PluginRegistry();

module.exports = registry;
