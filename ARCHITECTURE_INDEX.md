# Shroom 快速架构索引

> 最后更新于：2026-09-22
> 用途：代码定位和验证路由。理解当前实现先读 [开发者手册](docs/developer-guide.md)，完整文档分类见 [docs/README.md](docs/README.md)。`ARCHITECTURE.md` 保留历史设计与维护台账，不用作默认全文入口。

当前完整链路：[数据、算法、存储与回放](docs/chains/data-flow.md) · [页面、渲染与交互](docs/chains/interface-flow.md)。

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
  ├─ app/electron/agentProcess.js          主窗口受限 IPC、凭据、独立 Agent 生命周期
  │    └─ backend/agent-runtime/worker.js  utilityProcess：Responses、任务、附件、业务工具
  └─ backend/runtime/index.js              稳定运行时桥
       └─ backend/kernel/platform/server.js 组合根
            ├─ sdk/backend/serial          串口生命周期与 parser
            ├─ backend/extension-host      Display System 发现、绑定与处理
            ├─ backend/kernel/realtime     canonical sensor.frame 与实时网关
            ├─ sdk/backend/collection      采集批写
            ├─ backend/kernel/platform/http HTTP 控制面
            └─ backend/kernel/platform/websocket 单 WebSocket 数据面

React renderer
  ├─ client/src/features/agent/            全局对话抽屉、模型设置、任务与提案
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

约束：传感器实时/回放数据使用 canonical `sensor.frame`；新控制命令走 HTTP。当前仍保留旧扁平 WebSocket 控制入口，Home 的三个 JQBed 算法配置命令尚走 WS；它们不属于规范命令的新接入方式。WebSocket 还承载订阅、实时帧和低频系统状态；回放回注同一发布边界，详见数据链路。

## 4. 高频路径入口

内置系统真实预览：`displays/nativeSceneAssets.js` 与原生渲染器共用模型/底图地址，`sceneCatalog` 按具体型号映射，`sceneLayouts` 提供矩阵和足底布局，`sceneModelSampling` 按世界表面积分配粒子。小床、宠物/mini 和高速矩阵通过 `supportsDirectSceneEntry`、`smallBed.jsx` / `4096.jsx` / `hand.jsx` 单段交接。验证 `sceneCatalog` / `sceneLayouts` / `sceneModelSampling` tests、`node scripts/tests/portal-scene-catalog.mjs`（12 项预览、4 项真实画布往返）及 `portal-launcher.mjs`；原生画布接入执行 Full。

原生实体连续交接：`renderers/nativeSceneEntrance.js` 等待真实模型就绪，`nativeSceneSamples.js` 按实际三角形表面/足底透明轮廓采样，复用 `modelParticleEntrance`。`wholeChair`、`carQX`、`minzhen`、`footVideo`、`robot1`、`robotSY`、`robotLCF` 通过 Home 的 `portalEmbedded` 直接衔接列表并反向返回。`monitoringSurface` 对受管原生模型提供最多 30 秒等待及失败出口；验证两个 nativeScene 单测、monitoringSurface、modelParticleEntrance 和 `portal-scene-catalog.mjs --native-only`（7 个原生场景、慢加载/失败/减少动画），执行 Full。

Agent 分类算法：`AgentAlgorithmData` → `agentProcess` / `runtime` 用户选择 → `tools` → `algorithm-lab`。`algorithmRecordService` 只读查询采集记录；受限 Python 由数值 AST 解释器执行。`evaluate` 保存输入契约，`realtimeCatalog` 发现已保存版本，`algorithmMarketService` 通过 `realtimeRunner` / `realtimeWorker` 实时分类；原生副本支持持久绑定，`PortalPackageOutputs` 显示类别和阶梯趋势。验证 `algorithmLab.test.js`、`realtimeClassifier.test.js`、`builtin-templates.mjs`、`embedded-agent-electron.cjs --algorithm --asar`；实时执行及跨层变更使用 Full。

采集标签复用：`client/src/features/agent/collectionLabels.js` 从已知采集命名格式提取标签，`AgentAlgorithmData` 默认只需勾选，按需展开单条/批量改标签；支持当前页标签筛选、批量选择及上限反馈。只改前端选数，不改采集存储或 Agent 接口；验证 `collectionLabels.test.js`、`agent-workspace.mjs` 和 Standard 客户端域。

Agent 历史与粘贴：`AgentHistory` / `AgentWorkspace.onPaste` → 主进程 `agentProcess` / `agentClipboard` → `runtime` / `storage`。原图独立保存，公开状态只传缩略图；当前会话与归档可切换续聊。验证 `runtime.test.js`、`agentProcess.test.js`、`node scripts/tests/agent-workspace.mjs` 及真实 Electron IPC/ASAR 夹具；触及桌面 IPC，执行 Full。

原生内置系统模板：`backend/extension-host/workspace/builtinSystemTemplates.js` → `appRuntimeFactory` → `serialControlService` / `server`；前端 `BuiltinTemplateDialog`、`nativeSystemTemplates`、Home 原生分支；Agent `prepare_builtin_system`。测试 `builtinTemplates.test.js`、`nativeSystemTemplates.test.js`、`AgentConversation.test.jsx`、`agentTools.test.js`、`node scripts/tests/builtin-templates.mjs`；涉及串口选择、身份与存储隔离，执行 Full。

原生独立系统编辑：`builtinSystemConfiguration.js` 校验算法、指标和输入 → `builtinSystemTemplates` 修订号保存/删除 → `PATCH/DELETE /api/display-systems/:id/native`。前端 `NativeSystemEditor` 编辑配置，`Aside/NativeSystemOutputs` 读取 `algorithmMarketService` 的真实输出；Agent 使用 `prepare_update_native_system` / `prepare_delete_native_system` / `get_algorithm_state`。测试增加 `nativeSystemsApi.test.js`、算法实例生命周期和原生图表浏览器回归；旧副本自动补默认配置，执行 Full。

Agent 当前系统识别：`agentDeviceConnectionService.snapshot().currentSystem` → `get_current_system` → Agent `runTask` 首次模型请求前自动读取，按任务保存 `systemContext`。覆盖原生内置、原生副本、Manifest、未选择和未知身份；不从聊天或名称相似度猜目标。验证 `agentDeviceConnection.test.js`、`agentTools.test.js`、`runtime.test.js` 和真实 Electron Agent 夹具。

门户点图及原始规则矩阵框选：`sdk/frontend/renderers/shared/gridSelection.js` / `gridSelectionGeometry.js` + `PortalSelectionTools.jsx`，由 `hand.jsx` / `NumMatrixRenderer` 暴露 `getSelectionTools()`；验证 `pointGridSelection.test.js`、`sensorRuler.test.js` 和门户浏览器回归的原始压力索引、并集去重、空白保护与拖动缩放；`gridSelectionGeometry.test.js` 和 `portal-selection-controls.mjs` 专测参考项目的格边预览、八向手柄、保尺寸移动与拖动中键盘衔接。

传感点物理量尺：`PortalScreenRuler.jsx` + `portalRulerState.js` + `sensorRuler.js`；用户填写横纵点距（mm），按系统和矩阵尺寸在本机保存。端点锁定整数采样点，显示横纵跨格数并测量平面中心距；验证 `sensorRuler.test.js`、状态单测及 `scripts/tests/portal-ruler-controls.mjs` 的格内偏移吸附、原始矩阵框选、距离、拖拽、键盘、上限、跨视图回填和窄屏投影。无可靠点位映射的布局不冒充支持。

| 关注点 | 主要入口 | 首选测试 |
| :--- | :--- | :--- |
| 软件内置 Agent | `client/src/features/agent/`, `app/electron/agentProcess.js`, `agentSettings.js`, `backend/agent-runtime/`, `kernel/platform/commands/agentDeviceConnectionService.js`；使用说明见 [内置 Agent](docs/embedded-agent.md) | `backend/tests/agentRuntime/` + AgentWorkspace / agentState；Full；`electron.cmd scripts/tests/embedded-agent-electron.cjs` 检查真实独立进程（合成模型/设备）；`electron.cmd scripts/tests/embedded-agent-ipc-electron.cjs` 检查真实主窗口、动态端口与 preload 权限 |
| 首页选择 / 进入系统 | `client/src/page/licensePortal/`（`scene/` 常驻粒子及等比宿主桥、`PortalMonitoringLayer` 自动交接真实压力画布、`usePortalMotion` GSAP）, `client/src/page/home/loadMonitoringPage.js`, `client/src/services/displaySystemOptions.js` | portalEntry / portalSystems / sceneCatalog / sceneHostBridge / sceneMorph / sceneNavigation / monitoringSurface tests + `node scripts/tests/portal-launcher.mjs`（`--monitor-only` 单独检查真实 Home）；授权、入口渲染与切换调用变更执行 Full |
| 预览到原生点图形变 / 最新三栏控制台 | `client/src/renderers/particleEntrance.js`, `components/three/hand.jsx`, `page/licensePortal/LicensePortal.jsx`, `PortalSystemSelector.jsx`, `PortalMonitoringLayer.jsx`, `PortalMonitoringChrome.jsx`, `PortalMonitoring.css` | particleEntrance / PortalSystemSelector tests + `portal-launcher.mjs --monitor-only`：手部从列表直达、无 focused 镜头、慢加载取消/失败、GPU 进度、真实帧、三栏控件、弹窗及往返；其他渲染器不可假定已经支持顶点交接 |
| Electron 启动/关闭 | `app/electron/index.js`, `app/electron/applicationQuit.js`, `backend/runtime/index.js` | `backend/tests/server/applicationQuit.test.js`, `serverShutdownOrchestrator.test.js` + Full |
| 正式展示可读性 / 算法超市 | `page/licensePortal/PortalMonitoring.css`, `PortalAlgorithmMarket.jsx`, `portalAlgorithmCatalog.js`, `components/aside/formulaChartStore.js` | portalAlgorithmCatalog / PortalMonitoringChrome / formulaChartStore tests + `portal-launcher.mjs --monitor-only`：字号、点击/拖入、真实帧计算、删除同步、弹窗与窄屏；仅 UI 层采用 Standard |
| 系统连接 / 回放弹窗 / 批量下载 / 工具箱 | `components/title/Title.jsx`, `portalCsvBatch.js`, `portalOperationGuard.js`, `page/licensePortal/PortalControlDialog.jsx`, `PortalPlaybackDialog.jsx`, `PortalUtilityPanel.jsx` | selection / batch / guard / Title lifecycle / Chrome / Utility tests；`portal-launcher.mjs --monitor-only` 调用 `portal-workspace-controls.mjs` 检查单选与多选独立、串行结果及窄屏；完整导出范围变更涉及 `csvDownloadService`，执行 Full |
| 快捷抽屉 / 分类视角 / 传感点量尺 | `page/licensePortal/PortalWorkspaceTools.jsx`, `PortalScreenRuler.jsx`, `renderers/workspaceViewTools.js`, `components/three/hand.jsx`, `hand0205 copy.jsx` | WorkspaceTools / Utility / Chrome / workspaceViewTools tests + `portal-launcher.mjs --monitor-only`；仅 UI 使用 Standard，真实渲染变换执行 Full；量尺单位 mm，来自用户设置的相邻点中心距；原始规则矩阵经 numMatrix 接入，共享 SDK 接口变更执行 Full |
| 算法超市 Python 会话启停 | `backend/extension-host/runtime/algorithmMarketService.js`, `kernel/platform/http/httpAppFactory.js`, `client/src/page/licensePortal/portalPackageRuntime.js`, `PortalPackageOutputs.jsx` | algorithmMarket / algorithmMarketApi / portalPackageRuntime tests + Full；包含旧处理器经标准网关缺少 matrix 的输入回归，旁路消费标准帧，内部 HTTP 快照输出，不改变采集回放契约 |
| 手套点云到原生实体 | `client/src/renderers/modelParticleEntrance.js`, `components/three/hand0205 copy.jsx`, `page/licensePortal/scene/monitoringSurface.js` | modelParticleEntrance / monitoringSurface tests + `portal-launcher.mjs --monitor-only`：真实模型顶点、骨骼姿态、直接交接与返回、减少动画；双手分屏未迁移 |
| 监测返回选择弹窗 | `page/licensePortal/PortalMonitoringLayer.jsx`, `PortalLauncher.css`, `scene/sceneMotionClock.js`, `renderers/particleEntrance.js`, `components/three/hand.jsx` | PortalMonitoringLayer 真实 GSAP 回归、时钟、动态投影与末段混合单测；`portal-launcher.mjs`：GPU 归位、预览预热、材质互补混合、缓冲复用、首帧连续、固定面板、清理、inert、焦点与减少动画；前端动效采用 Standard |
| 密钥对应系统列表 | `page/licensePortal/portalEntry.js`, `portalSystems.js`, `LicensePortal.jsx`, `PortalSystemSelector.jsx`；后端 `webSocketHandlerFactory.js` 的 license-activation 回执 | portalEntry / portalSystems / PortalSystemSelector + commandApi；`portal-launcher.mjs` 检查换密钥、失败、过期与跨窗口广播；授权及 HTTP 回执变化采用 Full |
| Python worker 管道/退出 | `backend/kernel/algorithm-channel/pythonWorker.js` | `backend/tests/server/pythonWorkerLifecycle.test.js`（断管、在飞写入、重启/退出竞态）+ Full |
| 生产依赖打包 | `scripts/pack-runtime-dependencies.js`, `scripts/electron-builder-before-*.js`, `scripts/package-hooks.js` | `backend/tests/packaging/runtimeDependencies.test.js` + Full；发布须验证最终 ASAR 并实际加载包内模块 |
| 串口生命周期 / 异常提示 | `sdk/backend/serial/serialManager.js`、`serialErrors.js` → `serialControlService` / HTTP `context.waitFor` → Home / Title / `services/serial/serialFeedback.js` | `backend/tests/serial/`、`serialControlService.test.js`、`serialConnectionApi.test.js`、Title.serialConnection / serialFeedback / commandClient；Full + `portal-launcher.mjs --monitor-only` 的合成串口异常回归 |
| framing/协议 | `sdk/backend/serial/serialParserManager.js`, `sdk/backend/protocol/` | `backend/tests/serial/` |
| Display System | `backend/extension-host/`, `display-systems/` | `backend/tests/displaySystems/`, `backend/tests/server/appRuntimeDisplaySystems.test.js` |
| Python 算法包/融合输入 | `agent-resources/algorithm-packages/`, `backend/extension-host/manifest/displaySystemAlgorithmPackage.js`, `backend/extension-host/manifest/builtinAlgorithmPackageCatalog.js`, `backend/extension-host/runtime/displaySystemFrameAggregator.js`, `backend/kernel/algorithm-channel/` | `backend/tests/displaySystems/algorithmPackage.test.js`, `python/tests/test_builtin_algorithm_packages.py`, `python/tests/test_display_system_algorithm_v2.py` |
| canonical 帧 | `backend/kernel/realtime/sensorFrameEnvelope.js` | `backend/tests/contracts/`, `backend/tests/ws/realtimeTelemetryGateway.test.js` |
| WebSocket | `backend/kernel/platform/websocket/` | `backend/tests/ws/` |
| 采集存储 | `sdk/backend/collection/`, `backend/kernel/storage/` | `backend/tests/collection/`, 回放/CSV 测试 |
| 回放节奏 / 倍速 | `kernel/playback/playbackTimerService.js`, `kernel/platform/commands/runtimeControlService.js`, `kernel/platform/server.js`, `components/progress/Progress.jsx`（分别位于 backend/client） | `backend/tests/playback/playbackTiming.test.js`、生产加载/推进回归 `serverHistoryLoader.test.js`；Full；门户浏览器回归检查重载倍速同步 |
| 前端帧边界 | `client/src/services/ws/`, `sdk/frontend/core/frameBus.js` | client Vitest + SDK frontend tests |
| 渲染器 / Agent 图表 | `sdk/frontend/renderers/`, `client/src/extensions/display-system/`, `backend/extension-host/agent-apps/` | 对应 renderer/client/agentApps tests + 临时生产构建 |
| 铺满画布 / 图表浮层 | `ManifestDisplayRenderer`, `ManifestSidebarOverlay`, `useWorkspaceTop`, `displaySystemPage`, `displaySystemWorkspaceService` | `node scripts/tests/manifest-workspace-layout.mjs`（独立 Chrome、合成帧、渲染切换及图表重载）+ 布局校验/catalog tests；新增布局契约执行 Full |
| SDK 公共契约 | `sdk/backend/`, `sdk/frontend/` | 两套 SDK 测试和 smoke |

Agent 模型网络链路变更还需运行 `electron.cmd scripts/tests/embedded-agent-electron.cjs --proxy`（可叠加 `--asar`），验证真实 worker 经代理完成模型/工具调用；夹具使用合成数据，不检查实际账户权限。

Agent 复制链路：`tools/toolSchemas.js` → `tools/index.js` 的 `prepare_duplicate_system` → workspace `duplicate`；副本身份与源摘要共用 `manifest/displaySystemDuplication.js`。重点运行 `agentTools.test.js`、`runtime.test.js`、workspace/HTTP 测试及 Full，覆盖 v2/v3、独立身份和源变更。

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
