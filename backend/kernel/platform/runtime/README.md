# 平台进程运行态

> 最后更新：2026-08-29

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

当前 10 个 JavaScript 文件均在生产链路使用。

| 文件 | 作用 | 处理结论 |
| --- | --- | --- |
| `runtimeStateStore.js` | 通用内存状态仓库，支持自持 state、代理 accessor、patch、snapshot 和后绑定 | 核心原语，必须保留 |
| `runtimeStateStoreFactory.js` | 定义 server 主状态默认值与 store-backed keys，并创建 accessor | 保留；已吸收单调用方 bindings factory |
| `runtimeContextFactory.js` | 提供传感器类型、波特率、日期、回放和数据库等语义化只读上下文 | 保留，支持 store 未装配时的旧变量回退 |
| `runtimeStatePatchFactory.js` | 将旧 WS/串口命令 patch 分流到采集、回放、串口 store 或兼容 setter | 保留；旧命令彻底迁移前不能删 |
| `legacyRuntimeAccessorFactory.js` | 拼装旧串口帧 runtime 所需的分片状态和端口 accessor | 保留；未来应归入内置传感器扩展 |
| `legacyWebSocketContext.js` | 把旧变量 accessor 与 store accessor 组装为 WebSocket handler 上下文 | 兼容适配职责归入 runtime，不再占用 WebSocket 传输目录 |
| `zeroStateStore.js` | 按完整 channelId 保存四阶段 source/baseline，并负责捕获、清除和安全扣零 | 保留，涉及实时数据语义 |
| `zeroChannelIdentityResolver.js` | 将 manifest 通道或无 manifest 的旧输出解析为稳定 canonical identity | legacy 兼容只允许在这里生成 fallback channelId |
| `zeroFrameAdapter.js` | 在入库/发布前给内部 legacy payload 记录和应用 channel-aware 零点，并返回 `zeroedStages` | 依据 `runtimeSource` / `zeroApplied` 跳过 Manifest 或已扣零帧；不能仅凭是否带 channelId 判断 |
| `zeroCommandService.js` | 按 displaySystemId/channelIds 定向捕获或清除基准 | 旧 resetZero 只作为命令输入兼容，不再映射固定字段 |

此前已将只有一个调用方的 `legacyStateBindingsFactory.js` 内联到
`runtimeStateStoreFactory.js`。本轮把旧 WebSocket handler 的状态适配从传输目录迁入
`legacyWebSocketContext.js`。随后零点状态迁移到 canonical channel，旧 runtime/WebSocket accessor
不再暴露零点字段，新增 identity resolver 与 legacy frame adapter；legacy 帧可通过 `zeroStorageStage`
声明入库数组对应的基准阶段，网络输出仍遵守唯一 `sensor.frame` 契约。

## 后续优化边界

低到中风险的目录归位可以把这里最终收敛为 `runtimeStateStore.js`、
`serverRuntimeStateFactory.js` 和 `serverRuntimeContext.js` 三个核心文件：

- 将旧串口 accessor 归入 `extensions/built-in-sensors/`；
- 将命令 patcher 归入 `platform/commands/`；
- 将 zero store、identity resolver、frame adapter 与 command service 归入 `kernel/realtime/`。

归零 capture/clear、命令目标、legacy adapter 与多展示系统隔离已有回归测试。彻底移除无 manifest
传感器的 fallback、late bind 和其余旧可变变量仍会影响帧与命令状态时序，属于后续高风险改造。
