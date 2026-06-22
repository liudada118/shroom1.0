/**
 * server/index.js - 服务端模块入口
 *
 * 将原 server.js 中的纯函数拆分为独立模块，
 * 通过此入口统一导出，便于其他文件引用。
 *
 * 模块结构:
 * - mathUtils.js: 高斯模糊、插值、分压等数学函数
 * - dbManager.js: 数据库初始化和管理
 *
 * 注意: 主要的 WebSocket 逻辑和串口通信仍在根目录的 server.js 中，
 * 因为它们深度依赖全局状态。后续可逐步迁移。
 */

const mathUtils = require('./mathUtils');
const dbManager = require('./dbManager');

module.exports = {
  ...mathUtils,
  ...dbManager,
};
