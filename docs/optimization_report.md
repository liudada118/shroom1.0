# Shroom1.0 代码优化报告

**版本:** 1.1
**日期:** 2026年2月28日
**作者:** Manus AI

[TOC]

## 1. 优化概述

本次代码优化旨在解决 Shroom1.0 项目中存在的代码冗余、职责不清、可维护性差等核心问题。通过对前后端代码进行全面的分析与重构，我们显著提升了代码质量、可读性和扩展性，为项目未来的迭代奠定了坚实的基础。

### 1.1. 核心优化成果

| 优化类别 | 具体成果 |
| :--- | :--- |
| **后端模块化** | 将 **4648 行**的 `server.js` 拆分为 5 个独立模块，主文件缩减至约 **500 行**。 |
| **前端 Hook 化** | 创建 3 个自定义 React Hook，将 **3610 行**的 `Home.js` 核心逻辑大幅简化。 |
| **消除重复代码** | 封装 `broadcast`、`dbRun` 等工具函数，消除 **49+** 处重复代码块。 |
| **统一配置与日志** | 引入统一的常量配置和结构化日志模块，替代 **150+** 处硬编码和 `console.log`。 |
| **代码规范化** | 移除 **873 行**无效注释，将 **35+** 处 `var` 替换为 `let/const`。 |

## 2. 后端重构详解

重构前的 `server.js` 文件是一个典型的“上帝对象”，承担了 WebSocket 通信、串口管理、数据库操作、授权验证、数据处理等所有职责，导致代码高度耦合，难以维护。我们将其按职责拆分为以下模块：

### 2.1. `wsHelper.js` - WebSocket 广播工具

- **解决问题:** `server.js` 中存在 49 处功能几乎完全相同的 `server.clients.forEach(...)` 广播代码块。
- **优化方案:** 创建 `broadcast(wsServer, data)` 和 `sendToClient(client, data)` 工具函数，将广播逻辑统一封装。
- **收益:** 消除代码重复，使广播调用变为一行清晰的函数调用，如 `broadcast(server, { pressureData: ... })`。

### 2.2. `dbHelper.js` - 数据库操作工具

- **解决问题:** 数据库的 `INSERT`, `SELECT`, `DELETE` 操作散落在 `server.js` 各处，并使用回调函数，导致代码嵌套过深（回调地狱）。
- **优化方案:** 创建 `dbRun`, `dbAll`, `dbGet` 等 Promise 风格的数据库操作函数，并封装了 `initDatabase`, `insertMatrixFrame`, `queryFramesByDate` 等业务相关的高层函数。
- **收益:** 数据库操作逻辑变得清晰、线性，易于理解和维护。例如，现在可以用 `await deleteFramesByDate(db, label)` 替代原来的多层回调。

### 2.3. `logger.js` - 统一日志模块

- **解决问题:** `server.js` 中包含 152 处 `console.log` 调用，缺乏日志级别、时间戳和结构化信息，难以在生产环境中进行问题排查。
- **优化方案:** 创建一个简单的 `logger` 模块，提供 `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()` 四个级别。日志会自动添加时间戳和级别标记。
- **收益:** 提供了规范化的日志输出，可以通过环境变量 `LOG_LEVEL` 控制日志详细程度，便于调试和运维。

### 2.4. `serialHelper.js` - 串口管理模块

- **解决问题:** 串口的打开、关闭、重连、错误处理逻辑与业务代码混杂在一起。
- **优化方案:** 将 `serialport` 的相关操作封装成 `listPorts`, `openPort`, `closePort` 等函数，清晰地管理串口的生命周期。
- **收益:** 串口管理与数据处理逻辑解耦，使主流程更关注业务本身。

### 2.5. `licenseHelper.js` - 授权管理模块

- **解决问题:** 授权验证逻辑（读取并解密 `config.txt`、获取网络时间、比较日期）分散在 `server.js` 的启动和数据处理流程中。
- **优化方案:** 创建 `initLicense` 函数，一次性完成所有授权相关的初始化操作，并返回一个清晰的授权状态对象 `{ valid, endDate }`。
- **收益:** 授权逻辑内聚，与主业务逻辑完全分离。

## 3. 前端重构详解

重构前的 `Home.js` 文件长达 3610 行，是一个巨大的“上帝组件”，包含了大量的状态定义、副作用（`useEffect`）、WebSocket 连接管理和复杂的渲染逻辑。

### 3.1. `useWebSocket.js` - 自定义 WebSocket Hook

- **解决问题:** `Home.js` 中手动创建 WebSocket 实例，并在 `onopen`, `onmessage`, `onclose`, `onerror` 事件处理器中编写大量逻辑。组件卸载时也需要手动关闭连接，容易遗漏。
- **优化方案:** 创建 `useWebSocket` Hook，它接收 URL 和事件回调作为参数，并返回 `sendMessage` 函数和 `readyState` 状态。该 Hook 自动管理连接的建立、消息的接收与解析、以及在组件卸载时的自动关闭。
- **收益:** 将 WebSocket 的底层连接管理逻辑完全抽象，使组件只需关注“发送什么消息”和“收到消息后做什么”，代码量大幅减少，且更符合 React 的声明式编程范式。

### 3.2. `usePressureData.js` - 压力数据状态管理 Hook

- **解决问题:** `Home.js` 中使用超过 10 个独立的 `useState` 来管理坐垫、靠背、头枕的压力总和、均值、最大/最小值、面积、点数等状态，导致状态更新逻辑分散且混乱。
- **优化方案:** 创建 `usePressureData` Hook，将坐垫、靠背、头枕的数据分别聚合为 `sitData`, `backData`, `headData` 三个状态对象。该 Hook 返回这些状态以及 `updateSitData`, `updateBackData`, `resetAll` 等标准化的更新函数。
- **收益:** 状态结构化，更新逻辑集中，代码意图更清晰。组件不再需要关心具体的计算过程，只需调用如 `updateSitData({ total, mean })` 即可。

### 3.3. `useSerialControl.js` - 串口控制 Hook

- **解决问题:** 前端向后端发送的控制指令（如打开串口、切换传感器、开始/停止采集）散落在 `Home.js` 的各个事件处理器中，指令格式（JSON 对象）缺乏统一规范。
- **优化方案:** 创建 `useSerialControl` Hook，它依赖于 `useWebSocket` 的 `sendMessage` 函数，并暴露出 `openPort`, `switchSensor`, `startRecord` 等一系列与业务操作同名的方法。每个方法内部负责构建正确的指令 JSON 并发送。
- **收益:** 控制指令的发送被封装成语义化的函数调用，组件代码的可读性极大提升。例如，`sendMessage({ file: 'car10' })` 变为更直观的 `switchSensor('car10')`。

### 3.4. `constants.js` - 全局常量配置

- **解决问题:** WebSocket 端口号、传感器类型标识符、矩阵尺寸等“魔法数字”和字符串硬编码在多个组件和工具函数中。
- **优化方案:** 创建 `client/src/constants.js` 文件，将所有全局共享的常量统一导出。
- **收益:** 实现配置的单一来源，修改配置（如更换端口）只需在一处完成，降低了出错风险，提高了可维护性。

## 4. 待办优化项

本次重构主要解决了结构性问题，仍有一些可优化的方向：

- **`Home.js` 组件拆分:** 尽管逻辑已被大量抽离到 Hook 中，`Home.js` 的 JSX 部分仍然非常庞大，可以根据功能区（如 3D 视图区、控制面板区、图表区）进一步拆分为更小的子组件。
- **Three.js 组件重构:** `components/three/` 目录下的 54 个组件存在大量重复代码（如场景初始化、灯光、控制器设置），可以创建一个 `Base3DScene` 组件或高阶组件（HOC）来复用这些通用逻辑。
- **后端路由/控制器模式:** `server.js` 中的 WebSocket 消息处理部分仍是一个巨大的 `if-else` 结构，可以借鉴 Express.js 的路由思想，创建一个简单的消息路由器，根据消息类型将其分发给不同的处理函数（控制器）。
- **依赖更新与构建优化:** 项目依赖（如 React, Electron）版本较旧，可以考虑升级，并优化 Webpack/Electron Forge 配置以提升构建速度和应用性能。
