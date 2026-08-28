# Shroom 后端阅读入口

> 最后更新：2026-08-28

`backend/` 只保留 Electron 应用装配、稳定能力分层和应用扩展宿主。可复用的协议、串口、采集、存储与处理实现以 `sdk/backend/` 为单一来源，本次目录整理没有修改 SDK，也没有复制第二套实现。

## 当前目录

```text
backend/
├─ common/
│  └─ logger.js                 # Electron 固定日志桥
├─ runtime/
│  └─ index.js                  # Electron 固定后端桥
├─ kernel/
│  ├─ platform/                 # 启动、命令、HTTP、WebSocket、授权和运行态
│  ├─ serial/                   # 应用侧串口控制与编排
│  ├─ storage/                  # 应用侧数据库装配与历史查询
│  ├─ playback/                 # 历史帧构造与回放
│  ├─ csv/                      # CSV 导出
│  ├─ realtime/                 # 实时帧分发
│  └─ algorithm-channel/        # Node/Python 简单算法通道
├─ extension-host/              # 展示系统发现、校验、绑定与运行宿主
├─ extensions/
│  ├─ built-in-sensors/         # 随应用交付的传感器运行扩展
│  └─ examples/                 # 展示系统示例清单
├─ compatibility/               # 只读迁移基线与旧数据工具
└─ tests/                       # 后端测试
```

后端一级目录已经从零散技术目录收拢为以上七类。原 `backend/serial`、`backend/services`、`backend/server`、`backend/displaySystems` 等旧物理路径及其 CommonJS 转发层已经移除。

## 固定边界

- Electron 仍只通过 `backend/runtime/index.js` 启停后端，通过 `backend/common/logger.js` 记录日志；这两个入口路径和导出契约保持不变。
- `sdk/backend/` 是协议解析、串口底层、采集、存储和数据处理的单一来源；应用层通过 `@shroom/backend/...` 使用它。
- 硬件协议字节定义、线序语义、历史数据库结构和历史数据格式没有因目录迁移而改变。
- `extension-host/` 负责加载和校验扩展，`extensions/` 放具体传感器或展示系统交付物；扩展不得反向修改固定 Electron 入口。

## 运行链路

```mermaid
flowchart LR
  Device[串口设备] --> SDKSerial[SDK 串口与协议]
  SDKSerial --> Sensor[传感器扩展]
  Sensor --> Realtime[kernel/realtime]
  Realtime --> WS[kernel/platform/websocket]
  WS --> Web[网页展示]
  Sensor --> SDKCollection[SDK 采集与存储]
  SDKCollection --> History[kernel/storage 与 playback]
  History --> WS
```

## 从哪里开始修改

| 目标 | 入口 |
| --- | --- |
| Electron 启停后端 | `backend/runtime/index.js` |
| HTTP、WebSocket、命令与进程生命周期 | `backend/kernel/platform/` |
| 应用侧串口打开、关闭与通道编排 | `backend/kernel/serial/` |
| 数据库装配与历史查询 | `backend/kernel/storage/` |
| 历史回放、CSV、实时输出 | `backend/kernel/{playback,csv,realtime}/` |
| Display System 算法通道 | `backend/kernel/algorithm-channel/` |
| 新传感器运行时 | `backend/extensions/built-in-sensors/`，并由 `backend/extension-host/` 注册 |
| 协议、串口底层、采集、存储、处理复用能力 | `sdk/backend/` |

更多信息见 [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md) 和 [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)。

## 验证

```powershell
npm test
npm run sdk:backend-smoke
```
