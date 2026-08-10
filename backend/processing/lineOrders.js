/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/processing/lineOrders.js`。
 *
 * 线序执行器；点位表在同包的 processing/lineOrderDefinitions/。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/processing/lineOrders.js');
