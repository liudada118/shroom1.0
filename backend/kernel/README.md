# 后端稳定内核

> 最后更新：2026-08-29

`backend/kernel/` 按产品能力组织 Electron 后端中由 Shroom 应用维护的稳定链路。

| 目录 | 职责 |
| --- | --- |
| `platform/` | 启动、生命周期、命令、HTTP、WebSocket、授权与运行状态 |
| `serial/` | 应用侧串口控制、通道编排和运行时装配 |
| `storage/` | 数据库装配、历史查询、会话和维护 |
| `playback/` | 历史帧构造与回放定时器 |
| `csv/` | 历史数据 CSV 导出 |
| `realtime/` | 实时帧管线、分发和唯一 `sensor.frame` 封装网关 |
| `algorithm-channel/` | Node/Python 算法调用、JQBed 配置协议和宠物看护运行时 |

协议解析、串口底层、采集、通用存储和数据处理以 `sdk/backend/` 为单一实现来源。`kernel` 只负责应用装配，不复制 SDK 实现。

原 `backend/server`、`backend/services`、`backend/serial`、`backend/db` 等旧物理路径及其兼容转发层已经移除。新增应用代码应直接引用当前 `kernel` 路径或 `@shroom/backend/...` 公共入口。

`backend/runtime/index.js` 是 Electron 固定桥；不得因为内部重构而改变其路径和外部导出。协议、线序、点序、标定、历史磁盘格式也不应在目录整理中改变。

`platform/runtime/` 是 server 进程状态源码，`platform/websocket/` 是单端口、动态多传感器的实时传输入口；
它们分别在目录内 README 说明逐文件职责。仓库根 `runtime/` 只是忽略的运行产物，不能与前两者混用。

## 子目录逐文件说明

> 追加于 2026-08-29。`kernel/` 本身没有直接包含的 `.js` 文件，实现全在子目录里。

| 目录 | 文件数 | README |
| --- | --- | --- |
| `platform/` | 2 + 6 个子目录 | [platform/README.md](./platform/README.md) |
| `platform/bootstrap/` | 4 | [platform/bootstrap/README.md](./platform/bootstrap/README.md) |
| `platform/commands/` | 5 | [platform/commands/README.md](./platform/commands/README.md) |
| `platform/license/` | 4 | [platform/license/README.md](./platform/license/README.md) |
| `platform/runtime/` | — | 已有 README |
| `platform/websocket/` | — | 已有 README |
| `serial/` | 3 | [serial/README.md](./serial/README.md) |
| `storage/` | 2 + `history/` | [storage/README.md](./storage/README.md) |
| `storage/history/` | 3 | [storage/history/README.md](./storage/history/README.md) |
| `playback/` | 5 | [playback/README.md](./playback/README.md) |
| `csv/` | 1 | [csv/README.md](./csv/README.md) |
| `realtime/` | 5 | [realtime/README.md](./realtime/README.md) |
| `algorithm-channel/` | 5 | [algorithm-channel/README.md](./algorithm-channel/README.md) |
