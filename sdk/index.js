/**
 * 兼容壳：后端 SDK 已经打成可安装的包 `@shroom/backend`，代码在 `sdk/backend/`。
 *
 * 这里保留只是因为 `backend/tests/sdk/serialChainDemo.test.js` 和一部分脚本
 * 还写着 `require('../../../sdk')`。新代码请直接写包名：
 *
 * ```js
 * const { ShroomSensorSDK } = require('@shroom/backend/session');
 * const { BackendSdkClient } = require('@shroom/backend/client');
 * ```
 *
 * 用 `module.exports =` 整体转出而不是 `{...}` 展开 —— 根出口对
 * serial / storage / export / client / session 用的是懒加载 getter，
 * 展开会把 4 个原生 peer 依赖全部提前加载一遍（见 `sdk/backend/index.js` 顶部）。
 */
module.exports = require('@shroom/backend');
