# 平台进程运行态

> 最后更新：2026-08-28

这里保存的是 `kernel/platform/server.js` 进程内的状态与迁移适配代码，不是根目录
`runtime/` 运行产物，也不是 Electron 固定入口 `backend/runtime/index.js`。

## 四种同名目录

| 路径 | 性质 | 是否源代码 |
| --- | --- | --- |
| `runtime/` | 开发态导出、上传、日志与临时文件 | 否，整体不提交 |
| `backend/runtime/index.js` | Electron 固定后端桥 | 是，路径和契约不可变 |
| `backend/kernel/platform/runtime/` | server 进程状态、命令 patch 和 legacy 迁移层 | 是，本目录 |
| `backend/extension-host/runtime/` | 展示系统发现后的通道规划、绑定和调度 | 是，不保存 server 通用状态 |

## 逐文件职责

当前 7 个 JavaScript 文件均在生产链路使用。

| 文件 | 作用 | 处理结论 |
| --- | --- | --- |
| `runtimeStateStore.js` | 通用内存状态仓库，支持自持 state、代理 accessor、patch、snapshot 和后绑定 | 核心原语，必须保留 |
| `runtimeStateStoreFactory.js` | 定义 server 主状态默认值与 store-backed keys，并创建 accessor | 保留；已吸收单调用方 bindings factory |
| `runtimeContextFactory.js` | 提供传感器类型、波特率、日期、回放和数据库等语义化只读上下文 | 保留，支持 store 未装配时的旧变量回退 |
| `runtimeStatePatchFactory.js` | 将旧 WS/串口命令 patch 分流到采集、回放、串口 store 或兼容 setter | 保留；旧命令彻底迁移前不能删 |
| `legacyRuntimeAccessorFactory.js` | 拼装旧串口帧 runtime 所需的状态、归零和端口 accessor | 保留；未来应归入内置传感器扩展 |
| `zeroStateStore.js` | 初始化坐面、靠背、头枕、手套与 legacy 分段协议的零点基准 | 保留，涉及实时数据语义 |
| `zeroCommandService.js` | 捕获当前源帧为零点，或清空全部零点基准 | 保留，涉及归零时序 |

本轮已将只有一个调用方的 `legacyStateBindingsFactory.js` 内联到
`runtimeStateStoreFactory.js`，并把 WebSocket 专属 accessor 内联回
`platform/websocket/webSocketContextFactory.js`。文件由 9 个减为 7 个，字段名、默认值、
命令 key、初始化顺序和对外导出行为不变。

## 后续优化边界

低到中风险的目录归位可以把这里最终收敛为 `runtimeStateStore.js`、
`serverRuntimeStateFactory.js` 和 `serverRuntimeContext.js` 三个核心文件：

- 将旧串口 accessor 归入 `extensions/built-in-sensors/`；
- 将命令 patcher 归入 `platform/commands/`；
- 将 zero store 与 command service 归入 `kernel/realtime/`。

这些迁移需先补归零 capture/clear、命令 key 路由和初始化顺序测试。彻底移除 fallback、
late bind 和旧可变变量会影响帧与命令状态时序，属于后续高风险改造，本轮不做。
