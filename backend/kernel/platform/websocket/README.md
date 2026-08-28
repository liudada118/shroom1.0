# WebSocket 传输与兼容入口

> 最后更新：2026-08-28

这里负责三路 WebSocket server、连接与消息处理、订阅发布，以及旧前端命令的兼容入口。
当前 10 个 JavaScript 文件均在生产调用链上，没有可以直接删除的死文件。

## 逐文件职责

| 文件 | 作用 | 处理结论 |
| --- | --- | --- |
| `websocketRuntimeFactory.js` | 创建 sit/back/head server、订阅管理器、ChannelBus 和实时 telemetry gateway | 装配边界，必须保留；已吸收单调用方 ServerFactory |
| `websocketChannelService.js` | 统一三路端口、通道名、原生 client 广播、连接统计和 payload 序列化 | Electron 兼容广播依赖；已吸收 BroadcastService，端口成为单一来源 |
| `websocketSubscriptionService.js` | 维护 client 与 channel/scope 映射，处理订阅 ACK，并按订阅精确发布 | 核心模块，不能简单并入 Handler |
| `webSocketHandlerFactory.js` | 给三路连接挂载业务消息、历史、授权、状态和 ACK 处理 | 有用但偏大，后续按传输/业务分拆 |
| `webSocketContextFactory.js` | 把旧变量 accessor 与 store accessor 组装为 Handler 上下文 | 迁移适配层；已吸收单调用方 ContextAccessorFactory |
| `websocketConnectionService.js` | 挂载 ping/pong 心跳并管理 timer | 当前仅主端口使用；行为调整前保留 |
| `websocketMessageService.js` | 将 Buffer/string 解析为普通 JSON 对象，非法消息记录后丢弃 | 与订阅解析存在重复，但合并会改变消息分发时序 |
| `webSocketCommandRouter.js` | 标准化新旧命令、匹配 handler 并汇总结果/错误 | 同时服务 HTTP，后续应归入 `platform/commands/` |
| `registerRuntimeCommandHandlers.js` | 注册显示参数、回放、采集、运行参数、历史删除和 CSV 命令 | 通用控制命令，后续应归入 `platform/commands/` |
| `webSocketHistoryCommandService.js` | 处理旧回放、差值、框选、历史曲线和归零命令 | 属于 playback 业务，后续应归入 `kernel/playback/` |

本轮删除了三个无独立领域职责的小层：串口命令纯转发文件、单调用方 WebSocket server
factory、广播基础 service。WebSocket 目录由 13 个 JavaScript 文件减为 10 个；调用方仍使用
相同的命令、端口、消息字段和发布路径。

## 当前链路

```text
Electron 固定桥 backend/runtime/index.js
  -> kernel/platform/server.js
     -> websocketRuntimeFactory
        -> sit/back/head WebSocket.Server
        -> websocketSubscriptionService
        -> ChannelBus + RealtimeTelemetryGateway
     -> webSocketContextFactory
     -> webSocketHandlerFactory
        -> command router / history / license / ACK
```

`backend/runtime/index.js` 还暴露一条原生 channel 广播兼容路径，它会绕过订阅管理器。仓库内
暂时没有调用，但属于 Electron 稳定桥契约，不能仅按“当前无调用”删除。

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

下一步应先补端口、默认订阅、ACK、非法消息、历史事件 shape 和 Electron runtime exports
契约测试，再做纯路径迁移。把两个 message listener 合成一个、统一三端口 heartbeat、将
server 事件从 `open` 调整为 `listening` 都会改变运行行为，必须单独评审和真机验证。
