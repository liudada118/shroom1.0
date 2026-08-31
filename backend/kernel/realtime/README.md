# 实时输出管线

> 最后更新：2026-08-29

串口收到一帧之后到前端看见它之间的全部环节。核心是一条管线做三件事，顺序固定：

```
JSON 文本 → 可入库对象 → legacy channel 零点适配 → 传感器兼容处理 → 同时(写入采集存储 + 发布实时通道)
```

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `frameOutputPipelineService.js` | 管线本体。`createFrameOutputPipeline` 把上面各步串起来 | legacy 帧先经 `zeroFrameAdapter`；适配后同一对象用于入库和发布，并把 `zeroedStages` 返回给调用方同步内部状态。Manifest/已扣零帧按来源标记跳过。敏枕高斯仍在发布前执行 |
| `framePipelineFactory.js` | 装配层，65 行。`createServerFramePipeline` 组合 `@shroom/backend/collection/collectionFrameStorageService.js` 和上面的管线 | `server.js` 不再自己维护 channel → db/db1/db2 的映射，统一从 `runtimeContext` 取。**`isCollecting` 必须传**——缺了就变成「串口一有数据就落库」，见 `collectionFrameStorageService` 的 `canStore` |
| `realtimeFrameDispatchService.js` | 旧函数名适配层，51 行。把 `colOrSendData` / `colOrSendData1` / `colOrSendData2` 三个历史命名收敛到管线上 | 三个名字分别是坐面 / 靠背 / 头枕。纯转发，不含逻辑。存在只为兼容旧串口 runtime，新代码直接用 `frameOutputPipeline` |
| `realtimeTelemetryGateway.js` | 实时帧网关，78 行。`createRealtimeTelemetryGateway` 在唯一的 WebSocket 边界把内部对象转成 `sensor.frame` | **同一物理帧只发布一次**。订阅键和消息身份都用 canonical `channelId`，不用别名。构造时 `channelBus` 缺失直接抛错 |
| `sensorFrameEnvelope.js` | `sensor.frame` 信封的定义与构造，251 行。导出 `SENSOR_FRAME_TYPE`、`SENSOR_FRAME_SCHEMA_VERSION`（**1**）、`buildSensorFrameEnvelope`、`parseFramePayload`、`toNumericArray` | `parseFramePayload` 同时吃对象、Buffer 和 JSON 字符串——三种来源都存在。解析失败返回 `null` 而不抛，由上层决定丢帧还是报错 |

## 为什么落盘和发布在同一步

早期这两件事是分开调的，结果出现过「界面上看到的和存下来的不一致」：兼容处理只在发布路径上做了，落盘路径拿的是原始帧。回放的时候画面和当时实时看到的不一样，但没有任何报错。

现在两者共用同一个处理完的对象。想改其中一路的数据，必须先想清楚另一路要不要跟着变。

## `colOrSendData` 那三个名字

它们是遗留命名，不是三种不同的行为——只是坐面、靠背、头枕三路的入口。`platform/server.js` 里也各有一份同名顶层函数（:1676、:1682、:1692），是同一套东西的另一处入口。

这个目录里的版本是收敛后的实现；`server.js` 那三个属于还没搬完的部分。

## 边界

- `sensor.frame` 的信封格式是前后端契约。改字段要动 `SENSOR_FRAME_SCHEMA_VERSION`，并确认前端能处理旧版本。
- 采集存储的三个前置条件（采集开关 / 频率限流 / 磁盘空间）在 `@shroom/backend/collection/`，不在这里，且**顺序有意义**。
- 网关是唯一的 WebSocket 出口。绕过它直接发帧会破坏「同一帧只发一次」的保证。
