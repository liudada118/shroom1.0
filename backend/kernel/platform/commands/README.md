# 控制命令

> 最后更新：2026-08-29

HTTP 和旧 WebSocket 两个入口共用同一套命令处理。这个目录就是那个"同一套"——传输无关，谁调都是一样的行为。

链路：入口（HTTP / WS）→ `controlCommandService` → `controlCommandRouter` → 各 handler。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `commandRouter.js` | 最基础的路由器，38 行。`register(type, handler)` 按类型字符串注册，`has(type)` 查询，`dispatch` 派发。内部一个 `Map` | 按**类型名**匹配。注册时校验 type 非空且 handler 是函数，不合规直接抛错——注册期报错比运行期静默丢命令好 |
| `controlCommandRouter.js` | 业务路由器。用 `@shroom/backend/contract/commandProtocol.js` 校验命令信封（`isCommandEnvelope` / `validateCommandEnvelope` / `normalizeCommand`），并把串口角色名归一化（`normalizeSerialRole`）。导出 `createControlCommandRouter`、`normalizeDynamicSerialCommand` | 按**消息形状**匹配（`when` 谓词），不是按类型名。这是它和 `commandRouter.js` 的关键区别，见下面 |
| `controlCommandService.js` | 薄薄一层应用服务。HTTP 和 WebSocket 都调它，入口层不再直接依赖 WS command router | 构造时就校验 `commandRouter.handle` 存在，缺了立刻抛。命令执行失败时打 warn 然后**重新抛出**——不吞异常，让调用方决定怎么回给前端 |
| `registerRuntimeCommandHandlers.js` | 注册那些不碰串口的控制命令：显示参数、历史回放播放状态、采集开关和频率、CSV 导出、历史删除 | 只注册，不实现。实现在 `runtimeControlService.js` |
| `runtimeControlService.js` | 上面那些命令的实际实现。承接显示配置、历史回放、采集控制、运行参数、历史维护、CSV 导出 | 全依赖注入（`csvDownloadService`、`getRuntime`/`setRuntime`、`startPlaybackTimer`、`flushCollectionInsertQueues`……），自己一个 require 都没有 |

## 两个路由器为什么并存

它们的匹配方式不一样，不是重复实现：

- `commandRouter.js` 按 `type` 字符串路由。`backend/runtime/index.js` 用它，把 `serial` / `license-check` / `export-csv` / `db-query` / `ws-send` 五类命令转给旧 server。
- `controlCommandRouter.js` 按消息形状路由——handler 声明成 `{ name, when, handle }`，`when(message)` 判断这条消息长得像不像自己该处理的。

后者是为了兼容旧前端：旧页面发的是扁平 JSON（`{ file: 'bed4096' }`、`{ local: true }`），根本没有 type 字段。要支持它们，只能靠猜形状。新代码走 HTTP 的话会带规范的命令信封，`validateCommandEnvelope` 就能真正校验。

## 边界

- 串口相关的命令不在这里，在 `kernel/serial/serialControlService.js`（那边注册了 7 个）。分界线是"要不要碰物理串口"。
- 命令信封的格式定义在 `@shroom/backend/contract/`，是公共契约。改它属于破坏性 API 变更。
- `runtimeControlService` 的依赖列表就是它的接口。加依赖等于改签名，`server.js` 那边要跟着传。
