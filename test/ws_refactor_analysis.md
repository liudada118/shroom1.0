# 多 WS → 单 WS 重构分析

## 当前实现
- 本地后端只创建一个 WebSocket Server：`19999`。
- 逻辑通道由 manifest `outputChannel` 动态生成；`sit/back/head` 只是现有配置的兼容值，旧 payload 仍用 `sitData/backData/headData` 区分。
- 旧客户端默认订阅 `*`；新客户端可通过 `subscribe` 精确订阅逻辑通道。
- 控制命令优先走 HTTP，旧 WebSocket 命令仍在 `19999` 兼容。

## 问题
旧实现同时监听三个端口，会重复维护连接、命令入口和关闭流程；而前端和 SDK 已经只连接
`19999`，逻辑通道由订阅管理器按字符串动态维护，因此新增串口角色或 outputChannel 不需要新增物理端口。

## 优化方案
`websocketRuntimeFactory` 只创建一个 Server；`webSocketHandlerFactory` 只挂载一次
`connection`；`runtime.broadcastRealtime` 统一走订阅管理器和 telemetry 网关；shutdown 只关闭
一次共享 Server。`getWsServer(channel)` 保留原签名，任何逻辑通道都返回同一个实例。

## 影响范围
### 兼容边界
- 仓内生产前端和前后端 SDK 默认都使用 `19999`，无需修改 SDK API。
- 直接连接旧端口的仓外客户端必须改到 `19999`。
- 远端座椅 `23001` 与外部 CAN `29999` 是外部数据源，不是本地后端监听端口。

### 验证
- 单 Server factory 只调用一次。
- 一个连接只挂一个命令入口。
- 默认 `*` 接收三类数据；精确订阅不串台、不重复发送。
- 重复 shutdown 只关闭一次共享 Server。
