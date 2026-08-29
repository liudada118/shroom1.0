# Runtime：把 Display System 真跑起来

> 最后更新：2026-08-29

`../manifest/` 说明了「有哪些系统、它们想要什么」，这个目录负责让它们真的收到串口数据、真的跑算法、真的把结果发出去。

九个文件是一条流水线，每一段都能单独测：

```
discovery  扫盘 + 建两个注册表 + 处理路径冲突
   ↓
planner    runtimeDefinition → 可执行计划（还不碰硬件）
   ↓
binder     计划 → 真的 parser channel / 真的 frame processor
   ↓
dispatcher parser 的 data 事件 → 已绑定的处理器
   ↓
processor  解帧 → 线序/点序映射 → 算法 → 指标 → 输出
```

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `displaySystemRuntimeDiscovery.js` | 发现层，225 行。`buildDisplaySystemRoots` 算搜索根、`createDisplaySystemRuntimeDiscovery` 扫盘并填两个注册表；`classifyDisplaySystemAccess` / `isPathInside` / `resolveDisplaySystemAccessConflicts` 处理路径归属和冲突 | 路径冲突要显式解决——两个系统声明同一个目录、或用户目录覆盖内置目录，都得有确定的胜出规则，不能靠扫描顺序 |
| `displaySystemRegistry.js` | manifest 级注册表，84 行 | **只保存已通过校验的配置**。不读文件、不开串口、不启动算法。是 HTTP、SDK、前端动态页面共同依赖的稳定边界 |
| `displaySystemRuntimeRegistry.js` | 运行时通道注册表，87 行 | 和上面那个的分界线：上面是「有哪些系统」，这里是「哪些通道已进入运行时装配」。串口绑定、parser 绑定、frame processor 都从这里读计划 |
| `displaySystemRuntimeChannelPlanner.js` | 计划生成，94 行。`buildRuntimeChannelPlan` / `attachRuntimeChannelPlan` | 明确**不**打开串口、**不**创建 parser。只把 runtimeDefinition 整理成串口/parser/lineOrder/pointOrder/algorithm 的可执行计划 |
| `displaySystemRuntimeBinder.js` | 绑定层，143 行。`resolveParserChannel` 解析或注册 parser 通道、`resolveOutputPublisher` 找输出去处、`bindDisplaySystemRuntimeChannels` 完成绑定 | 声明了自定义 protocol 且带 id 的通道走 `registerChannel` 动态注册；否则按 role 复用现有通道 |
| `displaySystemRuntimeDispatcher.js` | 分发层，147 行。`normalizeIncomingFrame` 统一帧形态（Buffer / TypedArray / 数组）、`createDisplaySystemRuntimeDispatcher` 挂到 parser 的 data 事件 | 只把 parser 输出送进**已经绑定**的处理器，不负责绑定本身。是否分发由 policy 决定 |
| `displaySystemRuntimePolicy.js` | 策略层，131 行。运行模式判定（`getRuntimeMode` / `isActiveRuntimeMode` / `isParallelRuntimeMode`）、分发策略（`evaluateDisplaySystemDispatchPolicy`）、绑定属性提取。`DEFAULT_LEGACY_PARSER_CHANNELS` = sit / back / head / sensor | 唯一决定「这一帧要不要给这个系统」的地方。**parallel 模式**让新 Display System 和旧传感器链路同时收同一份数据——这是渐进迁移的关键 |
| `displaySystemRuntimeFactory.js` | 装配入口，107 行。`createDisplaySystemRuntimeController` 组合 binder + dispatcher；`buildRuntimeBindingSnapshot` 导出可观测快照 | 快照给状态查询和调试用，不参与数据流 |
| `displaySystemFrameProcessorFactory.js` | 处理核心，338 行，11 个导出。解帧（`validateFrame` / `decodeProtocolValues`）、配置化映射（`executeConfiguredMapping`）、算法执行（`executeAlgorithm` / `normalizeAlgorithmResult` / `sanitizeAlgorithmMetrics`）、指标计算（`buildPressureMetrics` / `calculateConfiguredMetrics`） | 算法返回的东西**必须**过 `sanitizeAlgorithmMetrics`——算法是用户代码，可能返回 `NaN`、`Infinity`、超长数组或非数字。不过滤就直接进 WebSocket 送给前端 |

## parallel 模式是为迁移准备的

`isParallelRuntimeMode` 允许一个 Display System 和旧的硬编码传感器链路同时处理同一份串口数据。

意义是：把某个传感器从旧代码迁到 Display System 声明时，可以先并行跑，对比两边输出是否一致，确认无误再切掉旧的。没有这个模式，迁移就只能一刀切——而这类改动一旦出错，表现是数据静默地不对，不是崩溃。

## 算法结果必须消毒

`sanitizeAlgorithmMetrics` 和 `normalizeAlgorithmResult` 不是可选的整洁工作。算法入口是 manifest 里声明的用户文件，JS 走 `vm` 沙箱、Python 走子进程，两边都可能返回：

- `NaN` / `Infinity` —— `JSON.stringify` 会变成 `null`，前端画图静默变成 0
- 长度不对的数组 —— 热力图错位
- 非数字类型 —— 前端计算得到 `NaN`，图变空白

这几种情况都不会抛异常。消毒层是唯一的拦截点。

## 边界

- 注册表只存已校验的配置。绕过 `../manifest/` 直接往注册表里塞东西会让下游全部失去校验保证。
- planner 和 binder 的分界线（有没有真的碰硬件）是这个目录可测性的基础，不要在 planner 里打开串口。
- 路径冲突规则改动会影响用户自定义系统能不能覆盖内置系统，属行为变更。
