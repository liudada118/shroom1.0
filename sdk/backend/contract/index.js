/**
 * `@shroom/backend/contract` - 对外契约层
 *
 * **零依赖**（只用 Node 内置 `crypto`）。这一层描述的是「后端答应对外保持不变的东西」：
 * HTTP 路由表、命令信封格式、telemetry 帧形状、展示系统 manifest 形状。
 *
 * 想连一个已经跑起来的后端，从这里读路由和命令格式，不要去翻 `server.js`。
 * 运行时的契约快照走 `GET /api/sdk/contract`，它的构造函数就是这里的
 * `buildSdkContractSnapshot()`。
 */
module.exports = {
  ...require('./sdkApiContract'),
  ...require('./commandProtocol'),
  ...require('./sensorFrameV1'),
};
