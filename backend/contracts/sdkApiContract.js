/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/contract/sdkApiContract.js`。
 *
 * 对外 HTTP 路由表、telemetry 帧形状、展示系统 manifest 形状，以及 GET /api/sdk/contract 的快照构造。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/contract/sdkApiContract.js');
