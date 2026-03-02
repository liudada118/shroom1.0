# Shroom1.0 架构审计报告

**审计日期:** 2026-03-03
**项目总代码量:** ~102,225 行 JS（含 copy 文件 ~15,055 行）

---

## 基线指标汇总

| 指标 | 数值 |
|------|------|
| 后端 server.js 行数 | 4,668 行 |
| 后端全局变量数 | 43 个 |
| 后端函数数 | 280 个 |
| 后端 `var` 使用次数 | 66 处 |
| 后端 `console.log` 调用 | 113 处 |
| 后端重复 `JSON.parse(message)` | 45 处 |
| 后端广播模式重复 | 77 处 |
| 前端 Home.js 行数 | 3,610 行 |
| 前端 util.js 行数 | 5,001 行 |
| 前端 Title.js 行数 | 1,711 行 |
| Three.js 组件文件数 | 54 个 |
| Copy 文件残留 | 20 个 |
| React.memo 使用 | 0 处 |
| Three.js renderer.dispose() 调用 | 0 处 |
| Three.js geometry/material/texture dispose | 0 处 |
| SQLite WAL 配置 | 无 |
| 端口管理（isPortAvailable） | 无 |
| 进程异常处理 | 无 |
| 前端依赖数 | 81 个 |
| 已有自定义 Hooks | 3 个（useWebSocket, usePressureData, useSerialControl） |
| src1 备份目录 | 存在 |

---

## P0 — 关键问题（崩溃、内存泄漏、数据丢失）

### P0-1: Three.js 内存泄漏（严重）
- **问题:** 54 个 Three.js 组件中，没有一个正确清理 `renderer`、`geometry`、`material`、`texture`。
- **现状:** useEffect cleanup 仅调用 `selectHelper?.dispose()` 和 `cancelAnimationFrame`。
- **影响:** 每次组件切换/卸载都会泄漏 WebGL 上下文、GPU 内存，长时间运行后导致浏览器崩溃。
- **修复:** 创建共享 `cleanupThree()` 工具函数，在所有 Three.js 组件的 useEffect cleanup 中调用。

### P0-2: WebSocket 端口硬编码无冲突处理
- **问题:** 3 个 WebSocket Server 硬编码端口 19999/19998/19997，HTTP 服务器硬编码 12321。
- **现状:** 无 `isPortAvailable()` 检测，无 `listenWithRetry()` 重试。
- **影响:** 多实例运行或端口被占用时直接崩溃。
- **修复:** 实现端口检测和自动递增机制。

### P0-3: 无进程异常处理
- **问题:** 无 `process.on('uncaughtException')` 和 `process.on('unhandledRejection')` 处理。
- **影响:** 未捕获的异常会导致进程静默崩溃，无日志可追溯。
- **修复:** 添加全局异常处理和优雅关闭逻辑。

---

## P1 — 高优先级（可测量的性能影响）

### P1-1: 重复 JSON.parse(message) 调用
- **问题:** server.js 中 45 处 `JSON.parse(message)` 调用，同一条消息被反复解析。
- **影响:** 高频消息场景下造成不必要的 CPU 开销。
- **修复:** 每条消息只解析一次，后续使用引用。

### P1-2: SQLite 无 WAL 模式
- **问题:** SQLite 数据库未配置 WAL 日志模式。
- **影响:** 写入性能低 5-10 倍，高频数据采集时可能丢帧。
- **修复:** 添加 `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`。

### P1-3: 无 React.memo 优化
- **问题:** 所有组件均未使用 React.memo，包括接收不变 props 的子组件。
- **影响:** 父组件状态变化时所有子组件不必要地重新渲染。
- **修复:** 对纯展示组件和 Three.js 组件包裹 React.memo。

### P1-4: ECharts 全量导入
- **问题:** 5 处 `import * as echarts from "echarts"` 全量导入。
- **影响:** 打包体积增大约 800KB+。
- **修复:** 创建 barrel file 使用 tree-shaking。

### P1-5: 前端 WebSocket 硬编码地址
- **问题:** 20+ 处 `new WebSocket(" ws://localhost:19999")` 硬编码（注意前面有空格）。
- **影响:** 端口动态分配后前端无法连接；URL 中的空格可能导致连接失败。
- **修复:** 统一使用 useWebSocket hook 和配置化的端口地址。

---

## P2 — 中优先级（可维护性和开发体验）

### P2-1: server.js 巨型单文件（4,668 行）
- **问题:** 所有后端逻辑集中在一个文件中。
- **影响:** 难以维护、测试和协作开发。
- **修复:** 按职责拆分为 state/websocket/serial/services/api 模块。

### P2-2: 20 个 Copy 文件残留
- **问题:** 20 个带 "copy" 的文件，且 Home.js 中有 7 个 import 引用了 copy 文件。
- **影响:** 代码混乱，难以区分正式版和备份版。
- **修复:** 重命名为有意义的名称或删除。

### P2-3: src1 备份目录
- **问题:** client/src1 目录是 src 的旧版备份。
- **影响:** 增加项目体积和混淆。
- **修复:** 确认后删除或移到 .gitignore。

### P2-4: 66 处 var 使用
- **问题:** server.js 中 66 处使用 `var` 声明变量。
- **影响:** 函数作用域而非块作用域，容易产生 bug。
- **修复:** 替换为 `let` 或 `const`。

### P2-5: 113 处 console.log
- **问题:** 大量未结构化的 console.log 调用。
- **影响:** 生产环境日志混乱，难以排查问题。
- **修复:** 使用已有的 logger.js 模块替换。

### P2-6: 无 Webpack splitChunks 配置
- **问题:** 未配置代码分割。
- **影响:** 首屏加载慢，three/echarts/antd 全部打入主包。
- **修复:** 添加 vendor chunks 配置。

### P2-7: 无集成测试和 E2E 测试
- **问题:** 仅有一个默认的 App.test.js。
- **影响:** 无法验证重构后的正确性。
- **修复:** 添加集成测试和 Xvfb E2E 测试。
