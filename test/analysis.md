# 项目分析报告 - shroom1.0 (test 分支 / 基于 Max)

## 1. 入口信息

| 项目 | 值 |
|------|-----|
| `main` 字段 | `index.js` |
| 启动命令 | `electron-forge start` |
| 架构 | 前后端分离（主进程 `index.js` + 前端 `client/`） |
| 前端框架 | React (Vite 构建) + react-router-dom (HashRouter) |
| 主进程职责 | 创建 BrowserWindow → 启动后端服务 → 启动静态文件服务器 → 加载前端 |

## 2. 后端功能

### 2.1 HTTP 静态服务器
- **端口**: `12321`（`HOSTNAME = 127.0.0.1`）
- **功能**: 提供 `build/` 目录下的静态文件，SPA fallback 到 `index.html`

### 2.2 WebSocket 服务
| 服务 | 端口 | 用途 |
|------|------|------|
| server (主通道) | `19999` | 坐垫/单传感器数据 |
| server1 (靠背通道) | `19998` | 靠背数据 |
| server2 (头枕通道) | `19997` | 头枕数据 |

### 2.3 数据库
- **类型**: SQLite (better-sqlite3 + sqlite3)
- **文件**: `$volvohand.db`（项目根目录）, 动态创建的 `.db` 文件
- **管理**: `dbHelper.js` (DatabaseManager 类，WAL 模式)

### 2.4 IPC 通道
**发送通道 (渲染 → 主进程)**:
- `ws-send` — WebSocket 消息转发
- `serial-command` — 串口控制指令
- `app-command` — 应用级指令
- `license-check` — 授权验证
- `file-dialog` — 文件对话框
- `export-csv` — CSV 导出
- `db-query` — 数据库查询

**接收通道 (主进程 → 渲染)**:
- `ws-message` — WebSocket 消息
- `serial-status` — 串口状态
- `license-status` — 授权状态
- `app-status` — 应用状态
- `export-progress` — 导出进度
- `db-result` — 数据库查询结果
- `error` — 错误信息

## 3. 前端 UI

### 3.1 路由表 (HashRouter)
| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `Date` | 日期/首页 |
| `/handPoint` | `HandBlock` | 手部传感点 |
| `/handRealPoint` | `HandBlock` | 手部实时点 |
| `/handPoint32` | `HandBlock32` | 32点手部 |
| `/handPoint24` | `HandBlock24` | 24点手部 |
| `/handPoint20` | `HandBlock20` | 20点手部 |
| `/robot` | `CsvData` | 机器人数据 |
| `/system` | `Home` | 系统主页(传感器可视化) |
| `/heatmap` | `Heatmap` | 热力图 |
| `/num/:type` | `Demo` | 数字矩阵(动态类型) |
| `/handReal` | `HandDemo` | 手部实时演示 |
| `/handLineData` | `HandLineDemo` | 手部线数据 |
| `/handLinePressData` | `HandLinePressDemo` | 手部压力线数据 |
| `/line` | `LineAdjust` | 线调整 |
| `/line1` | `LineAdjust1` | 线调整1 |
| `/can` | `Can` | CAN 数据 |
| `/num1010` | `Demo1010` | 10x10矩阵 |
| `/num1016` | `Demo1016` | 10x16矩阵 |
| `/carNum` | `Demo24` | 车用24点 |
| `/block` | `Block` | 块显示 |
| `/handLine` | `HandLine` | 手部线 |
| `/handLine0123` | `HandLine0123` | 手部线0123 |
| `/log` | `Log` | 日志 |
| `/diff` | `MatrixDiff` | 矩阵差异 |
| `/3Dnum` | `Num3D` | 3D数字 |
| `/license` | `License` | 授权管理 |

### 3.2 UI 框架
- **Antd** v5.22.0
- **状态管理**: Zustand v5.0.0
- **国际化**: i18next

### 3.3 可视化组件
- **Three.js**: 大量 3D 模型渲染（GLTFLoader, TrackballControls）
  - 车座、手部、脚部、沙发等 3D 模型
- **ECharts**: 图表组件（Aside 组件中）
- **Canvas**: 热力图 (heatmap/canvas)
- **Tween.js**: 动画效果

## 4. 端口汇总

| 端口 | 用途 | 来源 |
|------|------|------|
| `12321` | HTTP 静态文件服务器 | `index.js` |
| `19999` | WebSocket 主数据通道 | `server.js` / `localWs.js` |
| `19998` | WebSocket 靠背数据通道 | `server.js` |
| `19997` | WebSocket 头枕数据通道 | `server.js` |
| `3000` | 前端开发服务器 (dev) | `client/scripts/start.js` |

## 5. 硬件依赖

| 依赖 | 模块 | Mock 方案 |
|------|------|----------|
| 串口 (SerialPort) | `serialport`, `serialHelper.js` | `socat` 虚拟串口对 或 跳过 |
| 帧解析 | `@serialport/parser-delimiter` | 随串口 mock |

## 6. 构建模式

- **无预构建产物**: 项目中没有 `build/` 或 `dist/` 目录
- **需要先构建前端**: `cd client && npm run build` (vite build)
- **静态服务器读取**: `build/` 目录（需要在项目根目录或创建软链接）
- **前端使用 Vite**: `client/vite.config.js` 存在
