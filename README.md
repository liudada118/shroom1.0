# Shroom1.0

> 压力传感矩阵数据采集、处理与可视化桌面应用

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

## License

Private
