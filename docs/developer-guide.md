# 开发者手册：当前代码如何运行

> 核对日期：2026-09-11。描述当前源码，不描述未来平台目标。入口见 [文档导航](README.md)。
> 本次依据源码和已有测试入口做静态核对；不等同于安装包或真实硬件验收。

## 1. 从哪里开始读

先读本页，理解进程、启动和扩展边界；再按工作选一条链路，不必通读全部文档。

| 你要搞清楚的事 | 阅读位置 |
| --- | --- |
| 程序怎么启动、资源在哪、为什么开发正常而安装包异常 | 本页第 2、3、5 节 |
| 串口字节怎样变成压力帧，怎样采集、回放和导出 | [数据与算法链路](chains/data-flow.md) |
| 首页、弹窗、进入、渲染、返回的状态和动画怎么衔接 | [界面与渲染链路](chains/interface-flow.md) |
| 新系统、Python 算法、自定义渲染和图表如何接入 | 本页第 4 节，再读上述两条链路的对应部分 |
| 修改后该跑哪些测试 | [验证矩阵](../ARCHITECTURE_INDEX.md) |
| 某个设计为什么曾这样改 | [历史架构与维护记录](../ARCHITECTURE.md)，按符号或日期搜索 |

每条链路以“入口 → 函数 → 数据 → 状态 → 异常 → 测试”组织。文件名可点击，函数名可用 `rg` 定位，不绑定易漂移的行号。

## 2. 运行边界：不是一个网页，也不是完全拆开的微服务

```text
Electron 主进程 app/electron/index.js
  └─ backend/runtime/index.js → backend/kernel/platform/server.js
       ├─ 串口 / 协议 / 处理 / 采集 / SQLite
       ├─ HTTP 控制及配置 :19245
       ├─ 单 WebSocket 数据与状态 :19999
       └─ Python worker → 常驻 Python 子进程（stdio RPC）

Electron 渲染进程
  └─ React 门户 → Home / Manifest 展示 → Three.js、Canvas、图表
       └─ Agent iframe（由宿主转发只读帧，不直接连接硬件）

网页来源：开发态 Vite；打包态本地 build 静态服务 :12321
```

- 后端由 Electron 主进程加载，不是默认独立 Node 服务；同步计算、数据库操作会占用这个进程的事件循环。Python 才是另起的算法子进程。
- [窗口配置](../app/electron/index.js) 启用 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`；需要系统能力时查 [preload](../app/electron/preload.js)，不要在 React 中直接使用 Node API。
- [HTTP/WS 契约](../sdk/backend/contract/sdkApiContract.js) 将新命令传输定义为 HTTP、帧传输定义为 WebSocket。存量扁平 WS 控制入口仍在运行，`Home.wsSendObj` 的三个 JQBed 算法配置命令仍走 WS；不能将迁移方向写成已经全面完成。多传感器靠 `channelId` 区分，不靠增加端口。
- `backend/kernel` 是应用编排；协议、串口底层、采集等通用实现位于 `sdk/backend`。`client/src/renderers/RendererHost.jsx` 是应用适配入口，组件主体来自 `sdk/frontend`。
- 旧 `Home` 和旧传感器处理器仍在真实调用链上；“已接入统一契约”不表示内部所有旧状态和分支都已删除。

## 3. 启动、关停与路径

### 启动顺序

| 步骤 | 实现入口 | 输入、输出和状态 |
| --- | --- | --- |
| 1. 应用就绪 | [index.js](../app/electron/index.js) 的 `app.whenReady`、`createWindow` | 创建并缓存 `mainWindow`，重复激活优先聚焦已有窗口 |
| 2. 装配后端 | [runtime/index.js](../backend/runtime/index.js) 的 `openServer` → [server.js](../backend/kernel/platform/server.js) | 固定桥懒加载组合根；组合根持有运行上下文、串口、存储、HTTP、WS 和扩展宿主 |
| 3. 选网页来源 | `createWindow` → `startViteAndLoad` / `startStaticServer` | `!app.isPackaged` 且存在 client/Vite 才走开发态；开发服务失败有静态资源降级 |
| 4. 加载页面 | `resolveBuildRoot`、`win.loadURL` → [App.jsx](../client/src/App.jsx) | 打包态优先 `resources/build/index.html`，再查应用路径的 build；随后由前端门户组织系统选择 |
| 5. 进入业务 | [portalEntry.js](../client/src/page/licensePortal/portalEntry.js) | 用户确认进入才提交授权与系统切换；列表预览不是串口接入成功 |

后端监听器可能在模块装配期间创建；不要把某个同步函数返回当成 HTTP/WS 已监听、串口已产帧的证明。

### 关闭顺序

`before-quit` → [createApplicationQuitHandler](../app/electron/applicationQuit.js) 阻止第一次退出
→ `cleanupApplicationResources` → 后端 `shutdownServer` → 清理完成后再次 `app.quit()`。

- Electron 清理共用一个 Promise；停止开发服务，并行关闭前端静态服务和后端。
- 后端先停 Display System 分发并 dispose 算法超市，再进入 [serverShutdownOrchestrator](../backend/kernel/platform/bootstrap/serverShutdownOrchestrator.js)。
- 编排器停止回放和串口重连，先标记关闭状态，再用先前捕获的句柄关闭串口、WS、HTTP、Python 和数据库。
- 顶层等待上限为 8 秒；部分资源关闭有自己的超时。退出成功不证明每项都正常释放，异常要看日志中的 warning。

### 资源路径：不要用安装目录推断用户数据位置

依据 [createServerPathConfig](../backend/kernel/platform/serverPathConfig.js) 和 [Agent App 服务](../backend/extension-host/agent-apps/agentAppService.js)：

| 内容 | 开发态 | 打包态 |
| --- | --- | --- |
| 只读运行资源 | 项目根 | `process.resourcesPath` |
| 数据库 | 项目根 `db/` | `app.getPath('userData')/db/` |
| 用户展示系统 | 项目根 `display-systems/` | `userData/display-systems/` |
| 用户 Agent App | 项目根 `agent-apps/` | `userData/agent-apps/` |
| 上传图片 | `runtime/uploads/` | `userData/img/` |
| CSV | `runtime/exports/csv/` | Windows：`resources/data/`；macOS：桌面 `data/` |
| 报告 | `runtime/exports/reports/` | Windows：`resources/OneStep/`；macOS：桌面 `oneStepPdf/` |

后两项仍存在安装资源目录写入的旧路径，不能笼统声称“所有运行数据都已放进 userData”。授权配置另由 [licenseHelper](../backend/kernel/platform/license/licenseHelper.js) 解析候选位置，不复制真实密钥到文档或示例。

**排查顺序：** 白屏先查 `Static build root` 和资源请求；端口冲突查监听错误；关机报错查清理及 Python 管道；写盘失败查实际解析路径和权限。
对应测试：[应用退出](../backend/tests/server/applicationQuit.test.js)、[后端关闭](../backend/tests/server/serverShutdownOrchestrator.test.js)、[路径配置](../backend/tests/platform/serverPathConfig.test.js)。

## 4. 新展示系统到底怎样装进去

先区分三种对象，不要用“插件”把它们混为一谈：

| 对象 | 定义与执行位置 | 用途 |
| --- | --- | --- |
| Display System | `display-system.json` / `system.json`，由 extension-host 校验与绑定 | 业务身份、逐传感器协议、线序、算法及显示配置 |
| 算法包 | `algorithm-package.json` + 入口源码，经算法运行器调用 | 输出声明的矩阵或指标；Python 生命周期及输入见数据链路 |
| Agent App | `app.json` + 静态前端文件，运行在宿主 iframe | 主画布 renderer、侧栏 chart，或两者；不是新的串口服务 |

### Display System：保存、发现、绑定是不同步骤

```text
Builder / Agent 提交 manifest + definitions
  → HTTP /api/display-systems
  → appRuntime.displaySystems.save
  → Workspace 校验并保存用户目录
  → reloadDisplaySystems：重新发现 + 已有运行依赖下重新绑定
  → runtime controller 注册通道与算法
  → 用户激活系统 / 打开对应串口 → 收到实际帧
```

实现从 [createAppRuntime](../backend/extension-host/appRuntimeFactory.js) 开始，继续看
[Workspace](../backend/extension-host/workspace/displaySystemWorkspaceService.js)、
[Discovery](../backend/extension-host/runtime/displaySystemRuntimeDiscovery.js) 和
[Runtime Controller](../backend/extension-host/runtime/displaySystemRuntimeFactory.js)。

- `runtimeBindingOptions` 保存首次绑定依赖，供后续重载使用；仅改磁盘文件不等于当前绑定已更新。
- 内置配置有只读访问边界；默认保存不覆盖。重复 ID 有明确冲突处理，不应让用户同名目录悄悄替换内置系统。
- `definitions` 的文件、矩阵和引用校验属于安装过程；实时点数和通道归属还要在数据链路验证。
- 外观局部修改走 `saveDisplaySection`。端到端验收必须看到目标通道实际产帧，不能只看“保存成功”“bound”“open”。

### Agent App：只安装静态展示，不执行后端代码

[agentAppService](../backend/extension-host/agent-apps/agentAppService.js) 校验路径、权限和文件清单，
在临时目录准备后切换安装目录；[HTTP 层](../backend/kernel/platform/http/httpAppFactory.js) 提供资源并附加 CSP。

前端发现 `agent:<appId>` 或 `agent-chart:<appId>:<chartId>` 后，在主画布或图表区域建立 iframe，
经宿主消息桥传入初始化配置和同一来源的帧。宿主不会 `require` 包内前端 JS。
权限目前为 `sensor.read`；绘制代码、算法代码和硬件控制不是同一种安装入口。

**排查顺序：** 目录接口是否列出 → manifest/文件校验 → 已激活系统及 bindings → 对应 channel 是否产帧 → iframe 初始化/帧形状。
完整 UI 挂载和超时定位见 [界面链路](chains/interface-flow.md)。

### 能力与字段从哪里查

| 查询 | 技术来源 |
| --- | --- |
| 路由、命令 ACK、标准帧和稳定契约 | `GET /api/sdk/contract`；[sdkApiContract.js](../sdk/backend/contract/sdkApiContract.js)、[多传感器契约](../sdk/backend/contract/multiSensorStableContract.json)、[commandSchema.json](../sdk/backend/contract/commandSchema.json) |
| 当前协议预设 | `GET /api/serial/protocols`；[协议预设实现](../sdk/backend/protocol/presets/index.js) |
| Builder 可选算法、渲染、图表和布局字段 | `GET /api/display-systems/catalog`；[Workspace catalog](../backend/extension-host/workspace/displaySystemWorkspaceService.js) |
| 已发现的系统及重载情况 | `GET /api/display-systems`；[Discovery](../backend/extension-host/runtime/displaySystemRuntimeDiscovery.js) |
| 当前通道与订阅 | `GET /api/channels`、`GET /api/ws/status` |
| Agent 展示安装权限 | `GET /api/agent-apps/policy`；[policy.json](../agent-resources/policy.json) |

以上是运行中的本机服务入口，不是本次文档任务已经调用或验证过的接口。算法超市的内部 `/api/algorithm-market` 与公开 SDK 契约需分开看，详见数据链路。

## 5. 开发、构建、安装包是三层验证

命令定义以 [根 package.json](../package.json) 和 [client/package.json](../client/package.json) 为准：

| 命令 | 实际用途 |
| --- | --- |
| `npm start` | Electron Forge 启动桌面应用，满足开发条件时主进程启动/连接 Vite |
| `npm --prefix client run dev` | 只启动前端，不等于后端或硬件已经就绪 |
| `npm run build-client` | 生成网页 build；不生成完整安装包 |
| `npm run build` | 准备资源后走 electron-builder Windows 构建，再注入发布说明 |
| `npm run make` | 准备资源后走 Electron Forge make；与 builder 的打包钩子不是同一套 |
| `npm run build-mac-release` | macOS 发布流程；按 [专项发布文档](mac_release_flow.md) 核对条件 |

发布命令会清理既有输出并生成较大产物，不能把它当日常文档检查或只读诊断命令。

资源准备链为 `build-client` → `build-python-runtime` → `sync-pack-resources` → NSIS 协议准备。
[sync-pack-resources.js](../scripts/sync-pack-resources.js) 同步初始化数据库、Python 和 Agent 规则，
并检查打包的 Python runtime 是否包含 `onbed_filter`。它不是将当前用户数据库整个复制进包。

- Agent 规则源码在 `agent-resources/`；Forge 使用 `pack-resources/agent`，builder 的 extraResources 从源码目录复制到 `resources/agent`。不要把打包副本作为唯一修改源。
- builder 的 [beforePack](../scripts/electron-builder-before-pack.js) 收集实际安装的生产依赖；[afterPack](../scripts/electron-builder-after-pack.js) 经 [package-hooks](../scripts/package-hooks.js) 检查 ASAR 依赖闭环，防止 express 等包的间接依赖漏装。
- Native 模块使用 Electron ABI；网页构建通过不能证明 SQLite、串口或 Python 二进制能在安装包中加载。
- 开发态前端 HMR、用户扩展安装/reload、桌面程序升级是三种机制。现有本地静态加载不能表述成“每次联网自动缓存最新网页”。

打包故障按“源码依赖 → 资源准备 → ASAR 内依赖 → resources 文件 → userData 配置 → 实机帧”逐层定位。
回归入口：[生产依赖测试](../backend/tests/packaging/runtimeDependencies.test.js)、[Python 运行时构建脚本](../scripts/build-python-runtime.js)。

## 6. 修改位置与验证

| 需求 | 优先修改位置 | 不应顺手改动 |
| --- | --- | --- |
| 改首页、弹窗、动效、快捷工具 | `client/src/page/licensePortal/`，必要时到 Home 接口 | 串口、帧身份、采集格式 |
| 改已安装系统的布局、图表 | Display System display 段、Agent App 或宿主图表组件 | 硬件协议与线序 |
| 接新硬件 | 协议预设 + manifest 传感器定义；缺能力时才扩底层 | 根据外观猜矩阵、静默复制不匹配协议 |
| 增加算法 | 算法包、运行器/超市适配、指标定义 | 用压力趋势代替算法结果 |
| 改多传感器身份、保存或回放 | SDK 契约与后端链路联合修改 | 只修实时页面而遗漏历史数据 |

先看 [ARCHITECTURE_INDEX.md](../ARCHITECTURE_INDEX.md) 的验证矩阵。
文档仅查链接、符号与描述；普通代码改动 Standard；公共契约、依赖、启动和打包等高风险改动 Full。
构建检查用临时目录，不能覆盖用户现有 build。测试通过与真实串口、安装包验证要分别记录。

本手册只维护当前实现：代码改到哪条链路就更新哪一节。历史原因与验证流水仍追加到根架构台账，
新设计方案明确标“方案”，不再生成第二份并列的“当前架构”。
