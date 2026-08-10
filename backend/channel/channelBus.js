/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/telemetry/channelBus.js`。
 *
 * 按 channelId 发布/订阅的进程内总线。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/telemetry/channelBus.js');
