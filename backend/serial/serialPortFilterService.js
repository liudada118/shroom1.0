/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/serial/serialPortFilterService.js`。
 *
 * 按平台和厂商 ID 过滤非传感器端口。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/serial/serialPortFilterService.js');
