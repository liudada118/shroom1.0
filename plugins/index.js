/**
 * plugins 模块入口
 * 
 * 提供插件系统的统一访问接口
 */

const { BaseSensorPlugin } = require('./BaseSensorPlugin');
const registry = require('./PluginRegistry');
const loadPlugins = require('./loadPlugins');

module.exports = {
  BaseSensorPlugin,
  registry,
  loadPlugins,
};
