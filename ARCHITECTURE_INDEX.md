# Shroom 快速架构索引

> 最后更新于：2026-09-02  
> 用途：给日常任务提供稳定入口和验证路由。完整历史与设计说明仍以 `ARCHITECTURE.md` 为准，后端细图见 `backend/ARCHITECTURE_MAP.md`。

## 1. 一分钟判断路径

1. 查看 `git status --short`，确认用户已有改动。
2. 按下面的“变更路径 → 验证域”选择范围。
3. 只读取入口、直接依赖、调用方和对应测试；使用 `rg` 查符号，不遍历构建产物和模型资源。
4. 默认执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-changed.ps1 -Mode Standard`。
5. 只有高风险边界、发布或真实性能结论才升级为 `-Mode Full`。

## 2. 运行时总览

```text
Electron main
  ├─ app/electron/index.js                 窗口、生命周期、开发服务与后端启动
  └─ backend/runtime/index.js              稳定运行时桥
       └─ backend/kernel/platform/server.js 组合根
            ├─ sdk/backend/serial          串口生命周期与 parser
            ├─ backend/extension-host      Display System 发现、绑定与处理
            ├─ backend/kernel/realtime     canonical sensor.frame 与实时网关
            ├─ sdk/backend/collection      采集批写
            ├─ backend/kernel/platform/http HTTP 控制面
            └─ backend/kernel/platform/websocket 单 WebSocket 数据面

React renderer
  ├─ client/src/page/home/Home.jsx         旧主界面编排与迁移桥
  ├─ client/src/extensions/display-system  配置驱动展示系统
  └─ sdk/frontend                          稳定帧总线、契约和渲染器
```

## 3. 两条核心数据流

实时数据：

```text
设备 → SerialManager → Parser → 协议解码/线序
     → 单通道算法，或按 displaySystemId/sensorId 聚合后调用 Python V2
     → 扣零
     → FrameOutputPipeline
       ├─ Collection writer → SQLite/历史
       └─ RealtimeTelemetryGateway → ChannelBus → WS :19999
          → sensorFrameDecoder → frameBus/RendererHost 或 legacy/Manifest 适配
```

控制命令：

```text
client commandClient → HTTP :19245 /api/commands
  → ControlCommandService/Router → serial/playback/collection/runtime
```

约束：传感器实时/回放数据只使用 canonical `sensor.frame`；控制命令走 HTTP，WebSocket 只承载订阅和实时推送。回放应回注同一实时发布边界。

## 4. 高频路径入口

| 关注点 | 主要入口 | 首选测试 |
| :--- | :--- | :--- |
| Electron 启动/关闭 | `app/electron/index.js`, `backend/runtime/index.js` | `backend/tests/server/serverShutdownOrchestrator.test.js` + Full |
| 串口生命周期 | `sdk/backend/serial/serialManager.js` | `backend/tests/serial/`, `backend/tests/application/serialControlService.test.js` |
| framing/协议 | `sdk/backend/serial/serialParserManager.js`, `sdk/backend/protocol/` | `backend/tests/serial/` |
| Display System | `backend/extension-host/`, `display-systems/` | `backend/tests/displaySystems/`, `backend/tests/server/appRuntimeDisplaySystems.test.js` |
| Python 算法包/融合输入 | `agent-resources/algorithm-packages/`, `backend/extension-host/manifest/displaySystemAlgorithmPackage.js`, `backend/extension-host/manifest/builtinAlgorithmPackageCatalog.js`, `backend/extension-host/runtime/displaySystemFrameAggregator.js`, `backend/kernel/algorithm-channel/` | `backend/tests/displaySystems/algorithmPackage.test.js`, `python/tests/test_builtin_algorithm_packages.py`, `python/tests/test_display_system_algorithm_v2.py` |
| canonical 帧 | `backend/kernel/realtime/sensorFrameEnvelope.js` | `backend/tests/contracts/`, `backend/tests/ws/realtimeTelemetryGateway.test.js` |
| WebSocket | `backend/kernel/platform/websocket/` | `backend/tests/ws/` |
| 采集存储 | `sdk/backend/collection/`, `backend/kernel/storage/` | `backend/tests/collection/`, 回放/CSV 测试 |
| 前端帧边界 | `client/src/services/ws/`, `sdk/frontend/core/frameBus.js` | client Vitest + SDK frontend tests |
| 渲染器 / Agent 图表 | `sdk/frontend/renderers/`, `client/src/extensions/display-system/`, `backend/extension-host/agent-apps/` | 对应 renderer/client/agentApps tests + 临时生产构建 |
| SDK 公共契约 | `sdk/backend/`, `sdk/frontend/` | 两套 SDK 测试和 smoke |

## 5. 变更路径 → 验证域

| 变更路径 | Standard | 需要 Full 的情况 |
| :--- | :--- | :--- |
| 仅 `*.md`, `docs/`, 注释 | 不运行代码测试；检查引用和格式 | 发布文档或文档生成链变化 |
| `backend/**` | 后端完整测试（Electron ABI）+ backend smoke | 实时、存储、协议、授权、HTTP/WS 公共边界 |
| `sdk/backend/**` | 后端完整测试 + backend smoke | 导出、契约、串口或依赖变化 |
| `client/**` | client tests + lint | 构建配置、路由入口、渲染器或跨层契约 |
| `sdk/frontend/**` | SDK frontend tests + smoke | exports、渲染器注册或公共契约 |
| `display-systems/**`, `agent-resources/**` | backend + client tests，临时 client build | schema、Agent App 打包策略或内置模板变化 |
| `shared/**`, `util/**` | backend + client + frontend SDK tests | 被多个运行时入口引用或改变公共数据语义 |
| `app/electron/**`, 打包脚本 | backend tests + 临时 client build | 启动、资源路径、安装包或发布行为 |
| `package*.json`, lockfile | 所有受影响测试域 | 依赖版本、native ABI 或打包依赖 |
| 无法识别的共享根文件 | 前后端 smoke +相关测试 | 被多个运行时入口引用 |

脚本会合并多个路径对应的验证域，并行运行互不依赖的任务。

## 6. 性能基线

- `node scripts/perf-baseline.mjs`：打印当前 canonical 帧、JSON 和契约校验微基准。
- `node scripts/perf-baseline.mjs --check`：与保存基线比较；同平台/架构/Node major 才比较计时，所有平台都比较结构体积。
- `node scripts/perf-baseline.mjs --write`：在明确接受当前结果后更新 `scripts/perf-baseline.json`。
- 微基准不是串口 → WS → GPU 的端到端结论。真实性能任务还必须给出设备数、点数、位宽、Hz、展示/存储开关，并采集 event-loop lag、队列深度、丢帧、GC、writer lag 和端到端 sequence lag。

## 7. 已知边界

- Electron main 当前仍直接加载后端；同步数据库和 CPU/JSON 峰值会影响采集数据面。
- WebSocket 发送路径目前缺少统一的慢客户端背压契约。
- `frameBus + RendererHost` 是高频展示首选；高频帧不应进入 React state。
- 高 Hz 必须区分采集率、算法率、存储率和显示帧率；UI 通常只消费 latest/coalesced 帧。
- 普通多串口并发接收不等于硬件同步采样。严格同步依赖共享采样时钟/触发或设备硬件时间戳。

## 8. 索引维护

只有入口、依赖方向、公共契约或验证命令发生变化时才更新本索引。功能历史、详细设计推演和累计项目进度继续追加到 `ARCHITECTURE.md`，不要把本文件扩写成第二份历史文档。
