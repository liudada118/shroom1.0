/**
 * loadPlugins - 插件自动加载器
 * 
 * 扫描 plugins/sensors/ 目录下的所有子目录，
 * 自动加载每个插件并注册到 PluginRegistry 中。
 * 
 * 插件目录结构约定:
 *   plugins/sensors/{pluginId}/index.js - 插件入口，必须导出一个 BaseSensorPlugin 实例
 * 
 * 使用方式:
 *   const loadPlugins = require('./plugins/loadPlugins');
 *   loadPlugins(); // 自动扫描并注册所有插件
 */

const fs = require('fs');
const path = require('path');
const registry = require('./PluginRegistry');
const logger = require('../logger');

/**
 * 自动扫描并加载所有传感器插件
 * @param {string} [pluginsDir] - 插件目录路径，默认为 plugins/sensors/
 */
function loadPlugins(pluginsDir) {
  const sensorsDir = pluginsDir || path.join(__dirname, 'sensors');

  if (!fs.existsSync(sensorsDir)) {
    logger.warn(`[loadPlugins] 插件目录不存在: ${sensorsDir}`);
    return;
  }

  const entries = fs.readdirSync(sensorsDir, { withFileTypes: true });
  let loadedCount = 0;
  let failedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pluginDir = path.join(sensorsDir, entry.name);
    const pluginEntry = path.join(pluginDir, 'index.js');

    if (!fs.existsSync(pluginEntry)) {
      logger.warn(`[loadPlugins] 跳过 ${entry.name}: 缺少 index.js`);
      continue;
    }

    try {
      const plugin = require(pluginEntry);
      registry.register(plugin);
      loadedCount++;
    } catch (err) {
      logger.error(`[loadPlugins] 加载插件 ${entry.name} 失败: ${err.message}`);
      failedCount++;
    }
  }

  logger.info(`[loadPlugins] 插件加载完成: 成功 ${loadedCount} 个, 失败 ${failedCount} 个, 总计 ${registry.size} 个`);
}

module.exports = loadPlugins;
