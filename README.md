# Shroom1.0

> 压力传感矩阵数据采集、处理与可视化桌面应用

## 当前代码分类（2026-08-28）

- `app/electron/`：Electron 主进程入口和 preload 安全桥。
- `app/update/`：自动更新模块。
- `backend/runtime/`：Electron 固定后端桥，稳定导出启动、关闭、命令和实时广播能力。
- `backend/kernel/`：稳定运行链路，按平台、串口、存储、回放、CSV、实时和算法通道分类。
- `backend/extension-host/`：展示系统 manifest 的发现、校验、运行时绑定、调度和用户工作区。
- `backend/extensions/`：内置传感器运行时和可复制扩展示例。
- `backend/compatibility/`：仍被历史链路使用的数据兼容工具，不包含旧路径转发层。
- `sdk/backend/`：协议、串口底层、采集、存储和通用处理能力的单一来源。
- `client/src/displays/`：前端全类型展示注册表，集中描述展示系统的矩阵尺寸、默认模式、通道和能力。
- `assets/`：图标和授权资源。
- `tools/generators/`：生成和解析脚本。
- `runtime/`：开发态日志、临时文件、上传和导出产物（Git 忽略）。
- `dist/`：安装包和更新清单构建产物（按要求保留在一级目录，Git 忽略）。

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
shroom1/
├── app/electron/              # Electron 稳定壳与 preload
├── backend/
│   ├── runtime/               # Electron 固定后端桥
│   ├── kernel/                # 稳定运行链路
│   ├── extension-host/        # 通用扩展宿主
│   ├── extensions/            # 内置扩展实现
│   ├── compatibility/         # 必要历史兼容
│   └── tests/
├── sdk/                       # 前后端可复用能力
├── client/                    # React 页面与可视化
├── display-systems/           # 展示系统 manifest
├── build/                     # 出厂离线网页
├── runtime/                   # 开发态运行产物
└── dist/                      # 安装包构建产物
```

## 文档

详细架构文档请参阅 [ARCHITECTURE.md](./ARCHITECTURE.md)

Mac 正式打包与自动更新发布流程请参阅 [docs/mac_release_flow.md](./docs/mac_release_flow.md)

## License

Private
