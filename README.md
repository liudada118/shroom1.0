# Shroom1.0

> 压力传感矩阵数据采集、处理与可视化桌面应用

## 当前代码分类（2026-06-17）

- `app/electron/`：Electron 主进程入口和 preload 安全桥。
- `app/update/`：自动更新模块。
- `backend/server/`：后端核心入口，串口、WebSocket、采集、回放和导出主流程。
- `backend/runtime/`：后端运行时门面，承接 Electron 调用、命令路由和 WebSocket 广播工具。
- `backend/services/`：后端横向业务服务层；当前已收口 WebSocket 广播/三通道、服务关闭生命周期、采集配置、采集磁盘保护、批量入库队列和历史查询能力，供 runtime 与 server 复用。
- `backend/sensors/`：全类型传感器注册表和插件化模块；统一维护波特率、矩阵尺寸、通道、能力分类和存储策略，`smallBed12B.js`、`minzhen.js`、`wholeChair.js`、`handGloveFullPacket.js` 已承接各自复杂解析/映射逻辑。
- `client/src/displays/`：前端全类型展示注册表，集中描述展示系统的矩阵尺寸、默认模式、通道和能力。
- `backend/processing/`：线序、矩阵、压力和传感器数据处理。
- `backend/common/`、`backend/db/`、`backend/ws/`、`backend/serial/`、`backend/export/`、`backend/license/`、`backend/config/`、`backend/python/`：后端公共能力按功能拆分。
- `assets/`：图标和授权资源。
- `tools/generators/`：生成和解析脚本。
- `runtime/`：日志、临时文件和历史遗留入口文件。
- `docs/markdown/`：从根目录归档的 Markdown 说明文档。

## 简介

Shroom1.0 是一个基于 **Electron + React + Node.js** 构建的跨平台桌面应用，专用于连接多种物理压力传感器硬件（座椅、床垫、手套、足底等），实时采集并可视化压力分布数据。

## 核心功能

- **实时数据采集:** 通过串口连接传感器，实时接收并解析压力矩阵数据
- **2D 可视化:** 热力图（Canvas + 高斯模糊）、数值矩阵、ECharts 趋势图
- **3D 可视化:** 基于 Three.js，将压力数据动态映射到汽车座椅、手、足底等 3D 模型表面
- **数据存储与回放:** 使用 SQLite 本地存储采集数据，支持按时间标签精确回放
- **CSV 导出:** 将历史数据导出为结构化 CSV 文件
- **授权管理:** AES 加密的时间授权机制

## 技术栈

| 层级 | 技术 |
|------|------|
| 应用框架 | Electron + Electron Forge |
| 后端 | Node.js, serialport, ws, sqlite3, crypto-js |
| 前端 | React, React Router, Ant Design, Three.js, ECharts |

## 快速开始

```bash
# 安装依赖
npm install
cd client && npm install && cd ..

# 开发模式启动
npm start

# 打包
npm run make

# mac 发给其他电脑（补签名+zip）
npm run build-mac-share
```

`build-mac-share` 会生成 `dist/*-mac-adhoc.zip`，用于测试分发。  
若目标电脑弹出安全提示，可在目标电脑执行：

```bash
xattr -dr com.apple.quarantine /Applications/Shroom.app
```

## 项目结构

```
shroom1.0/
├── index.js          # Electron 主进程入口
├── server.js         # 核心后端逻辑（串口、WebSocket、数据库）
├── openWeb.js        # 传感器数据处理函数
├── utilMatrix.js     # 矩阵工具函数
├── aes_ecb.js        # AES 加密/解密模块
├── forge.config.js   # Electron Forge 打包配置
├── client/           # React 前端应用
│   └── src/
│       ├── components/three/   # Three.js 3D 渲染组件
│       ├── components/heatmap/ # 2D 热力图组件
│       └── page/               # 页面组件
├── db/               # SQLite 数据库目录
└── docs/             # 项目文档
    └── architecture.md  # 架构文档
```

## 文档

详细架构文档请参阅 [docs/architecture.md](./docs/architecture.md)

Mac 正式打包与自动更新发布流程请参阅 [docs/mac_release_flow.md](./docs/mac_release_flow.md)

## License

Private
