# 架构文档

> 本文档由 Manus 自动生成和维护。最后更新于：2026-03-04

## 1. 项目概述

Shroom1.0 是一个基于 **Electron** 的跨平台桌面应用程序，专用于**压力传感矩阵**的数据采集、实时可视化、存储与回放分析。系统通过串口（USB）与硬件传感器阵列连接，接收原始压力数据帧，经过线序映射、归零校准、高斯平滑等处理后，通过 WebSocket 推送至前端渲染进程，以 2D 热力图和 3D 模型的方式进行实时可视化呈现。

该系统支持多种传感器类型（汽车坐垫/靠背/头枕、床垫、手部、足底等），适用于人体工学研究、汽车座椅舒适性测试、医疗康复监测等场景。Max 分支在 main 分支基础上进行了全面的技术栈升级和架构重构，包括 Vite 构建工具迁移、React 19 升级、better-sqlite3 数据库替换、Electron 安全强化、InstancedMesh 3D 渲染优化、Zustand 状态管理引入以及自动更新集成。

## 2. 技术栈

| 分类 | 技术 | 版本/说明 |
| :--- | :--- | :--- |
| **应用框架** | Electron | ^31.3.0，跨平台桌面应用容器 |
| **前端框架** | React | ^19.0.0（从 17 升级），支持并发特性 |
| **前端构建** | Vite | ^6.0.0（从 Webpack 4 迁移），极速 HMR |
| **后端运行时** | Node.js | Electron 内置，主进程运行环境 |
| **数据库** | better-sqlite3 | ^11.0.0（从 sqlite3 迁移），同步 API + WAL 模式 |
| **编程语言** | JavaScript / TypeScript | 渐进式 TypeScript 引入（TS ^5.6.0） |
| **包管理器** | npm / yarn | 前后端分别管理依赖 |
| **状态管理** | Zustand | ^5.0.0，轻量级全局状态管理 |
| **实时通信** | WebSocket (`ws`) | ^8.14.2，前后端双向数据通信 |
| **硬件通信** | serialport | ^12.0.0，USB 串口数据读写 |
| **3D 渲染** | Three.js | ^0.170.0，压力分布 3D 可视化 |
| **UI 组件库** | Ant Design (antd) | ^5.22.0，控制面板 UI |
| **图表库** | ECharts | ^5.5.0，数据图表可视化 |
| **国际化** | i18next + react-i18next | 多语言支持 |
| **打包工具** | Electron Forge + electron-builder | 应用打包与分发 |
| **自动更新** | electron-updater | ^6.3.0，无缝后台更新 |
| **授权加密** | crypto-js (AES-ECB) | ^4.2.0，授权文件加密与验证 |
| **数据导出** | csv-writer | ^1.6.0，CSV 格式数据导出 |
| **测试框架** | Vitest | ^2.1.0，前端单元测试 |
| **代码规范** | ESLint | ^9.0.0，代码质量检查 |

## 3. 目录结构

```
shroom1.0/
├── index.js                 # Electron 主进程入口（窗口管理 + IPC 桥梁）
├── preload.js               # Electron 预加载脚本（安全 IPC 通道）
├── server.js                # 后端核心（串口数据处理 + WebSocket 分发，4648 行）
├── package.json             # 后端依赖与构建配置
│
├── # ── 后端拆分模块 ──
├── wsHelper.js              # WebSocket 广播与消息路由工具
├── dbHelper.js              # better-sqlite3 数据库操作封装
├── logger.js                # 结构化日志模块（带文件输出和性能计时）
├── serialHelper.js          # 串口生命周期管理
├── licenseHelper.js         # 授权验证（AES 解密 + 在线时间校验）
├── configManager.js         # 统一配置中心
├── dataProcessor.js         # 传感器数据处理管线
├── csvHelper.js             # CSV 导出工具
├── autoUpdater.js           # 自动更新模块
│
├── # ── 后端业务模块 ──
├── openWeb.js               # 数据转换函数库（线序映射、矩阵变换）
├── aes_ecb.js               # AES-ECB 加解密
├── gen.js / genType.js      # 传感器类型生成与配置
├── parse.js                 # 串口数据帧解析
├── press.js                 # 压力计算与校准
├── util.js / utilMatrix.js  # 通用工具函数
├── localWs.js               # 本地 WebSocket 客户端
├── serialport.js            # 串口端口扫描
│
├── # ── 配置文件 ──
├── forge.config.js          # Electron Forge 打包配置
├── jsconfig.json            # 后端 JSDoc 类型检查配置
├── types.d.ts               # 后端 TypeScript 类型定义
├── .gitignore               # Git 忽略规则
│
├── client/                  # 前端 React 应用
│   ├── package.json         # 前端依赖（React 19 + Vite + Zustand）
│   ├── vite.config.js       # Vite 构建配置
│   ├── index.html           # Vite 入口 HTML
│   ├── tsconfig.json        # 前端 TypeScript 配置
│   └── src/
│       ├── main.jsx         # Vite 入口（React 19 createRoot）
│       ├── App.js           # 路由配置（25+ 路由）
│       ├── constants.js     # 前端统一常量
│       ├── hooks/           # 自定义 Hook
│       │   ├── useWebSocket.js        # WebSocket 连接管理（自动重连 + 心跳）
│       │   ├── usePressureData.js     # 压力数据状态管理
│       │   ├── useSerialControl.js    # 串口控制指令封装
│       │   ├── useThreeScene.js       # Three.js 场景初始化
│       │   ├── usePlayback.js         # 历史数据回放控制
│       │   ├── useDeferredPressure.js # React 19 并发特性
│       │   └── useInstancedMesh.js    # InstancedMesh 渲染 Hook
│       ├── store/           # Zustand 状态管理
│       │   ├── useAppStore.js         # 全局应用状态
│       │   └── usePressureStore.js    # 压力数据专用 Store
│       ├── types/           # TypeScript 类型定义
│       │   └── index.ts
│       ├── components/      # UI 组件
│       │   ├── three/       # 3D 渲染组件（47 个传感器类型组件）
│       │   ├── heatmap/     # 2D 热力图组件
│       │   ├── chart/       # ECharts 图表组件
│       │   ├── car/         # 汽车座椅专用组件
│       │   ├── aside/       # 侧边栏导航
│       │   ├── title/       # 标题栏
│       │   ├── foot/        # 足底分析组件
│       │   ├── footTrack/   # 足迹追踪组件
│       │   ├── num/         # 数值显示组件
│       │   ├── video/       # 视频组件
│       │   └── ...
│       ├── page/            # 页面级组件
│       │   ├── home/        # 主页（Home.js 3610 行 + HomeFun.js）
│       │   ├── col/         # 数据采集页
│       │   ├── date/        # 历史数据页
│       │   └── license/     # 密钥配置可视化页面
│       │       ├── License.js    # 密钥生成/解析/管理页面
│       │       ├── License.css   # 页面样式
│       │       └── aesUtil.js    # 前端 AES-ECB 加解密工具
│       └── assets/          # 静态资源
│           ├── images/      # 图片资源
│           ├── json/        # JSON 配置
│           └── util/        # 前端工具函数
│
├── docs/                    # 项目文档
│   ├── architecture_max.md
│   ├── optimization_report_max.md
│   ├── tech_optimization_proposal.md
│   └── *.png               # 架构图和数据流图
│
├── db/                      # SQLite 数据库文件（Git 忽略）
└── data/                    # 采集数据 CSV 文件（Git 忽略）
```

### 关键目录说明

| 目录/文件 | 主要功能 |
| :--- | :--- |
| `/index.js` | Electron 主进程入口，窗口管理、IPC 桥梁、安全配置（contextIsolation + sandbox） |
| `/preload.js` | Electron 预加载脚本，建立渲染进程与主进程之间的安全 IPC 通道 |
| `/server.js` | 后端核心调度器，协调串口通信、数据处理、WebSocket 分发、数据库存储 |
| `/client/src/hooks/` | 7 个自定义 React Hook，封装 WebSocket、压力数据、串口控制、3D 场景等逻辑 |
| `/client/src/store/` | Zustand 状态管理，分为全局应用状态和高频压力数据状态 |
| `/client/src/components/three/` | 47 个 Three.js 3D 渲染组件，对应不同传感器类型和矩阵尺寸 |
| `/client/src/page/home/` | 主页面组件（Home.js），系统核心交互界面 |
| `/docs/` | 架构文档、优化报告、技术优化建议等项目文档 |
| `/db/` | SQLite 数据库文件，存储采集数据和配置信息（运行时生成，Git 忽略） |
| `/data/` | CSV 导出文件目录（运行时生成，Git 忽略） |

## 4. 核心模块与数据流

### 4.1. 模块关系图 (Mermaid)

```mermaid
graph TD
    subgraph "Electron 主进程"
        INDEX["index.js<br/>窗口管理 + IPC"]
        PRELOAD["preload.js<br/>安全桥梁"]
        SERVER["server.js<br/>核心调度器"]
        CONFIG["configManager.js<br/>配置中心"]
        LOGGER["logger.js<br/>日志"]
        LICENSE["licenseHelper.js<br/>授权验证"]
        SERIAL["serialHelper.js<br/>串口管理"]
        DB["dbHelper.js<br/>数据库"]
        WS["wsHelper.js<br/>WebSocket"]
        DATA["dataProcessor.js<br/>数据处理"]
        CSV["csvHelper.js<br/>CSV导出"]
        UPDATE["autoUpdater.js<br/>自动更新"]
        OPENWEB["openWeb.js<br/>线序映射"]
    end

    subgraph "Electron 渲染进程"
        APP["App.js<br/>路由"]
        HOME["Home.js<br/>主页面"]
        HOOKS["hooks/<br/>7个自定义Hook"]
        STORE["store/<br/>Zustand"]
        THREE["three/<br/>3D组件"]
        HEAT["heatmap/<br/>热力图"]
    end

    subgraph "外部"
        HW["硬件传感器"]
        GH["GitHub Releases"]
    end

    INDEX --> SERVER
    INDEX --> PRELOAD
    INDEX --> UPDATE
    SERVER --> CONFIG
    SERVER --> LOGGER
    SERVER --> LICENSE
    SERVER --> SERIAL
    SERVER --> DB
    SERVER --> WS
    SERVER --> DATA
    SERVER --> CSV
    DATA --> OPENWEB

    PRELOAD <--> HOME
    HOME --> HOOKS
    HOME --> STORE
    HOOKS --> STORE
    STORE --> THREE
    STORE --> HEAT

    HW -- "USB 串口" --> SERIAL
    UPDATE -- "HTTPS" --> GH
    WS -- "WebSocket" --> HOOKS
```

### 4.2. 主要数据流

1. **传感器数据采集流程**
    - 硬件传感器通过 USB 串口发送原始二进制数据帧 → `serialHelper.js` 接收并触发 `parser.on('data')` 事件 → `server.js` 调用 `dataProcessor.js` 进行线序映射（`openWeb.js`）、归零校准、高斯平滑 → 处理后的矩阵数据通过 `wsHelper.js` 广播到 WebSocket 端口 19999 → 前端 `useWebSocket` Hook 接收数据 → 更新 `usePressureStore` → React 重新渲染热力图和 3D 模型。

2. **数据存储与导出流程**
    - 用户点击"开始采集" → 前端通过 WebSocket 发送 `col` 指令 → `server.js` 开启采集模式 → 每帧数据同时写入 `dbHelper.js`（SQLite）和 `csvHelper.js`（CSV 文件） → 用户点击"停止采集"结束录制。

3. **历史数据回放流程**
    - 用户在历史数据页选择记录 → 前端发送 `play` 指令 → `server.js` 从 SQLite 读取历史帧数据 → 按时间间隔逐帧通过 WebSocket 推送 → 前端 `usePlayback` Hook 管理播放状态（播放/暂停/变速/跳帧）。

4. **授权验证流程**
    - 应用启动 → `licenseHelper.js` 读取 `config.txt` → 使用 AES-ECB 解密 → 通过 HTTPS 获取网络时间 → 比对授权有效期 → 若过期则限制功能。
    - 密钥 `file` 字段支持三种格式：`"all"`（全部授权）、`"hand0205"`（单类型锁定）、`["hand0205","robot1","footVideo"]`（多类型组合授权）。
    - 前端 `Title.js` 根据 `allowedTypes` 数组动态过滤传感器类型下拉框，实现灵活的授权控制。

6. **密钥配置管理流程**
    - 管理员访问 `/license` 页面 → 勾选授权的传感器类型（支持分组全选和快捷预设） → 设置有效天数 → 点击生成密钥 → 密钥通过 AES-ECB 加密后可复制分发 → 也可在「密钥解析」标签页粘贴密钥查看授权详情。

5. **自动更新流程**
    - 应用启动 30 秒后 → `autoUpdater.js` 检查 GitHub Releases → 发现新版本后静默下载 → 下载完成弹出对话框 → 用户确认后安装并重启。

## 5. API 端点 (Endpoints)

本项目不使用 HTTP REST API，而是通过 **WebSocket 消息协议**进行前后端通信。系统运行 3 个 WebSocket 服务器：

| WebSocket 端口 | 用途 | 数据方向 |
| :--- | :--- | :--- |
| `19999` | 主数据通道（压力矩阵数据 + 控制指令） | 双向 |
| `19998` | 辅助数据通道（靠背/头枕等附加传感器） | 后端 → 前端 |
| `19997` | 辅助数据通道（第三路传感器数据） | 后端 → 前端 |

### WebSocket 消息类型（前端 → 后端）

| 消息标识 | 描述 |
| :--- | :--- |
| `getMessage.index` | 切换传感器类型 |
| `getMessage.sitIndex` | 切换坐垫/靠背/头枕 |
| `getMessage.compen` | 设置压力补偿值 |
| `getMessage.resetZero` | 归零校准 |
| `getMessage.gauss` | 设置高斯平滑参数 |
| `getMessage.play` | 开始/停止历史回放 |
| `getMessage.date` | 提交密钥 / 查询历史数据列表 |
| `getMessage.delete` | 删除历史记录 |
| `getMessage.download` | 导出 CSV 数据 |
| `getMessage.exchange` | 矩阵行列交换 |
| `getMessage.variety` | 切换传感器变体 |
| `getMessage.up` / `getMessage.down` | 调整参数 |
| `getMessage.backIndex` | 靠背传感器索引 |
| `getMessage.history` | 历史数据查询 |
| `getMessage.serialReset` | 串口重置 |
| `getMessage.indexArr` | 批量索引设置 |

## 6. 外部依赖与集成

| 服务/库 | 用途 | 集成方式 |
| :--- | :--- | :--- |
| `serialport` + `@serialport/parser-delimiter` | 硬件传感器串口通信 | Node.js 原生模块 |
| `better-sqlite3` | 本地数据持久化（采集数据、配置） | Node.js 原生模块 |
| `ws` | 前后端实时双向通信 | WebSocket 协议 |
| `electron-updater` | 应用自动更新 | GitHub Releases API |
| `crypto-js` | 授权文件 AES-ECB 加解密 | 库调用 |
| `csv-writer` | 采集数据 CSV 格式导出 | 库调用 |
| `three` | 压力分布 3D 模型渲染 | WebGL 渲染 |
| `echarts` | 数据图表可视化 | Canvas 渲染 |
| `antd` | 控制面板 UI 组件 | React 组件库 |
| `i18next` | 多语言国际化支持 | React 插件 |
| `request` | HTTP 请求（在线时间获取） | 库调用（建议迁移到 `fetch`） |

## 7. 环境变量

本项目为 Electron 桌面应用，不使用传统的 `.env` 环境变量文件。配置通过以下方式管理：

| 配置项 | 来源 | 描述 | 默认值 |
| :--- | :--- | :--- | :--- |
| WebSocket 端口 | `configManager.js` / `server.js` 硬编码 | 主数据通道端口 | `19999` |
| 串口波特率 | `configManager.js` / `server.js` 硬编码 | 串口通信速率 | `460800` |
| 授权信息 | `config.txt`（AES 加密文件） | 授权有效期、设备标识 | 无 |
| 数据库路径 | `configManager.js` | SQLite 数据库文件位置 | `./db/info.db` |
| CSV 导出路径 | `configManager.js` | 采集数据 CSV 导出目录 | `./data/` |
| 在线时间服务器 | `server.js` 硬编码 | 用于授权时间校验的 HTTPS 端点 | `https://worldtimeapi.org/api/ip` |

## 8. 项目进度

> 记录项目从开始到现在已经完成的所有工作，每次新增追加到末尾。

| 完成日期 | 完成的功能/工作 | 说明 |
| :--- | :--- | :--- |
| 2025-02-03 | 核心数据采集系统 | 串口通信、数据解析、WebSocket 分发、SQLite 存储 |
| 2025-02-03 | 多传感器类型支持 | 汽车坐垫/靠背/头枕、床垫、手部、足底等 10+ 种传感器 |
| 2025-02-03 | 2D 热力图可视化 | Canvas 热力图渲染，支持高斯平滑和颜色映射 |
| 2025-02-03 | 3D 模型可视化 | Three.js 3D 压力分布渲染，47 个传感器类型组件 |
| 2025-02-03 | 历史数据回放 | SQLite 历史数据查询、逐帧回放、速度控制 |
| 2025-02-03 | CSV 数据导出 | 采集数据导出为 CSV 格式 |
| 2025-02-03 | 授权验证系统 | AES-ECB 加密授权文件 + 在线时间校验 |
| 2025-02-03 | 多语言支持 | i18next 国际化框架集成 |
| 2025-02-03 | Electron 桌面打包 | Electron Forge + electron-builder 打包分发 |
| 2026-03-01 | 后端模块拆分 | 从 server.js 拆分出 wsHelper、dbHelper、logger、serialHelper、licenseHelper |
| 2026-03-01 | 前端 Hook 化 | 创建 useWebSocket、usePressureData、useSerialControl 等自定义 Hook |
| 2026-03-01 | 配置中心化 | 创建 configManager.js 和 constants.js，消除硬编码 |
| 2026-03-02 | Electron 安全强化 | 启用 contextIsolation + sandbox，创建 preload.js 安全 IPC 通道 |
| 2026-03-02 | Webpack → Vite 迁移 | 前端构建工具从 Webpack 4 迁移到 Vite 6，开发启动提速 10-100 倍 |
| 2026-03-02 | React 17 → 19 升级 | 升级到 React 19，引入 useDeferredValue 并发特性 |
| 2026-03-02 | sqlite3 → better-sqlite3 | 数据库迁移到同步 API + WAL 模式，性能提升 5-10 倍 |
| 2026-03-02 | 3D InstancedMesh 优化 | 引入 InstancedMesh 渲染模式，Draw Call 从 O(n) 降至 O(1) |
| 2026-03-02 | TypeScript 渐进式引入 | 添加 tsconfig.json、types.d.ts、types/index.ts 类型定义 |
| 2026-03-02 | Zustand 状态管理 | 引入 Zustand，创建 useAppStore 和 usePressureStore |
| 2026-03-02 | 自动更新集成 | 集成 electron-updater，支持 GitHub Releases 自动更新 |
| 2026-03-02 | 密钥多类型授权 | 密钥 file 字段从 all/单个 升级为支持数组格式的多类型组合授权 |
| 2026-03-02 | 密钥配置可视化页面 | 新增 /license 页面，支持传感器多选、时间设置、一键生成密钥、密钥解析 |
| 2026-03-04 | Windows 打包修复 | 修复缺失的 better-sqlite3 依赖并完成 `npm run make`，生成 Windows x64 分发包 |
| 2026-03-04 | 打包资源路径修复 | 统一打包态资源路径到 `process.resourcesPath`，并通过 `extraResource` 打入 `build/db/data/config.txt` |
| 2026-03-04 | 打包精简（DB/Data） | 打包仅携带 `db/init.db` 模板，`data` 目录改为应用启动时自动创建空目录 |

## 9. 更新日志

| 日期 | 变更类型 | 描述 |
| :--- | :--- | :--- |
| 2026-03-02 | 初始化 | 创建项目架构文档（ARCHITECTURE.md） |
| 2026-03-02 | 新增功能 | 密钥控制系统升级：支持多类型组合授权 + 密钥配置可视化页面（/license） |
| 2026-03-04 | 依赖升级 | 补装 better-sqlite3 依赖并重新执行 Electron Forge 打包，产物输出到 `out/make` |
| 2026-03-04 | 配置变更 | 调整 Electron Forge `packagerConfig`：新增 `extraResource`，修复打包后静态资源与数据库资源缺失问题 |
| 2026-03-04 | 配置变更 | 调整打包策略：仅打入 `init.db`，不再打入 `data` 内容，运行时自动创建空 `data` 目录 |

*变更类型：`新增功能` / `优化重构` / `修复缺陷` / `配置变更` / `文档更新` / `依赖升级` / `初始化`*

---

*此文档旨在提供项目架构的快照，具体实现细节请参考源代码。*
