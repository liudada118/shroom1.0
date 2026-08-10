/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/sensors/index.js`。
 *
 * 传感器类型、矩阵尺寸、通道、波特率、能力标签，以及 5 个协议插件。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/sensors/index.js');
