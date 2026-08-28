# 后端稳定内核

> 最后更新：2026-08-28

`backend/kernel/` 按产品能力组织 Electron 后端中由 Shroom 应用维护的稳定链路。

| 目录 | 职责 |
| --- | --- |
| `platform/` | 启动、生命周期、命令、HTTP、WebSocket、授权与运行状态 |
| `serial/` | 应用侧串口控制、通道编排和运行时装配 |
| `storage/` | 数据库装配、历史查询、会话和维护 |
| `playback/` | 历史帧构造与回放定时器 |
| `csv/` | 历史数据 CSV 导出 |
| `realtime/` | 实时帧管线、分发和 telemetry 网关 |
| `algorithm-channel/` | Node/Python 算法调用、JQBed 配置协议和宠物看护运行时 |

协议解析、串口底层、采集、通用存储和数据处理以 `sdk/backend/` 为单一实现来源。`kernel` 只负责应用装配，不复制 SDK 实现。

原 `backend/server`、`backend/services`、`backend/serial`、`backend/db` 等旧物理路径及其兼容转发层已经移除。新增应用代码应直接引用当前 `kernel` 路径或 `@shroom/backend/...` 公共入口。

`backend/runtime/index.js` 是 Electron 固定桥；不得因为内部重构而改变其路径和外部导出。协议、线序、点序、标定、历史磁盘格式也不应在目录整理中改变。

`platform/runtime/` 是 server 进程状态源码，`platform/websocket/` 是三路实时传输与兼容入口；
它们分别在目录内 README 说明逐文件职责。仓库根 `runtime/` 只是忽略的运行产物，不能与前两者混用。
