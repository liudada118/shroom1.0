# WebSocket 传输与兼容入口

> 最后更新：2026-08-29

本目录只负责一个共享 WebSocket Server 的传输、连接、订阅和发布。控制、配置、查询与导出
优先走 HTTP；旧页面仍可发送的扁平 WebSocket 命令只在这里保留入口，命令路由和业务实现已
分别归入 `platform/commands` 与 `kernel/playback`。

## 当前 5 个生产文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `websocketRuntimeFactory.js` | 创建唯一的 `19999` Server、订阅管理器、ChannelBus 和实时 telemetry gateway | 每个 runtime 只创建一个 Server |
| `websocketTransportService.js` | 处理 ping/pong 心跳和 JSON 消息解码 | 不识别业务命令，不读写运行状态 |
| `websocketChannelService.js` | 统一端口、动态逻辑通道元数据、payload 序列化、广播与连接统计 | 通道来自 manifest/SerialManager，不维护固定通道表 |
| `websocketSubscriptionService.js` | 维护客户端与 channel/scope 映射，处理订阅 ACK，并按订阅精确发布 | 保留 `*` 默认订阅以兼容旧页面 |
| `webSocketHandlerFactory.js` | 给共享连接挂载心跳、消息入口、授权状态和旧命令兼容处理 | 只注册一次 `connection`，不实现历史或控制业务 |

## 已归位的职责

| 新路径 | 作用 |
| --- | --- |
| `platform/commands/controlCommandRouter.js` | HTTP 与旧 WebSocket 共用的传输无关命令路由 |
| `platform/commands/registerRuntimeCommandHandlers.js` | 注册显示、回放状态、采集、运行参数、历史维护和 CSV 控制 handler |
| `platform/runtime/legacyWebSocketContext.js` | 把旧变量与运行态 store 组装为 WebSocket handler 兼容上下文 |
| `kernel/playback/historyAnalysisService.js` | 实现历史差值、框选统计、曲线统计、跳帧和旧清零命令 |

原有 10 个 JavaScript 文件都在生产调用链中，因此本轮没有误删业务；4 个错放职责被迁出，
心跳与 JSON 解析两个小服务合并后，本目录由 10 个生产文件收敛为 5 个。

## 当前链路

```text
Electron 固定桥 backend/runtime/index.js
  -> kernel/platform/server.js
     -> websocketRuntimeFactory
        -> shared WebSocket.Server :19999
        -> websocketSubscriptionService
        -> websocketChannelService
        -> ChannelBus + RealtimeTelemetryGateway
     -> legacyWebSocketContext
     -> webSocketHandlerFactory
        -> controlCommandService（仅旧 WS 命令兼容）

HTTP /api/*
  -> controlCommandService
  -> controlCommandRouter
  -> runtime / serial / playback / csv handler
```

## HTTP 与 WebSocket 分工

- HTTP：串口开关、传感器切换、采集、回放控制、历史查询/维护、CSV 导出和通用命令。
- WebSocket：实时订阅、压力帧、回放帧、系统状态事件及旧扁平命令兼容。
- JQBed 的 `get/set/resetJqbedAlgorithmConfig` 仍是当前前端唯一直接走旧 WebSocket 的控制例外；
  本轮为保持行为不变未迁移，后续应先补等价 HTTP API 和兼容测试。

旧客户端连接 `19999` 后默认订阅 `*`，继续接收 `sitData/backData/headData`；新客户端可发送
`subscribe/unsubscribe/getSubscriptions` 精确选择 manifest 声明的任意逻辑通道。
Electron `getWsServer(channel)`、SDK、硬件协议、历史数据格式和现有消息字段均未改变。
