/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/telemetry/telemetryNormalizer.js`。
 *
 * 旧实时 payload 归一成标准 telemetry 帧。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/telemetry/telemetryNormalizer.js');
