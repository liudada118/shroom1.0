# 数据与控制链路

> 当前实现核对：2026-09-11。本文从实际函数追踪数据，不把设计目标当作已实现功能。
> 开发者入口：[开发者手册](../developer-guide.md)。字段的权威定义：[多传感器稳定契约](../../sdk/backend/contract/multiSensorStableContract.json)。

[文档导航](../README.md) · [前端界面与渲染](interface-flow.md)

## 1. 先区分四种数据

| 对象 | 产生位置 | 消费位置 | 不要混淆 |
| --- | --- | --- | --- |
| 串口字节 / 分帧结果 | SerialPort、Parser | 设备处理器 | 1028 字节不等于 1028 个压力点 |
| 内部处理帧 | legacy 或 Manifest processor | 扣零、存储、实时网关 | 内部仍可能有 `sitData/backData/headData` |
| 标准 `sensor.frame` | `buildSensorFrameEnvelope` | ChannelBus、WebSocket、前端 | 外部消费者不能依赖内部旧字段 |
| 历史行 | SQLite `matrix` 表 | 回放、CSV | `data` 可能是旧数组或 Manifest 对象，不是统一的 wire 帧 |

主链路与旁路的关系：

```text
串口字节 → parser
  ├─ legacy：型号专用 processor
  └─ Manifest：校验 → 解码 → 线序/点位 → 可选算法 → 扣零
        ↓
内部帧 → FrameOutputPipeline
          ├─ CollectionFrameStorage → 入库队列 → SQLite
          └─ publishRealtimeChannel → 标准帧网关 → ChannelBus → WS :19999
                                                    └─ 算法超市 → HTTP 结果快照

历史行 → 回放 payload → publishRealtimeFrame(source=playback) → 同一标准帧网关
历史行 → CSV 导出器 → 每通道文件 + 身份清单
```

实时、存储、算法、显示各自可能限频；屏幕 Hz 不是入库帧率，也不是 Python 实际计算频率。

## 2. 点击连接、清零、采集后，命令去了哪里

**入口**：[controlRoutes.js](../../backend/kernel/platform/http/controlRoutes.js) 的 `registerControlRoutes/dispatchCommand`。

1. 新代码发送 `POST /api/commands`，载荷为 `{ type, payload, requestId }`。
2. `createControlCommandService.executeHttp` 补上传输上下文，交给 `createControlCommandRouter.handle`。
3. Router 先规范命令，再按注册顺序运行匹配的 `when/handle`；一个命令可能命中多个 handler。
4. HTTP 层返回执行摘要；格式错误、无处理器、处理失败分别产生相应错误回执。

| 命令领域 | 真实处理入口 | 状态归属 |
| --- | --- | --- |
| 串口开关 / 系统切换 | [serialControlService](../../backend/kernel/serial/serialControlService.js) 的 `registerSerialControlHandlers` | runtimeContext、SerialManager 的配置和 worker |
| 开始 / 停止采集 | [runtimeControlService](../../backend/kernel/platform/commands/runtimeControlService.js) 的 `updateCollectionControl` | collectionStateStore 的 `flag/saveTime/collectOptions` |
| 播放 / 暂停 / 定位 | 同文件 `updateHistoryPlayback` | playbackStateStore 的 `history/playFlag/nowIndex/interval` |
| 清零 | [zeroCommandService](../../backend/kernel/platform/runtime/zeroCommandService.js) | [zeroStateStore](../../backend/kernel/platform/runtime/zeroStateStore.js) 按通道和阶段保存基准 |
| CSV | `runtimeControlService.exportHistoryCsv` → `csvDownloadService.exportHistoryCsv` | 导出任务局部状态、系统事件 |

动态 `serialRole` 在 [controlCommandRouter](../../backend/kernel/platform/commands/controlCommandRouter.js) 的 `normalizeDynamicSerialCommand` 中适配；`armLeft` 等角色不靠增加固定 `sit/back/head` 分支。

**回执的边界**：命令被处理不等于设备已经产帧；串口 open、binding bound、收到有效 `sensor.frame` 是三个不同检查点。CSV 命令回执也不等于磁盘文件已经写完，应继续看完成事件。

**现存兼容口**：[webSocketHandlerFactory](../../backend/kernel/platform/websocket/webSocketHandlerFactory.js) 的 `message` 仍调用 `executeWs`。该方法拒绝同时带 `payload/requestId` 的新信封，但旧扁平命令仍会进入 Router。这是旧客户端兼容，不是新开发应选的第二套控制 API。

**定位失败**：查 HTTP `code/message/requestId`、Router `results/ok` 和对应 handler；不要只看请求是否返回 200 或函数是否抛错。

测试入口：[commandApi](../../backend/tests/http/commandApi.test.js)、[controlCommandRouter](../../backend/tests/platform/controlCommandRouter.test.js)、[serialControlService](../../backend/tests/application/serialControlService.test.js)、[zeroCommandService](../../backend/tests/platform/zeroCommandService.test.js)。

## 3. 串口字节如何变成一帧

**生命周期入口**：[serialManager.js](../../sdk/backend/serial/serialManager.js) 的 `registerPort/start/stop/reconnectPort`。配置表记录逻辑端口，worker 持有实际 SerialPort、数据 handler、连接状态；parser 不负责打开设备。

**分帧入口**：[serialParserManager.js](../../sdk/backend/serial/serialParserManager.js) 的 `createParserFromProtocol/registerChannel/pipe/onData`。

- `delimiter`：`DelimiterParser` 按配置的分隔字节切分；是否把分隔符保留在结果里取决于 `includeDelimiter`。
- `fixedLength`：`FixedLengthParser._transform` 缓存字节，够 `frameLength` 就取一块；当前实现不搜索帧头，也不自动重同步。
- 内置旧通道使用预建 delimiter parser；Manifest 可注册独立 parser channel。

例如当前 [standard-1024](../../sdk/backend/protocol/presets/standard-1024.json) 是 `1000000 baud + AA 55 03 99 delimiter + uint8 × 1024 + byteOffset=0`。不能因为总线上一包含 1024 点与 4 个分隔字节，就自行替换成 `fixedLength=1028`。

协议目录通过 `/api/serial/protocols` 暴露；探测入口是 `/api/serial/protocol-detect` 对应的路由常量，准确 URL 以 [sdkApiContract](../../sdk/backend/contract/sdkApiContract.js) 为准。探测是一次有界设备操作，不等于任意错误配置运行后都会自动修复。

**异常定位顺序**：COM 状态 → 当前角色的 parser 配置 → parser 是否产帧 → 帧校验结果 → 解码点数。串口开着但没有画面时，先不要改 CSS 或补零伪造矩阵。

测试入口：[serialParserManager](../../backend/tests/serial/serialParserManager.test.js)、[serialProtocolPresets](../../backend/tests/serial/serialProtocolPresets.test.js)、[serialProtocolDetector](../../backend/tests/serial/serialProtocolDetector.test.js)、[serialProtocolProbeService](../../backend/tests/serial/serialProtocolProbeService.test.js)。

## 4. legacy 与 Manifest 如何处理数据

### 4.1 legacy：已有型号专用处理

[legacySerialRuntimeBinding](../../backend/extensions/built-in-sensors/legacySerialRuntimeBinding.js) 注册 sit、back、head 等 handler；[legacySerialFrameRuntime](../../backend/extensions/built-in-sensors/legacySerialFrameRuntime.js) 的 `handleSitSerialFrame/handleBackSerialFrame` 再按型号分派。

1024 压力垫、分包手套、低密度矩阵等各自有解码和点位规则；某些专用设备还进入原生 Python 流程。不能把所有旧系统都当成已迁移到 Manifest processor。

处理结果经 `colOrSendData/colOrSendData1/colOrSendData2` 接入输出管线；这些名称属于内部兼容层，前端网络帧已使用标准身份。

状态包括型号专用分包缓存、运行时参数和零点阶段；出现半帧、左右手错位，应先查对应 processor，不要在标准帧网关“猜”修正。

测试入口：[legacySerialFrameRuntimeState](../../backend/tests/server/legacySerialFrameRuntimeState.test.js)。

### 4.2 Manifest：每个传感器一条处理通道

入口是 [displaySystemRuntimeBinder](../../backend/extension-host/runtime/displaySystemRuntimeBinder.js) 的 `bindDisplaySystemRuntimeChannels` 与 [Dispatcher](../../backend/extension-host/runtime/displaySystemRuntimeDispatcher.js) 的 `start/bindOne`。

Binder 创建处理器和发布器；Dispatcher 把 `binding.handleFrame` 订阅到指定 parser。只有符合运行策略的 `bound` binding 才接收；`shadow` 模式可以处理但不发布。

`handleFrame` 先用 `captureFrameContext` 保存主机收到帧时的时间与物理串口快照，避免异步算法完成前重连导致旧帧被标成新 COM。此时间不是设备硬件采样时间。

[displaySystemFrameProcessorFactory](../../backend/extension-host/runtime/displaySystemFrameProcessorFactory.js) 的 `processFrame` 按以下顺序执行：

| 阶段 | 输入 → 输出 | 关键行为 |
| --- | --- | --- |
| 校验 | parser 数组 → 通过或 dropped 结果 | `validateFrame` 在解码前检查；保留 dropReason/dropDetail |
| 解码 | 协议字节 → `rawData` | `decodeProtocolValues` 按位宽、偏移、点数读取 |
| 映射 | rawData → `normalizedData` | `executeConfiguredMapping` 执行线序与点位定义 |
| 算法 | normalizedData + 上下文 → data/metrics | 支持配置运算、JS、Python；可同步或 Promise |
| 扣零 | 算法输出 → processed data | 先保存未扣零源，再应用通道 processed 基准 |
| 组装 | 阶段数据 + 指标 + 身份 | 输出内部对象，再由 Binder 补入串口与入口时间 |

基础压力指标由 `buildPressureMetrics` 计算；算法指标放在独立 `algorithmMetrics`，内部还投影到 `metrics.algorithm`，避免覆盖总压力等同名指标。

**状态归属**：线序/点位 JSON 懒加载缓存在 processor；文件保存后必须重建/重绑处理器才会读到新定义。零点仓库与多传感器聚合器不由单个 UI 组件持有。

**异常定位**：校验丢帧看 processor 返回；绑定失败看 binding status；策略拒绝看 Dispatcher `skippedBindings`；异步错误看 `[DisplaySystems] async runtime frame dispatch failed`。不要把 `published:true` 当作 WebSocket 已送达证明，要继续看输出结果与网关。

测试入口：[runtimeBinding](../../backend/tests/displaySystems/runtimeBinding.test.js)、[runtimeDispatcher](../../backend/tests/displaySystems/runtimeDispatcher.test.js)、[protocolValidation](../../backend/tests/displaySystems/protocolValidation.test.js)、[zeroStateStore](../../backend/tests/server/zeroStateStore.test.js)。

## 5. 标准帧与多传感器身份

[frameOutputPipelineService](../../backend/kernel/realtime/frameOutputPipelineService.js) 的 `publishSit/Back/Head/Aux` 分别调用存储与实时发布；legacy 零点适配在这里补齐，Manifest 已处理的帧避免重复扣零。

[server.js](../../backend/kernel/platform/server.js) 的 `publishRealtimeChannel` 阻止实时帧混入回放，并按规则限发送频率；之后进入 [realtimeTelemetryGateway](../../backend/kernel/realtime/realtimeTelemetryGateway.js) 的 `publishRealtimeFrame`。

网关先调用 [sensorFrameEnvelope](../../backend/kernel/realtime/sensorFrameEnvelope.js) 的 `buildSensorFrameEnvelope` 做白名单投影，再按 canonical channel 递增序号，先发布 ChannelBus，最后交 WS 订阅管理器。

| 字段 | 用途 |
| --- | --- |
| `displaySystemId`、`sensorId` | 展示系统与系统内传感器的稳定身份 |
| `channelId` | `${displaySystemId}:${sensorId}`，订阅、历史与导出隔离键 |
| `sensorLabel` | 人能读懂的“左手 / 右手 / 靠背”，可读名称不代替主键 |
| `outputChannel` | 内部输出别名；不能拿它代替完整通道身份 |
| `serial` | 本帧来源的角色、COM、波特率、parser 等快照 |
| `source`、`sequence`、`timestamp` | 实时/回放来源、通道发布序号、帧时间 |
| `payload.value` | 当前对外展示值数组，不是串口原始字节 |
| `payload.stages` | decoded、normalized、calibrated、processed、mapped；未知阶段保留 null |
| `payload.matrix/metrics/algorithmMetrics/history` | 形状、指标、算法结果及回放对齐信息 |

坏数值可投影为 `null`；不存在的阶段不能拿 processed 冒充 raw。标准帧允许的情况不代表每个算法都接受，例如 Python 超市要求输入为完整有限数值矩阵。

[websocketRuntimeFactory](../../backend/kernel/platform/websocket/websocketRuntimeFactory.js) 只创建一个 WS Server，默认 `19999`；[SubscriptionManager](../../backend/kernel/platform/websocket/websocketSubscriptionService.js) 按 channel 管订阅，不是每个串口开一个 WebSocket 端口。

**状态与诊断**：ChannelBus 保存通道最新帧，网关持有每通道 sequence，SubscriptionManager 持有客户端订阅。序号是网关发布序号，不是设备每个物理采样的序号，网关之前的限频不会体现在序号缺口中。

测试入口：[realtimeTelemetryGateway](../../backend/tests/ws/realtimeTelemetryGateway.test.js)、[framePipelineFactory](../../backend/tests/server/framePipelineFactory.test.js)。

## 6. 算法有三条路径，选择前先看影响范围

| 路径 | 输入位置 | 输出去向 | 是否改变采集数据 |
| --- | --- | --- | --- |
| 旧系统专用算法 | 型号处理流程 | 旧内部 payload、专用指标 | 取决于型号，不能一概而论 |
| Manifest processing.algorithm | 映射后、扣零前 | 主链路 data + algorithmMetrics | 是，主链路存储的是处理后的内部帧 |
| 算法超市会话 | ChannelBus 标准实时帧旁路 | HTTP 快照 → 左侧图表 | 否，不回写标准帧或历史 |

### 6.1 Manifest JS / Python 与 V2 聚合

[displaySystemAlgorithmRunner](../../backend/kernel/algorithm-channel/displaySystemAlgorithmRunner.js) 的 JS runner 加载模块后在 VM 内同步执行；模块状态可跨帧保留，VM 不是防恶意代码的安全边界。

Python runner 经 [pythonWorker.callPy](../../backend/kernel/algorithm-channel/pythonWorker.js) 调用 [Python worker](../../python/app/onbed_filter_example.py) 的 `run_display_system_algorithm`：

- V1 调用算法导出的 `calculate`。
- V2 使用 `initialize(config, resources) → process(request)`，以及显式 `reset(reason)/shutdown()` 生命周期。
- runner 每实例最多一个执行中请求和一个待处理请求；新请求替换旧排队请求，后者以 `DISPLAY_ALGORITHM_FRAME_DROPPED` reject，不是无限排队。

多传感器由 [displaySystemFrameAggregator](../../backend/extension-host/runtime/displaySystemFrameAggregator.js) 的 `update/buildSnapshot` 按 `displaySystemId/sensorId` 保存最新映射矩阵。包声明所需 sensors、triggerSensor、maxAgeMs 和同步策略；缺路、过期或 strict 时间差过大时不执行融合算法，但传感器本身仍可输出映射数据及 inputStatus。

`latest/strict` 是软件配帧策略，不提供硬件同步采样。聚合输入带每路身份、矩阵、rawData、normalizedData 和时间，不是直接拼成一个失去来源的大数组。

**异常边界**：主链路算法抛错会使该次处理无法产出完整帧；Dispatcher 捕获后继续接后续帧。不能把超市的“异常不阻断主画面”保证套到所有主链路算法上。

测试入口：[algorithmPackage](../../backend/tests/displaySystems/algorithmPackage.test.js)、[Python V2](../../python/tests/test_display_system_algorithm_v2.py)、[内置算法包](../../python/tests/test_builtin_algorithm_packages.py)。

### 6.2 算法超市是实时会话旁路

[algorithmMarketService](../../backend/extension-host/runtime/algorithmMarketService.js) 的 `receive` 订阅 `channelBus('*')`，只接受当前系统、`source=realtime` 的标准帧；`toggle` 根据 packageId/channelId 创建或销毁 runner。

它优先使用 normalized 阶段，没有则使用 value；legacy 帧若缺 matrix，只能从身份吻合的已登记型号定义补充，不能猜方阵、截断或补零凑数。

启用门槛：授权有效、非回放、通道最近两秒收到帧、形状和点数匹配、数值有效、包未被当前系统占用。需要融合输入的包不能直接挂到单通道开关，必须在系统配置绑定。

实例状态由服务持有；切系统、授权失效、进入回放会停用实例。每包仅可占一个通道，避免 Python 按 entry 缓存的模块被重复初始化。

结果只保留包声明的有限指标，按 500ms 时间桶保存，最多 120 个点；[httpAppFactory](../../backend/kernel/platform/http/httpAppFactory.js) 的 `GET/POST /api/algorithm-market` 提供快照与启停。它不是回放历史，也不永久保存用户本次勾选。

**呼吸的准确含义**：当前 [mattress-vitals](../../agent-resources/algorithm-packages/mattress-vitals/algorithm.py) 输出 `respirationRate` 等算法标量，明确不输出压力代理波形。以标量队列绘图是“呼吸率趋势”，不是原始呼吸波形。CoP 先独立计算，原生生命体征库失败时仍返回 CoP，并置 `onbedFilterHealthy=0`。

**排查**：画面有数据但按钮灰，先看 `snapshot.channels[].inputError/live`、包 compatibility/reserved；运行后无指标看 instances 的 status/error/dropped。不得通过压力趋势伪装成呼吸算法成功。

测试入口：[algorithmMarket](../../backend/tests/displaySystems/algorithmMarket.test.js)、[algorithmMarketApi](../../backend/tests/http/algorithmMarketApi.test.js)。

## 7. 开始采集后保存了什么

`updateCollectionControl` 设置采集会话；开始时重置存储时钟，停止时 flush 队列。`saveTime` 是整场会话的分组键，单帧 timestamp 则用于时间对齐，二者不能互换。

[collectionFrameStorageService](../../sdk/backend/collection/collectionFrameStorageService.js) 的 `store/canStore` 要同时满足：采集 flag、当前通道存储频率、磁盘空间；Manifest 还检查身份与 `stored !== false`。有实时流不表示正在落库。

| 分支 | 库和身份 | `matrix.data` 内容 |
| --- | --- | --- |
| legacy | 当前型号的 db/db1/db2，按旧 sit/back/head 规则 | 原数组或型号专用零点、温度、12B 等对象 |
| Manifest | 当前系统主库，共享库中按 channel_id 隔离 | 处理值、可用原始/映射阶段、算法指标、显示 metadata、身份与串口快照 |

`runtimeSource=display-system` 才进入 Manifest 存储；legacy 帧被补上 canonical 身份，不代表可改变旧历史格式。

[server.enqueueCollectionFrame](../../backend/kernel/platform/server.js) 将 data、timestamp、会话键和身份列送给 [collectionInsertQueueService](../../sdk/backend/collection/collectionInsertQueueService.js) 的 `enqueue`。队列按数据库句柄持有，批量或定时 flush；优先使用 better-sqlite3 transaction。

[dbManager](../../backend/kernel/storage/dbManager.js) 的 `ensureChannelHistorySchema` 维护身份列；不应为第四、第五个传感器继续增加 db3/db4。

存储在实时网络限频之前判断；主链路 Python 则在入库之前，因此启用它可能降低可入库的处理帧率。“串口全速保存”不等于保存了算法之前每个原始字节包。

**异常定位**：查 flag/collectOptions → canStore → 入库队列 → SQLite。空间不足或 SQLITE_FULL 会触发停采集和错误事件；入队成功不是事务已提交，停止和退出时必须保留 flush 链路。

测试入口：[channelHistoryStorage](../../backend/tests/collection/channelHistoryStorage.test.js)、[collectionDiskSpaceGuard](../../backend/tests/collection/collectionDiskSpaceGuard.test.js)。

## 8. 历史回放怎样恢复多路画面

入口是 [server.loadSelectedHistory/publishPlaybackFrame](../../backend/kernel/platform/server.js)。[historyQueryService](../../backend/kernel/storage/history/historyQueryService.js) 的 `queryHistoryChannels/createChannelHistoryRowsForPlayback` 按会话发现通道、读取或懒加载历史行，结果保存在 playbackStateStore。

Manifest 路径调用 [channelPlaybackService.buildChannelPlaybackFrames](../../backend/kernel/playback/channelPlaybackService.js)：

1. 选取回放锚点通道及该索引的 timestamp。
2. 其他通道用 `findNearestTimestampRowIndex` 取邻近时间行，而不是假设各串口相同索引同时采样。
3. 从历史行恢复身份和当时的串口快照，输出 `history.sourceIndex/alignedAt/skewMs`。
4. 单路损坏跳过该路；旧数组历史则由 [playbackFrameService.buildPayloads](../../backend/kernel/playback/playbackFrameService.js) 处理型号差异。

发布直接走 `publishRealtimeFrame(..., {source:'playback'})`，绕过 FrameOutputPipeline 和存储层，再使用相同标准网关。**回放帧不会重新被采集写入，也不会重新跑 Manifest 主链路算法。** 超市明确不消费回放。

这不等于回放会自动关闭所有串口或清除采集 flag：实时发布门与采集状态是两个独立控制点，排查时分别检查。

**异常定位**：无历史先查会话与 channel_id；一路错位看 sourceIndex/skewMs；实时与回放交替看 source 和 publishRealtimeChannel 的回放门；暂停仍变动看播放定时器与 nowIndex。

测试入口：[channelPlaybackService](../../backend/tests/playback/channelPlaybackService.test.js)、[playbackFrameService](../../backend/tests/server/playbackFrameService.test.js)。

## 9. CSV 如何区分左手、右手、座椅与靠背

入口：[csvDownloadService.exportHistoryCsv](../../backend/kernel/csv/csvDownloadService.js)，数据来自历史库，不从当前画布或算法超市读取。

- `discoverSources` 在当前库组发现 canonical 通道；旧 `channel_id IS NULL` 行保留 legacy 分支，不能混入新通道查询。
- `downloadOptions.channelIds` 可精确选择通道；提供空数组会失败，不视作“下载所有”。
- `exportChannel` 按通道查询、按选定历史范围构造记录；每通道导出独立 CSV。
- `downloadOptions.rangeMode: 'full'` 忽略当前 `runtime.historyArr`，导出该日期完整记录；门户批量下载明确使用此选项。未指定时保持旧的回放选区行为，不通过修改回放全局状态实现完整导出。
- Manifest 文件名含展示系统、sensorLabel/sensorId、通道哈希与会话名；列及返回 artifacts 保留稳定身份和串口来源。
- `publishProgress/publishResult` 发进度与结果；结果包含 files/artifacts/skippedChannels，失败可能已写出部分通道文件，必须检查清单。

`sensorLabel` 帮人识别左右手，`channelId` 防同名混淆，历史串口快照解释当时来自哪一个 COM；当前插拔后 COM 改号不会重命名历史通道。

**边界**：当前服务按单通道读历史并构造记录后写文件，不是整个导出链路的流式恒定内存实现；不能只凭“支持 CSV”声称任意体量都已压测稳定。`smoothValue=0` 在当前控制服务只是状态写入，不能据此声称导出重新计算或取消了算法处理。

测试入口：[csvDownloadService](../../backend/tests/csv/csvDownloadService.test.js)。

## 10. 按症状缩小排查范围

| 现象 | 最先检查 | 不要先做 |
| --- | --- | --- |
| COM open，但没有任何标准帧 | parser framing、校验、binding policy、处理器异常 | 改渲染尺寸、伪造零帧 |
| 压力画面正常，算法不能启用 | matrix/点数/有限值、inputError、reserved | 重复启动 Python 模块 |
| 不同传感器数据串了 | 三段身份、订阅 channelId、历史 channel_id | 用 COM 或 label 作为长期主键 |
| 实时顺畅但采集缺尾帧 | 采集率、主链路算法丢帧、flush | 把屏幕 Hz 当入库频率 |
| 回放某路不连贯 | 记录时间、锚点、sourceIndex/skewMs | 强制所有通道使用相同数组索引 |
| 呼吸库异常而 CoP 还在变 | onbedFilterHealthy 与算法返回指标 | 把 CoP 正常当作呼吸算法健康 |

本文仅做静态源码核对；没有启动服务、连接硬件或运行上述测试。修改这些共享数据边界时按 [验证索引](../../ARCHITECTURE_INDEX.md) 选择 Full，不能以文档核对替代运行验证。


### HaLow 人体 TCP 数据源

`humanBodyOptimized`（人体全身传感）及其原生副本可通过 `halow.control` HTTP 命令启动接收。`backend/kernel/transport/halowReceiver.js` 按连接解析 ID 和 1024 字节帧，`halowService.js` 只把当前所选设备交给原有 SIT 处理器；后续归零、采集数组格式、回放/CSV 和规范帧发布使用上述同一链路。设备 ID 不替代系统或副本身份。启动与串口互斥，采集时禁止换设备；进入回放或换系统后停止实时接收。详见 [HaLow 接入](../halow-human-body.md)。
