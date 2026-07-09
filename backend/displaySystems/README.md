# Display Systems

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
