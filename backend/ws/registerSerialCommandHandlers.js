const { registerSerialControlHandlers } = require('../application/serialControlService');

/**
 * WebSocket 串口命令兼容入口。
 * 具体业务动作已经迁到 application 层，WS 层只保留旧 import 路径和注册转发。
 */
function registerSerialCommandHandlers(router, deps) {
  return registerSerialControlHandlers(router, deps);
}

module.exports = {
  registerSerialCommandHandlers,
};
