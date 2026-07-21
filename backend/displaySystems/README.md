# Display Systems

## 2026-07-14 Manifest v2

页面新建配置的实际目录：

- 开发环境：`<projectRoot>/display-systems/<系统ID>/`。
- 打包环境：Electron `app.getPath('userData')/display-systems/<系统ID>/`；Windows 默认通常位于 `%APPDATA%/Shroom/display-systems/<系统ID>/`。
- 固定文件：`display-system.json`、`line-order.json`、`point-order.json`；使用 JSON 后端算法时还会生成 `algorithm-data.json`。

`display.sidebar` 配置左侧可视化数据面板。`pressure` 可选择总压力、平均压力、最大压力、有效点数和面积，并指定主指标；`area` 可设置有效点阈值、单点面积和面积单位。该面板始终基于映射后的原始压力矩阵统计，不受 `normalize/threshold/smooth` 等前端可视算法影响。

页面配置器的串口主流程按传输形式、是否按分隔符分包、波特率、分隔符/完整帧字节数和 8/12 Bit 数据精度组织。协议模板提供经典 8 Bit 帧、经典 12 Bit ADC 和固定长度原始帧三种选择；12 Bit 使用 `uint16le` 两字节承载，固定帧长度按矩阵点数自动计算。数据展示继续提供热力图总览和数字矩阵。模板参数由 `GET /api/display-systems/catalog` 返回，选择后写入标准 `protocol`、`display` 和 `metadata.builder` 字段。

算法输出支持两种兼容返回值：旧算法继续返回 `number[]`；需要向页面暴露业务结果的算法返回 `{ data, metrics }`。`metrics` 只接受有限数字、字符串或布尔值，并通过实时帧的 `algorithmMetrics` 发布。页面 JSON 算法也可以在 `algorithm-data.json.metrics` 声明安全聚合指标，例如：

```json
{
  "metrics": [
    {
      "id": "supportRate",
      "operation": "activeRatio",
      "threshold": 20,
      "scale": 100
    }
  ]
}
```

左侧通过 `display.sidebar.algorithmMetrics` 定义标签、单位和精度，再使用 `algorithm.supportRate` 作为面板指标或主指标。

采集开启时，带 `displaySystemId` 的帧会以对象格式保存通道矩阵、`normalizedData`、`algorithmMetrics` 和 `metrics`。通用回放服务会恢复这些字段，因此算法指标可以在实时和历史模式下复用；旧设备的数组存储格式保持不变。

运行时按展示系统逐项绑定；协议注册或算法模块初始化失败时，该系统会进入 `error` 状态并记录原因，不会阻止其他展示系统和后端服务启动。

`display.renderers`、`display.visualizationAlgorithms` 和 `display.profiles` 构成可复用的展示方案目录。每个 profile 可以选择已有渲染器、可视算法和 widgets；主前端会显示方案/渲染方式/可视算法菜单，并按展示系统保存用户选择。内置可视算法为 `identity`、`normalize`、`threshold`、`smooth`，只作用于绘制数据，采集、回放、CSV 和压力统计继续使用后端标准矩阵。

`#/display-systems` 是页面配置器。它通过 `GET /api/display-systems/catalog` 获取可选协议、算法和渲染目录，通过 `POST /api/display-systems` 将 manifest、线序、点位和算法数据安全写入用户目录；保存后 discovery、runtime registry、parser binding 和 dispatcher 会原地重建，无需再次重启。

Manifest v2 在原有线序、点位和算法数据文件基础上，增加可执行串口协议、结构化页面和算法模块契约。v1 配置继续兼容；新系统应使用 `schemaVersion: 2`。

```text
custom-system/
  display-system.json
  line-order.json
  point-order.json
  algorithm-data.json
  algorithm.js            # algorithm.type=js 时可选
  assets/                 # 模型和纹理等可选资源
```

核心数据流：

```mermaid
flowchart LR
  Manifest["display-system.json"] --> Parser["Dynamic Serial Parser"]
  Parser --> Decode["Protocol Decode"]
  Decode --> Mapping["Line / Point Mapping"]
  Mapping --> Algorithm["JSON / Sandboxed JS Algorithm"]
  Algorithm --> Pipeline["Realtime / Collection Pipeline"]
  Manifest --> Page["Display Page Metadata"]
  Page --> Main["Main Client"]
  Page --> SDK["Frontend SDK Registry"]
```

`protocol` 当前支持：

- `framing.type=delimiter`：按字节序列分帧。
- `framing.type=fixedLength`：按固定字节长度分帧。
- `decoding.valueType`：`uint8/int8/uint16le/uint16be/int16le/int16be`。
- `decoding.byteOffset/valueCount`：从帧中选择压力数据区域。

`display.views/widgets` 使用结构化定义，内置页面容器支持 `heatmap`、`matrix`、`raw2d` 和 `pressureStats`。复杂模型继续通过受信任 renderer 插件扩展，不允许 manifest 注入任意 React 代码。

算法执行规则：

- `none`：不执行算法。
- `json`：执行 `scale/offset/clamp/zeroBelow` 数值操作。
- `js`：加载 `algorithm.entry`，在无 `require/process` 的 VM context 中同步执行并限制超时；模块必须 `module.exports = (values, context) => number[]`。
- `python/external`：契约保留，但当前必须注册专用 runner，否则返回明确错误。

打包后自定义目录为 Electron `userData/display-systems/`。应用启动会创建并扫描该目录；通过页面配置器新增或修改时会立即重新发现和绑定，手工复制文件后可调用 `POST /api/display-systems/reload`。

## 2026-07-08 Runtime 调度策略

Display Systems 现在不会无条件监听 legacy parser channel。默认保护的通道是 `sit`、`back`、`head`、`sensor`，避免新 manifest runtime 和旧 `sensors/runtime` 同时消费同一帧导致重复入库、重复推送或状态竞争。

可用的 `metadata.runtimeMode`：

| 值 | 含义 |
| :--- | :--- |
| `template` | 只作为迁移模板参与发现和校验，不挂 parser listener。 |
| `parallel` | 允许与 legacy runtime 并行监听同一 parser，并正常发布输出，用于灰度验证。 |
| `shadow` | 允许监听同一 parser 并执行 processor，但不发布到 `frameOutputPipeline`。 |
| `active` | 准备接管 legacy parser channel；必须由启动侧显式开启 `allowActiveDisplaySystem` 才会生效。 |
| `disabled` | 显式禁用实时调度。 |

新增模板：

| 目录 | 用途 |
| :--- | :--- |
| `examples/jqbed-manifest-demo/` | jqbed 真实传感器迁移模板，使用 32x32 矩阵和 sit 通道。 |
| `examples/hand-glove-manifest-demo/` | hand glove 迁移模板，展示 sit/back 双通道 manifest 结构。 |

`backend/displaySystems` 是配置驱动展示系统的后端基础层。

目标不是立刻替换现有传感器 runtime，而是先定义一个稳定边界：以后新增展示系统时，可以把线序、点位顺序、算法数据和展示元数据放到一个目录里，由加载器统一发现、校验和注册。

## 目录约定

一个展示系统目录至少包含：

```text
my-system/
  display-system.json
  line-order.json
  point-order.json
  algorithm-data.json
```

`display-system.json` 示例：

```json
{
  "schemaVersion": 1,
  "id": "seat-64x64-demo",
  "name": "Seat 64x64 Demo",
  "version": "0.1.0",
  "sensor": {
    "type": "seat64x64",
    "matrix": {
      "rows": 64,
      "cols": 64
    },
    "ports": ["sit"]
  },
  "files": {
    "lineOrder": "line-order.json",
    "pointOrder": "point-order.json"
  },
  "algorithm": {
    "type": "none",
    "dataFile": "algorithm-data.json"
  },
  "display": {
    "views": ["heatmap"]
  }
}
```

## 模块职责

| 文件 | 职责 |
| :--- | :--- |
| `displaySystemConfigValidator.js` | 校验 manifest 的最小契约：系统身份、矩阵尺寸、线序文件、点位文件和算法声明。 |
| `displaySystemConfigLoader.js` | 从目录中发现 `display-system.json` 或 `system.json`，解析相对文件路径，并可校验引用文件是否存在。 |
| `displaySystemRegistry.js` | 保存已校验的展示系统配置，提供注册、查询、列表和快照能力。 |
| `index.js` | 对外统一导出 displaySystems 能力。 |

## 后续接入顺序

1. 把现有固定传感器逐步生成对应 manifest。
2. 在 HTTP 层增加展示系统查询接口。
3. 前端根据 manifest 动态生成展示页面。
4. 打包后从外部用户目录加载自定义展示系统。

## 2026-07-07 运行时发现和 HTTP 入口

| 文件/接口 | 用途 |
| :--- | :--- |
| `displaySystemRuntimeDiscovery.js` | 运行时发现服务。负责拼装资源目录和可写目录下的扫描根、加载 manifest、注册配置，并向 HTTP/SDK 层提供状态快照。 |
| `GET /api/display-systems` | 查询当前已发现的展示系统列表、扫描目录和加载错误。 |
| `GET /api/display-systems/:id` | 查询单个展示系统 manifest 解析结果。 |
| `GET /api/sdk/contract` | 在 `displaySystems` 字段中暴露 manifest 版本、候选文件名、HTTP 路由和当前发现状态。 |

下一步迁移重点：让 manifest 进一步生成 runtime processor 绑定，再逐步替换固定写死的传感器展示系统。

## 2026-07-07 Runtime 定义生成

| 文件/能力 | 用途 |
| :--- | :--- |
| `displaySystemDefinitionBuilder.js` | 把 manifest 转成 `sensorDefinition`、`parserChannels` 和 `displayMetadata`，供后续串口 manager、parser channel 和前端动态展示复用。 |
| `displaySystemRuntimeDiscovery.js` | 发现 manifest 后会把配置增强为 `runtimeDefinition`，`GET /api/display-systems` 的状态中包含 `runtimeDefinitions`。 |
| `displaySystemRegistry.js` | 快照增加 `parserChannelCount` 和 `defaultView`，列表页可以直接看出每个展示系统会生成多少 parser channel。 |

当前仍不直接打开串口，也不接管实时帧处理；它已经从“配置发现层”前进到“runtime 定义生成层”。后续要做的是把这些定义交给串口 manager / runtime registry 执行。

## 2026-07-07 Runtime Channel Plan

| 文件/能力 | 用途 |
| :--- | :--- |
| `displaySystemRuntimeChannelPlanner.js` | 把 `runtimeDefinition.parserChannels` 转成可执行计划，明确 serial role、parser channel、lineOrder、pointOrder、algorithm 和 display metadata 之间的绑定关系。 |
| `runtimeDefinition.runtimeChannels` | HTTP 状态中可见的实时链路计划；当前状态为 `planned`，表示只规划、不打开串口、不消费实时帧。 |

这一步让 manifest 已经能描述“应该怎么接入实时链路”。真正执行计划的下一步应放在 serial manager / runtime registry，而不是 WebSocket handler 里。

## 2026-07-07 Runtime Registry 与 Binding

| 文件/能力 | 用途 |
| :--- | :--- |
| `displaySystemRuntimeRegistry.js` | 把 `runtimeDefinition.runtimeChannels` 注册成运行时通道记录，供后续串口绑定和状态查询使用。 |
| `displaySystemFrameProcessorFactory.js` | 读取 `line-order.json`、`point-order.json`、`algorithm-data.json`，生成通用帧处理器。 |
| `displaySystemRuntimeBinder.js` | 解析 serial role、parser channel、frame processor 和 `frameOutputPipeline` 输出函数，生成可执行绑定记录。 |
| `GET /api/display-systems` | 返回 `runtimeDefinitions`、`runtimeChannelRegistry` 和 `runtimeBindings`。 |

状态含义：

- `planned`：manifest 已经能描述实时链路，但还只是计划。
- `registered`：runtime channel plan 已进入运行时注册表。
- `bound`：该通道已经解析到 parser channel 和输出 pipeline，可以处理配置化帧。

当前仍不自动打开串口。Display Systems 的绑定层只建立“如果这个 serial role 有数据，应该使用哪个 parser、哪个 JSON mapper、输出到哪个 pipeline”的关系；COM 口打开、关闭、重连继续由 `serialManager` 和现有控制命令负责。

## 2026-07-07 实时 Dispatcher

Display Systems 现在已经不是只停留在 `planned` 状态。启动期会经历三步：

1. `displaySystemRuntimeChannelPlanner.js` 从 manifest 生成 `runtimeChannels`。
2. `displaySystemRuntimeRegistry.js` 注册 runtime channel plan。
3. `displaySystemRuntimeBinder.js` 解析 parser、processor 和输出 pipeline 后，由 `displaySystemRuntimeDispatcher.js` 挂到 `serialParserManager.onData(...)`。

实时数据流：

```mermaid
flowchart LR
  Parser["serialParserManager parser"] --> Dispatcher["displaySystemRuntimeDispatcher"]
  Dispatcher --> Processor["displaySystemFrameProcessorFactory"]
  Processor --> Pipeline["frameOutputPipeline"]
  Pipeline --> Realtime["WebSocket realtime channels"]
```

`displaySystemFrameProcessorFactory.js` 会把处理结果同时写入 `data` 和兼容字段：

- `sit` -> `sitData`
- `back` -> `backData`
- `head` -> `headData`

这样新配置化展示系统可以复用旧的实时输出和采集管线。

## 2026-07-07 配置校验

`displaySystemConfigFileValidator.js` 会在 manifest 加载时校验配置文件：

- `line-order.json`：必须是正整数顺序，不能超过矩阵总点数。
- `point-order.json`：矩阵尺寸必须匹配 sensor matrix，点坐标不能越界。
- `algorithm-data.json`：数值参数必须是 number，operation 类型必须受支持。

`examples/byte-matrix-demo/` 是完整样板目录，包含 `display-system.json`、`line-order.json`、`point-order.json` 和 `algorithm-data.json`。

## 2026-07-08 真实传感器迁移模板

`examples/small-bed-12b-manifest-demo/` 是第一个真实传感器类型的 manifest 模板：

- `sensor.type` 使用现有 registry 中的 `smallBed12B`。
- `sensor.matrix` 保持真实的 `32 x 32`。
- `line-order.json`、`point-order.json`、`algorithm-data.json` 使用小样本子集，目的是固定配置格式和校验规则。
- 当前模板不替代 `backend/sensors/runtime/smallBed12BRuntime.js`，只作为后续真实迁移的起点。
