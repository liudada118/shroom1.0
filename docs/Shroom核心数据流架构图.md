---
mindmap-plugin: basic
---

# Shroom 传感器系统核心数据流架构图

## 总览架构

-
  ```mermaid
  flowchart LR
    HW["硬件传感器 / CH340 串口"] --> Serial["serialManager<br/>串口生命周期"]
    Serial --> Parser["serialParserManager<br/>命名 Parser"]
    Parser --> Runtime["sensor runtimes<br/>协议解析 + 分帧处理"]
    Runtime --> Pipeline["frameOutputPipeline<br/>实时帧管线"]
    Pipeline --> Gateway["realtimeTelemetryGateway<br/>标准 telemetry"]
    Gateway --> Bus["ChannelBus<br/>通道总线"]
    Bus --> WS["WebSocket 订阅推送"]
    WS --> UI["前端展示 / SDK 订阅"]

    Pipeline --> Collection["collection services<br/>采集入库"]
    Collection --> DB["SQLite 历史数据"]
    DB --> History["history playback<br/>历史回放"]
    History --> Pipeline

    SDK["SDK"] --> Contract["sdkApiContract<br/>稳定 API 契约"]
    Contract --> HTTP["HTTP 控制 API"]
    Contract --> WS
    UI --> HTTP
    Control --> Serial
    Control --> Collection
    Control --> History
  ```

## 分层结构

- 前端展示层
	- 系统入口
	- 传感器页面
	- 实时热力图
	- 3D 展示
	- 历史回放
	- CSV 下载
	- 报告展示
- SDK / API 层
	- 契约发现
	- HTTP 控制
	- WS 订阅
	- channel 选择
	- 历史查询
	- 导出封装
- 应用控制层
	- 控制命令统一入口
	- 串口控制
	- 采集控制
	- 回放控制
	- 导出控制
	- 旧 WS 命令兼容
- 实时数据层
	- frameOutputPipeline
	- realtimeTelemetryGateway
	- ChannelBus
	- WebSocket 订阅
	- telemetry 标准化
- 传感器协议层
	- registry 类型注册
	- runtime 注册
	- processor 分帧
	- normalizer 归一化
	- legacy 协议兼容
- 串口硬件层
	- 串口扫描
	- 端口角色
	- parser 绑定
	- 自动重连
	- CH340 过滤
- 数据资产层
	- 实时帧
	- 采集帧
	- 历史帧
	- CSV 文件
	- PDF 报告

## 核心实时数据流

-
  ```mermaid
  sequenceDiagram
    participant HW as 硬件传感器
    participant SM as serialManager
    participant PM as serialParserManager
    participant RT as sensor runtime
    participant FP as frameOutputPipeline
    participant GW as telemetryGateway
    participant CB as ChannelBus
    participant WS as WebSocket
    participant UI as 前端展示

    HW->>SM: 原始串口字节流
    SM->>PM: 按端口角色写入 parser
    PM->>RT: channel onData(buffer)
    RT->>RT: 协议识别 / 分片拼接 / 零点扣除
    RT->>FP: 标准实时 payload
    FP->>FP: JSON 解析 / 采集判断
    FP->>GW: 发布实时 telemetry
    GW->>CB: 归一化 channel
    CB->>WS: 按订阅推送
    WS->>UI: 热力图 / 3D / 指标刷新
  ```

## 采集存储数据流

-
  ```mermaid
  flowchart TD
    Start["HTTP startCollection"] --> Control["controlCommandService"]
    Control --> RuntimeControl["runtimeControlService"]
    RuntimeControl --> CollectionState["collectionStateStore<br/>flag / saveTime / colHZ / options"]
    RuntimeControl --> Clock["collectionStorageClock<br/>采集频率时钟"]

    Payload["实时 payload"] --> Pipeline["frameOutputPipeline"]
    Pipeline --> Check{"采集中?"}
    CollectionState --> Check
    Check -->|"否"| RealtimeOnly["只实时推送"]
    Check -->|"是"| StorageFrame["collectionFrameStorageService"]
    StorageFrame --> Queue["collectionInsertQueue<br/>批量写入"]
    Queue --> DB["SQLite"]
    DB --> HistoryIndex["历史日期 / 时间索引"]
  ```

## 历史回放数据流

-
  ```mermaid
  sequenceDiagram
    participant UI as 前端 / SDK
    participant HTTP as HTTP 控制 API
    participant RC as runtimeControlService
    participant HQ as historyQueryService
    participant HT as historyFrameTransformService
    participant PS as playbackStateStore
    participant Timer as playbackTimer
    participant FP as frameOutputPipeline
    participant WS as WebSocket

    UI->>HTTP: loadHistory(date)
    HTTP->>RC: 统一控制命令
    RC->>HQ: 查询历史帧
    HQ->>HT: matrix 行解析 / payload 转换
    HT->>PS: 写入回放缓存
    UI->>HTTP: startPlayback
    HTTP->>RC: 开始回放
    RC->>Timer: 启动定时器
    Timer->>PS: 读取当前帧索引
    Timer->>FP: 回放帧复用实时管线
    FP->>WS: 推送给前端展示
  ```

## 控制命令流

-
  ```mermaid
  flowchart TD
    UI["前端控制面"] --> HTTP["HTTP 控制 API"]
    SDK["SDK 调用方"] --> HTTP
    LegacyWS["旧 WebSocket 命令"] --> WsRouter["webSocketCommandRouter"]

    HTTP --> Control["controlCommandService"]
    WsRouter --> Control

    Control --> SerialControl["serialControlService"]
    Control --> RuntimeControl["runtimeControlService"]

    SerialControl --> SensorType["切换传感器类型"]
    SerialControl --> PortOpen["打开 / 关闭串口"]
    SerialControl --> LocalReplay["local 回放切换"]

    RuntimeControl --> Collection["开始 / 停止采集"]
    RuntimeControl --> Playback["历史加载 / 播放 / 暂停"]
    RuntimeControl --> Export["CSV 导出"]
    RuntimeControl --> Config["显示配置"]
  ```

## 传感器协议流

-
  ```mermaid
  flowchart LR
    Registry["sensors/registry<br/>类型 + 能力定义"] --> RuntimeRegistry["sensorRuntimeRegistry"]
    Parser["serialParserManager"] --> Binding["bindSerialSensorRuntimes"]
    Binding --> RuntimeRegistry
    RuntimeRegistry --> Hand["handPacketRuntime"]
    RuntimeRegistry --> SmallBed["smallBed12BRuntime"]
    RuntimeRegistry --> Legacy["legacySerialFrameRuntime"]

    Legacy --> Sit1024["sit1024FrameProcessor"]
    Legacy --> BackHead1024["backHead1024FrameProcessor"]
    Legacy --> Generic["legacyGenericMatrixFrameProcessor"]
    Legacy --> BigBed["legacyBigBedFrameProcessor"]
    Legacy --> Segmented["legacySegmentedFrameProcessor"]

    Hand --> Output["标准 payload"]
    SmallBed --> Output
    Sit1024 --> Output
    BackHead1024 --> Output
    Generic --> Output
    BigBed --> Output
    Segmented --> Output
    Output --> Pipeline["frameOutputPipeline"]
  ```

## 模块边界

- `server/`
	- 启动编排
	- bootstrapServer
	- HTTP app 创建
	- WS server 创建
	- 依赖注入
	- 旧兼容入口
- `serial/`
	- 串口扫描
	- 串口生命周期
	- parser 管理
	- 串口过滤
- `sensors/`
	- 类型注册
	- 协议定义
	- runtime 绑定
	- processor 拆分
- `services/`
	- 实时管线
	- 采集入库
	- 历史查询
	- 回放定时
	- CSV 导出
	- WS 连接服务
- `application/`
	- 控制命令聚合
	- 串口用例
	- 运行时用例
	- HTTP / WS 入口复用
- `channel/`
	- ChannelBus
	- telemetry channel
	- 订阅语义
- `runtime/`
	- runtimeStateStore
	- zeroStateStore
	- zeroCommandService
	- legacyRuntimeAccessorFactory
	- webSocketContextAccessorFactory
	- 旧状态兼容
	- 命令路由基础
- `http/`
	- 控制路由
	- 报告路由
	- SDK 友好入口
- `contracts/`
	- HTTP 路由契约
	- 串口角色契约
	- WS 消息契约
	- telemetry 数据契约
- `ws/`
	- 实时订阅
	- 旧命令路由
	- 兼容处理

## 关键运行路径

- 传感器输入
	- 串口扫描
	- 端口打开
	- 字节流读取
	- parser 分帧
	- runtime 分发
- 协议处理
	- 帧头识别
	- 分片拼接
	- 线序转换
	- 零点扣除
	- payload 构造
- 实时展示
	- telemetry 标准化
	- channel 发布
	- WebSocket 推送
	- 前端渲染
	- SDK 订阅
- 采集入库
	- 采集开关
	- 频率控制
	- 批量队列
	- SQLite 写入
	- 磁盘保护
- 历史回放
	- 日期查询
	- 帧读取
	- payload 转换
	- 定时回放
	- 复用实时展示
- 导出报告
	- 历史读取
	- CSV 生成
	- canvas 上传
	- Python 指标
	- PDF 输出

## 当前架构风险

- 主服务仍偏大
	- `server.js` 仍承担较多初始化
	- runtime accessor 仍集中
	- legacy 兼容链路仍长
- legacy 协议仍重
	- 旧帧类型多
	- 状态写回复杂
	- 与新 runtime 边界未完全切开
- 控制入口双轨
	- HTTP 是推荐入口
	- WS 仍有旧命令
	- 前端需要逐步迁移
- 状态中心未完全独立
	- collection 已迁移
	- playback 已迁移
	- legacy cache 已迁移
	- zeroState 已迁移
	- zeroCommand 已迁移
	- 端口实例已归 serialManager
	- legacy accessor 已迁入 factory
	- WebSocket context accessor 已迁入 factory
	- 部分启动动作已迁入 bootstrapServer
	- app runtime 依赖图仍需继续收敛
- 算法与矩阵工具偏散
	- `processing/openWeb.js` 仍较重
	- 线序映射可继续按传感器归属

## 新节点

- 协议契约层
	- 帧长度定义
	- channel 定义
	- payload schema
	- telemetry schema
	- 错误码定义
- 设备会话层
	- deviceId
	- sensorType
	- portRole
	- sessionId
	- capability
- 状态中心
	- collectionState
	- playbackState
	- zeroState
	- portState
	- handState
- SDK 契约
	- `/api/sdk/contract`
	- HTTP 控制
	- WS 订阅
	- 类型声明
	- 示例工程
	- 版本兼容
- 测试节点
	- parser 测试
	- processor 测试
	- telemetry 测试
	- HTTP 控制测试
	- 历史回放测试
