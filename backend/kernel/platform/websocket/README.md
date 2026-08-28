# WebSocket 传输与兼容入口

> 最后更新：2026-08-28

这里负责一个共享 WebSocket server、连接与消息处理、订阅发布，以及旧前端命令的兼容入口。
当前 10 个 JavaScript 文件均在生产调用链上，没有可以直接删除的死文件。

## 逐文件职责

| 文件 | 作用 | 处理结论 |
| --- | --- | --- |
| `websocketRuntimeFactory.js` | 创建唯一的 `19999` server、订阅管理器、ChannelBus 和实时 telemetry gateway | 装配边界，必须保留；每次 runtime 只创建一个 Server |
| `websocketChannelService.js` | 统一共享端口、动态逻辑通道名、manifest/SerialManager 通道元数据、原生 client 广播、连接统计和 payload 序列化 | 任意 `outputChannel` 都映射到同一个物理端点，不维护固定通道表 |
| `websocketSubscriptionService.js` | 维护 client 与 channel/scope 映射，处理订阅 ACK，并按订阅精确发布 | 核心模块，不能简单并入 Handler |
| `webSocketHandlerFactory.js` | 给共享连接挂载业务消息、历史、授权、状态和 ACK 处理 | 只注册一次 `connection`，避免命令重复执行 |
| `webSocketContextFactory.js` | 把旧变量 accessor 与 store accessor 组装为 Handler 上下文 | 迁移适配层；已吸收单调用方 ContextAccessorFactory |
| `websocketConnectionService.js` | 挂载 ping/pong 心跳并管理 timer | 当前仅主端口使用；行为调整前保留 |
| `websocketMessageService.js` | 将 Buffer/string 解析为普通 JSON 对象，非法消息记录后丢弃 | 与订阅解析存在重复，但合并会改变消息分发时序 |
| `webSocketCommandRouter.js` | 标准化新旧命令、匹配 handler 并汇总结果/错误 | 同时服务 HTTP，后续应归入 `platform/commands/` |
| `registerRuntimeCommandHandlers.js` | 注册显示参数、回放、采集、运行参数、历史删除和 CSV 命令 | 通用控制命令，后续应归入 `platform/commands/` |
| `webSocketHistoryCommandService.js` | 处理旧回放、差值、框选、历史曲线和归零命令 | 属于 playback 业务，后续应归入 `kernel/playback/` |

此前已删除三个无独立领域职责的小层：串口命令纯转发文件、单调用方 WebSocket server
factory、广播基础 service。当前进一步把三个物理 Server 收敛成一个 `19999` Server；
逻辑 channel 由当前展示系统的 manifest `outputChannel` 和已注册串口动态生成。现有
`sit/back/head` 消息字段、订阅协议和 Electron `getWsServer(channel)` 入口保持不变，但新增
`armLeft` 等通道不需要修改 WebSocket 核心源码。

## 当前链路

```text
Electron 固定桥 backend/runtime/index.js
  -> kernel/platform/server.js
     -> websocketRuntimeFactory
        -> shared WebSocket.Server :19999
        -> websocketSubscriptionService
        -> ChannelBus + RealtimeTelemetryGateway
     -> webSocketContextFactory
     -> webSocketHandlerFactory
        -> command router / history / license / ACK
```

`backend/runtime/index.js` 暴露的 `broadcastRealtime(data, channel)` 保留原签名，但内部统一走
`publishRealtimeFrame`，因此不会绕过订阅管理器，也不会把精确通道数据误发给所有客户端。

## 推荐目标结构

```text
platform/websocket/
├─ websocketRuntimeFactory.js
├─ websocketTransportService.js
├─ websocketPublisher.js
├─ websocketSubscriptionService.js
└─ webSocketHandlerFactory.js

platform/commands/
├─ controlCommandRouter.js
└─ registerControlCommandHandlers.js

kernel/playback/
└─ legacyHistoryCommandService.js
```

旧客户端连接 `19999` 后默认订阅 `*`，继续接收三类旧 payload；新客户端可发送
`subscribe/unsubscribe/getSubscriptions` 精确选择 manifest 声明的任意逻辑通道。直接连接旧 `19998/19997` 的
仓外客户端需要迁移到 `19999`。远端座椅 `23001` 和外部 CAN 页面 `29999` 是外部数据源，
不属于本地 Electron 后端监听端口。
