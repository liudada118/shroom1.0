# Shroom 业务定义与功能实现

## 文档范围

- 本文只描述两件事：
	- 业务定义：系统里的业务对象、业务模块、业务流程分别是什么。
	- 功能实现：这些功能在当前项目中大致由哪些前端、后端、SDK 模块实现。
- 本文不包含：
	- 产品战略
	- 增长规划
	- 商业分析
	- 指标体系
	- 未来路线图
	- 非当前代码支撑的设想

## 系统业务定义

- Shroom 是一个本地桌面压力传感器采集与展示系统。
- 核心业务闭环是：
	- 授权进入系统
	- 选择传感器或展示方案
	- 连接串口设备
	- 接收实时压力数据
	- 解析传感器协议
	- 前端实时展示
	- 执行清零或校准
	- 开始采集
	- 保存采集数据
	- 历史回放
	- 导出 CSV 或报告
- 系统运行形态是 Electron 桌面应用。
- 前端负责页面、交互和可视化。
- 后端负责串口、协议、实时数据、采集、存储、回放、导出。
- SDK 负责把后端能力封装给 demo、测试或外部调用。

## 业务对象定义

### 授权 License

- 业务定义：
	- 授权用于控制用户是否能进入系统。
	- 授权用于控制用户可使用哪些传感器方案。
	- 授权用于控制不同客户看到的功能范围。
- 当前实现：
	- 前端入口包含 LicensePortal 和 License 页面。
	- 前端通过 WebSocket 或服务消息接收授权状态。
	- 后端和 SDK 中存在 LicenseService。
	- 项目文档中维护了授权 key 与传感器方案的关系。

### 传感器类型 SensorType

- 业务定义：
	- 传感器类型代表一个具体硬件或一个具体展示方案。
	- 不同传感器类型决定协议解析方式、展示页面、矩阵结构、导出结构。
- 当前实现：
	- 前端路由中包含多个传感器展示入口。
	- 前端 Title 和相关配置中维护了传感器名称与类型。
	- 后端 sensors、processing、displaySystems 中承载传感器运行逻辑。
	- SDK 和测试中包含协议、线序、采集、回放相关能力。
- 当前主要类型包括：
	- hand
	- hand0205
	- hand0205Double
	- handGlove115200
	- handGloveFullPacket
	- handSinglePoint
	- footVideo
	- robot1
	- robotSY
	- robotLCF
	- bed4096
	- bed4096num
	- jqbed
	- smallBedNoAlg
	- smallBed12B
	- petCare
	- petCareMini
	- wholeChair
	- minzhen
	- humanBody
	- fast256
	- fast1024
	- normal

### 串口 Port

- 业务定义：
	- 串口是系统连接硬件设备的入口。
	- 用户通过串口选择具体采集设备。
	- 串口状态决定是否可以实时接收数据。
- 当前实现：
	- 后端使用 serialport 处理串口连接。
	- 后端 SerialManager 管理串口生命周期。
	- 后端 SerialParserManager 负责把串口数据交给协议解析。
	- SDK demo 中提供了串口链路示例。

### 原始数据 RawData

- 业务定义：
	- 原始数据是硬件通过串口发出的字节流。
	- 原始数据不能直接用于业务展示，需要经过解析。
- 当前实现：
	- 后端串口模块读取原始数据。
	- parser 根据协议边界拆包。
	- ProtocolRegistry 或具体 parser 将原始数据转为业务帧。

### 数据帧 Frame

- 业务定义：
	- 数据帧是一次解析后的传感器业务数据。
	- 一帧可以表示压力矩阵、点位压力、姿态、温度、生命体征或其他传感器值。
	- 实时展示、采集保存、历史回放都围绕 Frame 运行。
- 当前实现：
	- 后端协议解析器生成 Frame。
	- sensors runtime 和 processing 模块处理 Frame。
	- frameOutputPipeline 负责把 Frame 转成可输出事件。
	- WebSocket 将 Frame 或处理后的事件推送给前端。

### 压力矩阵 Matrix

- 业务定义：
	- 压力矩阵是传感器点位数据的二维结构。
	- 用于床垫、小床、脚底、座椅、整椅、高速矩阵等展示。
	- 矩阵需要明确行列、点位顺序和线序映射。
- 当前实现：
	- 后端 processing 中包含压力转换、线序、点位映射相关逻辑。
	- 前端展示页根据矩阵数据渲染热力图、数字图或定制视图。
	- 测试目录中包含 pressureTransforms、lineOrders、videoPointMappings 等测试。

### 清零基线 ZeroBaseline

- 业务定义：
	- 清零用于把当前压力状态作为基准。
	- 清零后后续数据按基线修正。
	- 清零是传感器采集前常用操作。
- 当前实现：
	- 后端存在 zero state store。
	- SDK 中存在 ZeroCalibrator。
	- 前端通过控制命令触发清零。
	- 后端在后续数据处理中应用清零基线。

### 采集会话 CaptureSession

- 业务定义：
	- 采集会话表示一次从开始采集到停止采集的业务过程。
	- 会话内持续保存实时帧。
	- 会话结束后形成可查询、可回放、可导出的历史记录。
- 当前实现：
	- 后端 collection service 负责采集逻辑。
	- 后端存储使用 SQLite 或内存 store。
	- SDK 中有 CaptureStore 和 MemoryCaptureStore。
	- 前端通过 WebSocket 或 API 触发开始、停止和状态展示。

### 历史记录 HistoryRecord

- 业务定义：
	- 历史记录是已经完成的采集结果。
	- 历史记录用于回放、导出和复盘。
- 当前实现：
	- 后端 history service 管理历史数据查询。
	- playback service 读取历史数据进行回放。
	- 前端历史或回放页面展示历史数据并触发回放。

### 导出任务 ExportTask

- 业务定义：
	- 导出任务用于把采集数据转成 CSV 或报告文件。
	- 导出是系统交付给客户或算法分析的关键结果。
- 当前实现：
	- 后端 export service 负责导出。
	- SDK 中存在 CsvExporter。
	- 前端包含 CSV 下载配置、导出进度和下载入口。
	- OneStep 相关流程包含 PDF 报告能力。

### 展示系统 DisplaySystem

- 业务定义：
	- 展示系统是传感器数据如何在前端被组织、分发和展示的业务抽象。
	- 它用于减少每个传感器单独写一套展示逻辑。
- 当前实现：
	- 后端存在 displaySystems 模块。
	- 后端测试覆盖 displaySystems 配置校验、运行时绑定、通道规划、分发和策略。
	- 前端仍有多个历史页面和定制页面，展示系统正在承担统一化方向。

## 功能实现

### 1. 应用启动

- 业务功能：
	- 启动 Shroom 桌面应用。
	- 加载前端页面。
	- 启动本地后端服务。
- 当前实现：
	- Electron main process 是应用入口。
	- `app/electron/index.js` 启动桌面窗口和相关进程。
	- 前端由 Vite 构建。
	- 后端由 `backend/server/server.js` 组装服务。
	- 打包脚本会复制 DB、Python 或其他资源。

### 2. 授权进入

- 业务功能：
	- 用户输入授权。
	- 系统判断是否允许进入。
	- 系统根据授权决定可用传感器和方案。
- 当前实现：
	- 前端路由包含 `/`、`/license` 等授权相关页面。
	- 前端 WebSocket message service 中有授权消息分类逻辑。
	- 后端或 SDK 中有 LicenseService。
	- 授权配置文档维护了方案和传感器映射。

### 3. 选择传感器或方案

- 业务功能：
	- 用户选择当前要使用的传感器类型。
	- 系统进入对应展示页面。
	- 系统加载对应展示、采集和导出能力。
- 当前实现：
	- 前端 `client/src/App.jsx` 定义多个路由。
	- 路由按传感器或展示类型进入不同页面。
	- `Title.jsx` 和相关配置维护可选传感器列表。
	- 后端通过 runtime、processor、displaySystems 处理对应类型。

### 4. 串口连接

- 业务功能：
	- 获取本机串口。
	- 选择端口。
	- 连接硬件。
	- 返回连接状态。
- 当前实现：
	- 后端 serial 模块管理串口。
	- SerialManager 建立和关闭连接。
	- 前端通过 WebSocket 或 HTTP 命令触发连接。
	- 后端将连接状态推送给前端。
	- SDK demo 验证了串口链路。

### 5. 协议解析

- 业务功能：
	- 把硬件原始数据解析成系统可识别的数据帧。
	- 不同传感器使用不同解析规则。
- 当前实现：
	- SerialParserManager 负责串口数据解析入口。
	- ProtocolRegistry 管理协议解析能力。
	- sensors runtime 和 processor 负责传感器特定处理。
	- 测试覆盖 serialParserManager 和部分传感器 processor。

### 6. 实时数据处理

- 业务功能：
	- 接收连续数据帧。
	- 应用线序、映射、清零、压力转换等处理。
	- 输出前端可展示的数据。
- 当前实现：
	- 后端 processing 模块处理映射和转换。
	- runtime state store 保存运行状态。
	- zero state store 保存清零状态。
	- frameOutputPipeline 统一输出处理后的帧。
	- ChannelBus 或 WebSocket 负责分发。

### 7. WebSocket 实时通信

- 业务功能：
	- 前端发送控制命令。
	- 后端推送实时数据和状态。
	- 系统保持实时交互。
- 当前实现：
	- 后端 ws 模块管理 WebSocket 服务。
	- WebSocket command router 负责命令路由。
	- 前端 `services/ws/messages.js` 构造和解析消息。
	- 前端 `useMainWebSocket.js` 管理主连接。
	- 前端 `controlMessages.js` 处理控制通道消息。

### 8. 前端实时展示

- 业务功能：
	- 把实时压力数据展示给用户。
	- 支持热力图、数字图、3D、床垫、座椅、手套等不同视图。
- 当前实现：
	- React 负责页面组件。
	- Ant Design 负责操作控件。
	- Three.js 负责 3D 展示。
	- ECharts 负责图表。
	- 不同路由页面承载不同展示系统。
	- 前端 hooks 接收 WebSocket 数据后驱动组件更新。

### 9. 清零和校准

- 业务功能：
	- 用户触发清零。
	- 系统保存当前压力基线。
	- 后续数据按基线修正。
- 当前实现：
	- 前端按钮或控制项发送清零命令。
	- 后端 command service 或 runtime 接收命令。
	- zero state store 保存清零状态。
	- ZeroCalibrator 或 processing 模块应用修正。
	- 修正后的数据继续进入实时展示和采集。

### 10. 开始采集

- 业务功能：
	- 用户开始一次数据采集。
	- 系统持续保存实时帧。
	- 采集状态反馈给前端。
- 当前实现：
	- 前端发送开始采集命令。
	- 后端 collection service 创建采集会话。
	- 实时 frame 进入采集服务。
	- 数据写入 SQLite 或 CaptureStore。
	- 前端显示采集状态。

### 11. 停止采集

- 业务功能：
	- 用户停止当前采集。
	- 系统结束采集会话。
	- 系统生成历史记录。
- 当前实现：
	- 前端发送停止采集命令。
	- 后端 collection service 关闭会话。
	- history service 能查询完成后的记录。
	- 前端刷新历史列表或展示采集结果。

### 12. 历史回放

- 业务功能：
	- 用户选择历史采集记录。
	- 系统按时间顺序播放历史数据。
	- 前端像实时数据一样展示回放内容。
- 当前实现：
	- 后端 playback service 读取历史数据。
	- SDK 中有 ReplayService。
	- 回放数据通过 WebSocket 或 API 输出。
	- 前端页面接收回放数据并驱动展示组件。

### 13. CSV 导出

- 业务功能：
	- 用户选择采集数据。
	- 系统导出 CSV 文件。
	- 用户获得可分析、可交付的数据文件。
- 当前实现：
	- 后端 export service 处理导出任务。
	- SDK 中有 CsvExporter。
	- 前端提供 CSV 下载配置和导出进度。
	- 导出结果由前端提供下载入口。

### 14. PDF 或报告生成

- 业务功能：
	- 对特定方案生成报告文件。
	- 报告用于客户交付或业务展示。
- 当前实现：
	- 前端存在 OneStep PDF 相关入口和弹窗。
	- 后端或本地资源负责报告生成。
	- 报告能力与特定传感器方案绑定。

### 15. SDK 调用

- 业务功能：
	- 让 demo、测试或外部脚本调用后端能力。
	- 不依赖前端页面也能访问采集、状态和实时数据。
- 当前实现：
	- SDK 提供 BackendSdkClient。
	- SDK 读取 `/api/sdk/contract` 获取后端契约。
	- SDK 可以读取串口状态、展示系统、实时 WebSocket 数据。
	- SDK demo 覆盖本地串口链路和后端链路。

## 传感器方案实现关系

### 触觉手套

- 业务定义：
	- 用于手部压力或触觉数据采集与展示。
- 当前实现：
	- 前端存在 hand、hand0205、handGlove115200、handGloveFullPacket 等入口。
	- 后端 hand runtime 和 sensor processor 处理相关数据。
	- 授权配置中包含触觉全套相关传感器。

### 脚底压力

- 业务定义：
	- 用于脚底压力视频或压力点位展示。
- 当前实现：
	- 前端包含 footVideo 等类型。
	- 后端通过对应 parser、processor 和输出管线处理。

### 床垫和小床

- 业务定义：
	- 用于床垫压力、小床检测、躺卧状态或健康关怀场景。
- 当前实现：
	- 前端包含 jqbed、bed4096、smallBedNoAlg、smallBed12B 等入口。
	- 后端 smallBed runtime 处理小床相关逻辑。
	- 后端 processing 处理矩阵和映射。
	- 前端提供小床显示配置。

### 宠物看护

- 业务定义：
	- 用于宠物压力或状态看护。
- 当前实现：
	- 授权配置包含 petCare 和 petCareMini。
	- 前端传感器列表包含对应类型。
	- 后端按传感器类型进入对应处理和展示链路。

### 整椅和轮椅

- 业务定义：
	- 用于座椅、整椅、轮椅压力分布展示。
- 当前实现：
	- 授权配置包含 wholeChair 和 minzhen。
	- 前端包含 wholeChair、minzhen、car、sofa 等相关类型。
	- 后端通过矩阵处理和展示系统输出数据。

### 人体全身

- 业务定义：
	- 用于人体区域压力或触觉展示。
- 当前实现：
	- 授权配置包含 humanBody。
	- 前端包含 humanBody 和 3D 相关页面。
	- Three.js 用于部分 3D 展示。

### 高速矩阵

- 业务定义：
	- 用于高采样或高密度矩阵压力数据展示。
- 当前实现：
	- 前端包含 fast256、fast1024、bed4096num 等类型。
	- 后端 parser、processing 和 frameOutputPipeline 处理高频数据输出。

## 当前实现边界

### 前端边界

- 负责：
	- 页面路由
	- 用户操作
	- WebSocket 连接管理
	- 实时数据展示
	- 采集、回放、导出入口
	- 展示配置
- 不应负责：
	- 串口协议解析
	- 核心采集状态判定
	- 后端数据帧业务含义
	- 历史数据落库

### 后端边界

- 负责：
	- 串口连接
	- 协议解析
	- 传感器 runtime
	- 数据处理
	- WebSocket 推送
	- 采集存储
	- 历史回放
	- CSV 导出
	- SDK 契约
- 不应负责：
	- 前端布局
	- 组件交互细节
	- 页面局部 UI 状态

### SDK 边界

- 负责：
	- 封装后端 API
	- 封装实时连接
	- 提供 demo 和测试入口
	- 支持外部集成
- 不应负责：
	- 绕过后端直接改业务状态
	- 替代前端完整交互

## 当前代码中的实现链路

### 实时链路

- 串口设备
	- 输出原始数据
- SerialManager
	- 建立串口连接
	- 接收数据
- SerialParserManager
	- 拆分和解析串口数据
- ProtocolRegistry
	- 匹配具体协议
- sensor processor
	- 生成传感器业务帧
- processing
	- 应用线序、矩阵、清零、压力转换
- frameOutputPipeline
	- 整理输出事件
- WebSocket
	- 推送到前端
- React 页面
	- 渲染实时展示

### 采集链路

- 前端点击开始采集
	- 发送命令
- WebSocket command router
	- 分发命令
- collection service
	- 创建采集会话
- frameOutputPipeline
	- 持续输出数据帧
- CaptureStore 或 SQLite
	- 保存数据
- 前端点击停止采集
	- 结束会话
- history service
	- 生成可查询历史记录

### 回放链路

- 前端选择历史记录
	- 发送回放请求
- history service
	- 查询历史数据
- playback service 或 ReplayService
	- 按时间输出历史帧
- WebSocket 或 API
	- 返回回放数据
- 前端展示页
	- 复用实时展示组件

### 导出链路

- 前端选择导出
	- 设置导出参数
- export service
	- 读取采集或历史数据
- CsvExporter
	- 生成 CSV
- 后端返回进度和结果
	- 前端显示下载状态

## 需要继续保持的拆分方向

### WebSocket

- 只负责：
	- 连接管理
	- 命令接收
	- 命令分发
	- 状态和数据推送
- 不应继续放：
	- 传感器协议逻辑
	- 采集业务细节
	- 导出业务细节
	- 回放业务细节

### 前端页面

- 只负责：
	- 展示
	- 操作入口
	- 用户反馈
- 不应继续放：
	- WebSocket 消息拼接细节
	- 多传感器业务判断
	- 采集流程状态机
	- 导出流程状态机

### 后端服务

- 应继续拆成：
	- serial service
	- parser service
	- sensor runtime
	- processing service
	- collection service
	- history service
	- playback service
	- export service
	- license service
	- sdk service

