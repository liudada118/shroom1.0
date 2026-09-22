# 界面、场景交接与前端数据链

> 当前实现核对日期：2026-09-16。本文说明实际代码，不把参考项目的演示能力当成已接入功能。
> 阅读目标：从点击入口追到真实画布、图表，再理解返回、取消和资源释放。

[返回开发手册](../developer-guide.md) · [文档导航](../README.md) · [后端数据与算法](data-flow.md)

## 1. 先分清三层

| 层 | 当前责任 | 不负责什么 |
| --- | --- | --- |
| 门户与选择器 | 分类、系统目录、授权入口、粒子预览、进入/返回编排 | 不生成压力测量值，不替代串口控制 |
| 旧 `Home` 业务宿主 | 当前系统、连接/采集/回放、帧分发、原生场景、侧栏及配置 | 不是已经被新门户替换掉的遗留死代码 |
| 渲染与图表 | 原生组件、注册渲染器、Manifest 部件、Agent iframe、算法输出卡 | 不应自行决定整个应用的授权及运行系统 |

[App.jsx](../../client/src/App.jsx) 使用 `HashRouter`：`/` 是门户，`/system` 仍可直接挂载 `Home`，`/display-systems` 是配置器。
门户进入监测时是在自身选择器层中嵌入 `Home`，不是每次都跳转 `/system`。

```text
LicensePortal → PortalSystemSelector → createPortalEntry
  → license.activate（HTTP 回执携带本次授权范围）→ sensor.switch（HTTP 确认）
  → loadMonitoringPage → PortalMonitoringLayer → Home
     ├─ Title：真实控制与快捷工具
     ├─ Aside：统计、公式、Agent 图表、算法包结果
     └─ 原生场景 / RendererHost / ManifestDisplayRenderer
```

入口源码：[LicensePortal](../../client/src/page/licensePortal/LicensePortal.jsx)、[选择器](../../client/src/page/licensePortal/PortalSystemSelector.jsx)、[Home](../../client/src/page/home/Home.jsx)。

## 2. 首页与弹窗：选择不等于切换运行系统

1. `LicensePortal` 通过 `useMainWebSocket` 接收连接、授权范围、已保存密钥及目录更新消息。
2. `/api/display-systems` 提供运行时定义；`buildPortalSystems` 合并内置与自定义系统。
3. `openCategory` 修改 URL 查询参数 `category/system`；没有已验证范围时提交密钥验证。`PortalSystemSelector` 先按授权过滤内置系统，再做分类和搜索；自定义安装系统沿用独立入口规则，未知授权不显示系统。
4. 单击某个系统只更新选择身份、文案和 `previewSystem`，不会发送 `sensor.switch`。
5. `SystemScenePreview` 按 `getPortalScene` 选择本地模型或矩形点阵，并在首页宿主与弹窗宿主之间交接。

目录与场景入口：[portalSystems.js](../../client/src/page/licensePortal/portalSystems.js)、[sceneCatalog.js](../../client/src/page/licensePortal/scene/sceneCatalog.js)、[SystemScenePreview](../../client/src/page/licensePortal/scene/SystemScenePreview.jsx)。

**点云预览不是实时采集。** 模型来自本地资源，矩阵预览用于形态提示；预览动画流畅不能证明设备、协议或算法已经正常。
当前手部检测 `hand` 对应矩形点阵；手套系统对应手模型；未知或 Manifest 系统使用通用矩阵，不根据名称猜外形。

选择器打开后背景 `main` 被设为 `inert`；关闭后焦点回到入口。监测已接管交互时，选择器不抢内部配置弹窗的键盘事件。
桌面选择器高度上限 780px，分类保持单行；已验证密钥收在底部“更换密钥”入口，系统列表占用剩余高度并独立滚动。未知或失败授权直接显示编辑区；表单始终挂载，以保留右侧进入按钮的提交关联。
目录请求使用 `AbortController`；重载或卸载后不写入迟到结果，目录读取失败仍显示已授权内置系统。
初始私有密钥与有效授权消息只配对一次；后续无密钥的成功广播不改列表。编辑密钥立即清空范围、取消在途验证；点击“验证密钥”读取本次 HTTP 回执，失败保持空列表。

## 3. 授权进入：使用当前提交的 HTTP 授权回执

[createPortalEntry](../../client/src/page/licensePortal/portalEntry.js) 管理验证与进入请求，内部保存 `attempt` 和超时计时器。

| 步骤 | 函数/状态 | 输入 → 输出 |
| --- | --- | --- |
| 提交 | `validate` 或 `begin` / `validating` | 锁定密钥及可选目标；校验连接、非空密钥、防重复提交 |
| 激活 | `activate` | `license.activate` 发往 HTTP 命令接口 |
| 授权回执 | `finish` | 读取 `ack.data.results` 中 license-activation 的 payload，检查日期和范围，再更新目录；仅验证请求到此结束 |
| 失效广播 | `receive` | 拒绝、锁定或过期时取消请求；成功广播不能代替当前 HTTP 回执 |
| 顺序切换 | `finish` / `switching` | 进入请求在授权匹配后调用 `sensor.switch` |
| 页面准备 | `onEntered` | 后端切换确认后进入前端加载与场景交接 |

总等待上限为 20 秒。后台自动刷新授权不会在没有 `attempt` 时自动进入系统。
`cancel` 仅取消本次前端等待；退出、断线或新尝试之后，旧回调通过身份比较失效。
**取消页面动画不等于撤销后端已经执行的授权或系统切换。** 加载失败文案会保留“系统切换已确认”的事实。

[CommandClient.execute](../../client/src/services/command/commandClient.js) 发 `POST http://127.0.0.1:19245/api/commands`，校验 HTTP、业务 `code` 和 `ack.ok`，失败抛 `CommandClientError`。
进入系统不会自动打开设备；`Home` 主连接打开时还会经现有控制链关闭串口并请求传感器目录，连接设备仍是显式操作。

`Title` 的多数旧形状按钮仍调用 `Home.wsSendObj → executeLegacyControl`，再映射成 HTTP 命令；函数名带 `ws` 不代表仍走 WS。
目前 `get/set/resetJqbedAlgorithmConfig` 是明确例外：`Home.wsSendObj` 保留 `sendWebSocketJson` 发送分支，不应把“所有配置控制已迁到 HTTP”写成完成事实。

## 4. 从预览接到真实画布

`enterMonitoringPage` 注册自定义运行时定义、保存 `localStorage.file`，并调用共享的 [loadMonitoringPage](../../client/src/page/home/loadMonitoringPage.js) 动态加载 `Home`。
它用单个导航 `AbortController` 丢弃取消后的加载结果，但动态模块下载本身不因此回滚。

### 当前支持范围

| 系统 | 进入路径 | 真实场景交接 |
| --- | --- | --- |
| `hand` | 列表原位直接准备 | [hand.jsx](../../client/src/components/three/hand.jsx) 的矩阵点图通过粒子入口接口接续 |
| `hand0205`、`handGlove115200`、`handGloveFullPacket` | 列表原位直接准备 | [hand0205 copy.jsx](../../client/src/components/three/hand0205%20copy.jsx) 的受支持手模型接续 |
| `hand0205Double` | 非直接入口 | 双手分屏没有获得同样的实体顶点交接支持 |
| 其他系统/其他渲染模式 | 先执行预览镜头过渡 | 有粒子接口则接续；没有则淡入真实页面，不能宣称全部已迁移 |

[PortalMonitoringLayer](../../client/src/page/licensePortal/PortalMonitoringLayer.jsx) 先挂载低透明度、不可交互的真实 `Home`，再用 `waitForMonitoringSurface` 检查主画布。
检查目标限定 `.portal-data-renderer` 内的 Canvas/SVG/iframe：尺寸非零、不是模型加载中，连续两次动画帧找到同一节点。
4 秒超时后也会展示原生加载或错误状态；**这里的“就绪”是展示面就绪，不是收到首帧传感器数据的证明。**

交接时读取 `canvas.shroomParticleEntrance`，通过 `capturePreview` 事件取得当前点云的屏幕投影。
有接口和投影时调用 `api.play`；由真实渲染器把预览点位变成自己的点阵/模型，而不是另开一个“假监测页”。
主画布交接同时，标题、观测栏、快捷工具执行各自入场动画；完成后移除内容 `inert`。
无接口时使用 `crossfade`，保持真实业务宿主挂载。

粒子接口：[particleEntrance.js](../../client/src/renderers/particleEntrance.js)、[modelParticleEntrance.js](../../client/src/renderers/modelParticleEntrance.js)。
准备判据：[monitoringSurface.js](../../client/src/page/licensePortal/scene/monitoringSurface.js)。

## 5. 返回：先归位，再卸载

`PortalMonitoringLayer.leave` 锁定 `leaving` 防重入，停止入场 tween，将真实页面设为不可交互。
工具栏、侧栏和其他 HUD 淡出；支持交接的画布执行同一 `api.play` 的 `reverse` 路径。

直接入口的返回过程中，`resolveSource` 每帧调用 `capturePreview(1 - progress)`：

- 隐藏预览提前恢复浮动时钟，原生画布追随同一时刻的新投影，避免落地后突然从静态变动态。
- `returnPreviewBlend` 在归位末段混合原生画布与预览材质，避免位置一致却亮度/点纹理硬切。
- 等粒子归位与 HUD 退场都完成后才调用 `onBack`，卸载 `Home`，恢复选择器焦点。

无有效粒子会话则走淡出降级；非直接入口返回后还有预览镜头恢复阶段。
改变“减少动画”偏好时，GSAP `matchMedia` 清理上一组动画；退场中改变偏好也必须完成返回，不能卡在 `inert` 页面。
临时透明度、可见性与 backdrop 状态在清理时恢复；取消监听、计时器和 RAF 必须一起释放。

[sceneMotionClock.js](../../client/src/page/licensePortal/scene/sceneMotionClock.js) 管理预览时钟；[sceneNavigation.js](../../client/src/page/licensePortal/scene/sceneNavigation.js) 管理镜头过渡。
`SystemScenePreview` 常驻时保留模型目标及投影，隐藏或文档不可见时暂停；最终卸载才释放几何体、材质、纹理、renderer 和事件监听。

## 6. 真实帧如何到前端

主服务的数据地址由 [constants](../../client/src/constants.js) 中 `WS_URLS.MAIN` 提供；不是按坐垫、靠背、头枕分别维护三个本机服务端口。
门户与嵌入的 `Home` 可以各持有连接，它们连接同一数据服务；“单服务端点”不代表整个前端只有一个 WebSocket 对象。

```text
WebSocket 消息
→ decodeWebSocketPayload / adaptSensorFrameForClient
→ Home.isCurrentDisplayFrame（按 displaySystemId 隔离）
→ Home.wsData，必要时 ws1Data / ws2Data（同一连接的逻辑分支）
  ├─ Manifest：readManifestChannelFrames → pushFrames
  └─ 原生：sitTypeEvent → 组件 ref；同时 buildSceneFrame → publishFrame
```

[sensorFrameDecoder.js](../../client/src/services/ws/sensorFrameDecoder.js) 保留 canonical 身份，统一读取 `payload.value`、`payload.stages`、`payload.matrix` 和指标/姿态等字段。
声明为 `sensor.frame` 但身份契约不合法的帧不能降级为旧格式绕过隔离；已有 `displaySystemId` 时不能用同名 `sensorType` 放行其他系统。
顶层 `sitData/backData/headData` 仅在这个接收兼容边界读取旧服务消息，不是推荐给新模块的输入契约。

**wire `sensor.frame`、Home 内部适配对象、渲染 `SceneFrame`、Agent bridge DTO 是不同结构。** 不要把某一路数组直接当成另一层的完整帧。
`Home` 中的旧 `sitTypeEvent → util → this.com.current.*` 与新的帧总线并存，迁移并未完成。
[frameBus](../../sdk/frontend/core/frameBus.js) 同步通知订阅者、缓存最后一帧，新订阅立即补发；某个订阅者异常不阻断其他订阅者。

[RendererHost](../../sdk/frontend/react/RendererHost.jsx) 按注册 ID 懒加载组件：传 `frameChannel` 时直接订阅总线并命令式推送；传 `values` 时走声明式适配。
总线订阅不经过 React state，但 Manifest 当前使用 `channelFrames` state，不能把“不进 state”描述成所有前端路径都已实现。
本地 [RendererHost 包装](../../client/src/renderers/RendererHost.jsx) 还负责注册主应用的 `pointGrid`；不能删成单纯 re-export 后遗漏注册。
总线必须是同一个 SDK 实例；重复安装出两个实例会表现为发布成功但渲染器收不到帧。

## 7. Manifest、Agent 与图表分工

[ManifestDisplayRenderer](../../client/src/extensions/display-system/ManifestDisplayRenderer.jsx) 嵌入 `Home` 时 `enabled=false`，由 `Home.handleManifestSceneFrame` 推送；独立使用时才自行订阅。
`readManifestChannelFrames` 校验当前定义和传感器身份；`reduceManifestChannelFrames` 按通道保存各自最新帧。
多传感器帧进入同一画布，`sidebar.source` 只决定统计取哪路，不负责裁掉其他画布输入。

该组件按定义解析显示方案、矩阵变换、可视算法和 widget，内置类型交给对应 widget 或 `RendererHost`，Agent 类型交给 `AgentRendererHost`。
布局默认铺满工作区；显式 `presentation: immersive` 隐藏图表；额外标题/方案栏由 `controls.runtimeChrome` 显式开启。
声明的 `sensors[]` 不等于每路已有数据：Agent `channels[]` 仅包含实际收到有效点值的通道，不塞假空帧凑齐清单。

[AgentRendererHost](../../client/src/extensions/display-system/AgentRendererHost.jsx) 使用 `sandbox="allow-scripts"` iframe；[agentRendererBridge](../../client/src/extensions/display-system/agentRendererBridge.js) 构造白名单消息。
宿主发送 `shroom.renderer.init`，收到当前 iframe 的就绪响应后发送最新帧；重载或身份变化需要新握手，显式错误不再被超时文案覆盖。
iframe 的 `event.source` 必须匹配；opaque origin 下发送使用 `*` 不代表允许任意窗口回写。
没有身份显示“等待传感器通道”，就绪但没帧显示“等待传感器数据”；重载模块不重启串口和其他图表。

Manifest 统计经 `onSidebarData → Home.handleManifestSidebarData → Aside`；原生系统仍可能由旧场景计算侧栏。
[Aside.updateFormulaCharts](../../client/src/components/aside/Aside.jsx) 推送公式运行时，并合并 Agent 图表的最新帧；图表不是全部直接订阅 `frameBus`。
Agent 图表通过 `agent-chart:` ID 注册到宿主侧栏，`renderAgentChartCard` 用 `AgentRendererHost surface="chart"` 挂载，不要求把整页塞进主渲染 iframe。
[formulaChartStore](../../client/src/components/aside/formulaChartStore.js) 管图表定义与变更通知；公式输入、图表定义和运行结果不能混成同一存储对象。

## 8. 算法超市的两条链，不能混称“启用算法”

| 分类 | 点卡片后发生什么 | 数据来源 |
| --- | --- | --- |
| 指标图表 | `addFormulaChartFromTemplate` 写当前系统图表 store；拖入也是同一入口 | 原生统计或 Manifest 矩阵/声明算法指标 |
| Python 算法包 | HTTP 请求当前会话启停，后端确认后显示已启用 | 后端标准帧旁路与真实 Python 输出历史 |

[PortalAlgorithmMarket](../../client/src/page/licensePortal/PortalAlgorithmMarket.jsx) 是非模态底栏；打开时管理自己的焦点/Escape，关闭不卸载已启用结果。
[buildPortalAlgorithmTemplates](../../client/src/page/licensePortal/portalAlgorithmCatalog.js) 对原生旧页只提供统计模板，不把缺失矩阵当零值计算；Manifest 可列矩阵模板及声明输出。
拖放仅接受当前系统及当前模板 ID；重复添加保持用户编辑，不把参考项目演示曲线带入真实图表。

[usePortalPackageRuntime](../../client/src/page/licensePortal/portalPackageRuntime.js) 访问 `/api/algorithm-market`，请求包含 `sensorType/packageId/channelId/enabled`，不接受任意 Python 路径。
GET 轮询串行、单次 4 秒超时，活跃时请求结束后等待 500ms；POST 启停 5 秒超时、同一时刻只允许一个变更。
变更版本和卸载标志丢弃旧轮询；返回 `sensorType` 与当前系统不同则显示切换中，不渲染上一个系统结果。
按钮受 `allowed/reserved/live/inputError/matrix/compatibility` 约束：主图有数据但矩阵身份不完整时仍可能禁止算法，这是两条输入链的校验差异。

[PortalPackageOutputs](../../client/src/page/licensePortal/PortalPackageOutputs.jsx) 将 `instance.history` 中实际标量按时间画成队列趋势，通过 portal 放入左侧 Aside。
`packageMetricValue` 过滤未稳定/检测中哨兵及生命体征算法故障；空值断线显示，不用总压力趋势替代呼吸。
关闭超市时只要算法仍启用就继续读结果；切换系统后需要重新选择会话算法，不应把图表 store 的持久配置当作会话仍在运行的证据。

## 9. 状态与释放检查表

### 当前系统控制界面

`Title` 仍是业务适配层，但门户不再挂载旧 `titleItems`。当前入口为：

| 入口 | 表面与行为 | 业务连接 |
| --- | --- | --- |
| 连接设备 | 会话栏直接显示串口下拉，展开刷新、选择连接；多角色在设备区内部滚动，保留关闭入口 | 复用旧角色与 Manifest 多传感器打开/关闭逻辑；选择端口不是收到有效帧的证明；网络设备仍填地址 |
| 回放 | [PortalPlaybackDialog](../../client/src/page/licensePortal/PortalPlaybackDialog.jsx) 弹窗；圆形单选载入、方形多选下载，搜索/分页不改选择 | `changePortalMode` 确认模式后显示；采集中禁止进入；`loadPortalPlayback` 只载入单选首帧，播放仍用原进度条 |
| 工具 | [PortalUtilityPanel](../../client/src/page/licensePortal/PortalUtilityPanel.jsx) 低矮非模态工具条，与算法超市互斥；说明在 hover/focus 显示 | 清零/恢复、显示语言、系统专用功能与配置器；显示/校准/报告沿用原回调；波特率在显示设置的串口参数内 |

`portalPlaybackValue` 和 `portalDownloadValues` 相互独立，前者不直接覆盖已经载入的 `dataTime`。系统切换清空两组选择。
重新打开或刷新回放列表不重置当前回放；确认载入新记录才暂停播放并归零播放条。历史删除仅针对单选项，经过明确的不可恢复确认，不使用下载勾选集合。

[portalOperationGuard](../../client/src/components/title/portalOperationGuard.js) 捕获系统作用域，在逐条发送兼容命令前检查是否仍有效；跨 `await` 切换系统或卸载后，不再发送旧的加载/删除/模式命令。删除非当前载入项不动播放条。换系统清除导出 busy 状态；没有本地活动导出时忽略迟到的全局下载状态。

批量下载先保存日期快照，再进入原路径/格式弹窗。[createPortalCsvBatch](../../client/src/components/title/portalCsvBatch.js) 同时等待 HTTP 接受和 WS 完成，再调度下一条。逐条结果累计到原文件清单；明确失败继续下一条，无活动超时或 HTTP 结果不确定停止剩余项、不自动重试。离开页面销毁队列会停止后续调度，但不能取消服务端已开始的导出。

批量请求带 `downloadOptions.rangeMode: 'full'`，不继承当前回放选区，也不修改回放位置。现有 WS 完成事件没有请求身份，因此该控制器只适用于一个活跃导出方；不同窗口或外部 Agent 同时导出仍不能可靠归属结果，不能宣称支持并行批次。

快捷工具通过左侧竖向拉手横向收进右边缘，收起时内容 inert、定位高度不变；抽屉 `.portal-quick-tools-slide` 与 GSAP 入场层分离。动画可反向打断并遵循减少动画偏好。`PortalControlDialog`/回放弹窗限定视口高度，列表内部滚动，不推高主画布。

工具箱为 176px 高分类栏：视角调节 / 数据分析 / 数据处理 / 系统设置。工具单排、仅条内横向滚动；Tooltip 挂 body，悬停与键盘焦点都能显示，禁用项仍有说明。面板不拦截外部画布输入，可边看工具边操作。

`PortalWorkspaceTools` 读取当前 renderer ref 的 `getViewTools()`，本轮接入原生 `hand.jsx` 点图及 `hand0205 copy.jsx` 手模型：30° 旋转、俯视、缩放和 X/Z 镜像只影响展示，不改传感器压力数组或采集/下载。未接入的渲染器禁用相应项；既有清零/恢复命令位于数据处理类。

框选走 `Home.changePortalSelection → renderer.changeSelectFlag → 原生区域统计`；模型旋转或展示镜像后不满足旧投影假设，须先恢复视角再框选。视角变化退出选区/量尺，二者互斥。`PortalScreenRuler` 量的是 CSS px 屏幕距离，不能用于物理毫米标定；可点击两点、拖拽或方向键配合 Enter，Escape 退出，窗口尺寸变化清线。系统、渲染模式、实时/回放切换清掉分析状态。

原生 Canvas 可能随实时/回放重建；返回系统列表时，`PortalMonitoringLayer` 使用当前画布的 `shroomParticleEntrance` 接回预览，不复用已销毁的入场引用。时间线、互补透明度、Abort 清理沿用原逻辑。

| 所有者 | 状态 | 清理/切换要点 |
| --- | --- | --- |
| `LicensePortal` | 目录、选中系统、授权输入、导航加载、预览可见性 | 中止导航/请求；不声称回滚已确认命令 |
| `createPortalEntry` | 本次授权尝试、超时、授权范围 | 取消后忽略迟到确认 |
| `PortalMonitoringLayer` | 进入/返回、图表可见性、粒子会话 | GSAP 回收、临时样式还原、等待归位后卸载 |
| `Home` | 真实系统/模式/连接/业务 UI、帧转发 | 关闭自己的 WS、清重连/节流/采集计时器、退订图表、清最后帧 |
| `Title` / `createPortalCsvBatch` | 设备与设置弹层、回放单选、下载多选、串行导出 | 系统切换清选项；卸载释放 watchdog 与后续调度；已执行的后端操作不声称回滚 |
| `SystemScenePreview` | 模型目标、相机、粒子、浮动时钟 | 隐藏暂停；卸载释放 GPU 资源及监听 |
| `ManifestDisplayRenderer` | 各通道最新帧、方案选择、Agent 目录 | `profileId` 变化清帧，目录迟到结果失效 |
| `usePortalPackageRuntime` | 快照、变更请求、轮询 | 中止请求、忽略旧系统响应；后端负责实例生命周期 |

快捷工具的永久位置属于 `.portal-quick-tools-anchor`，GSAP 只动画内部 `.portal-quick-tools` 卡片；不要在同一节点同时用 CSS translate 做定位、GSAP clearProps 清 transform。
样式入口：[PortalMonitoring.css](../../client/src/page/licensePortal/PortalMonitoring.css)、[PortalMonitoringChrome](../../client/src/page/licensePortal/PortalMonitoringChrome.jsx)。

## 10. 按现象追代码，不先重写整个页面

| 现象 | 优先检查 |
| --- | --- |
| 点进入没反应/自动进错系统 | `createPortalEntry` 的 attempt、授权消息、HTTP ack 与 `sensor.switch` 顺序 |
| 先放大再硬切/手部变手模型 | `directEntry` 清单、`getPortalScene`、当前真实渲染模式是否提供粒子接口 |
| 返回落地时突然动起来 | 返回 `resolveSource`、motion clock、末段 blend 和 cleanup；不是只延长 opacity |
| 主图刷新但算法不能点 | 快照 channel 的 `live/inputError/matrix` 和包兼容声明，再查后端输入校验 |
| Agent 图表长度不符/超时 | bridge DTO 的矩阵、values/rawValues 与通道身份；区分 iframe 握手与传感帧缺失 |
| 隐藏图表后统计失效 | 是否误卸载仍承担业务的旧组件；图表可见性不应切断真实数据处理 |
| 切换后残留前一系统点阵 | 身份过滤、Manifest 清帧、总线 `clearLastFrame`、懒加载迟到结果 |

静态核对入口不等于真机验证。下面是对应回归位置，本次文档整理没有运行这些测试：

- 授权/目录：[portalEntry.test.js](../../client/src/page/licensePortal/portalEntry.test.js)、[portalSystems.test.js](../../client/src/page/licensePortal/portalSystems.test.js)。
- 粒子/返回：[particleEntrance.test.js](../../client/src/renderers/particleEntrance.test.js)、[modelParticleEntrance.test.js](../../client/src/renderers/modelParticleEntrance.test.js)、[sceneMotionClock.test.js](../../client/src/page/licensePortal/scene/sceneMotionClock.test.js)。
- 帧/通道：[sensorFrameDecoder.test.js](../../client/src/services/ws/sensorFrameDecoder.test.js)、[frameBus.test.js](../../sdk/frontend/core/frameBus.test.js)、[agentRendererBridge.test.js](../../client/src/extensions/display-system/agentRendererBridge.test.js)。
- 超市：[portalAlgorithmCatalog.test.jsx](../../client/src/page/licensePortal/portalAlgorithmCatalog.test.jsx)、[portalPackageRuntime.test.jsx](../../client/src/page/licensePortal/portalPackageRuntime.test.jsx)。
- 真页面隔离回归：`node scripts/tests/portal-launcher.mjs --monitor-only`，脚本使用受控消息/算法输入，不证明实际设备或安装包工作正常；完整入口回归去掉参数。
- 布局回归：`node scripts/tests/manifest-workspace-layout.mjs`；改动验证分级见 [ARCHITECTURE_INDEX](../../ARCHITECTURE_INDEX.md)。

## 11. 内置场景预览资源与连续交接（2026-09-22）

`nativeSceneAssets` 与原生模型渲染器共享 URL、备用资源和足底图平面配置。`sceneCatalog` 按真实型号选择模型，不按机器人/座椅大类替代；`sceneLayouts` 处理无模型的矩阵、OneStep 平面及双足轮廓，`sceneModelSampling` 按世界表面积分配粒子。预览仅表示展示外形，不生成压力、算法读数或采集帧。

小床 (`jqbed`)、宠物/mini 看护与 64×64 高速加入 `supportsDirectSceneEntry`，通过真实画布的 `shroomParticleEntrance` 单段进入和反向返回。小床及高速点图的门户宿主调整由组件内 ResizeObserver 维护，原生几何和数据处理仍属于原渲染器。实体模型未在本次批量接入粒子交接，进入仍可降级为淡入。

新增回归 `node scripts/tests/portal-scene-catalog.mjs`：逐项加载用户报告的 12 个系统预览并截图，检查上述 4 个原生画布往返的 GPU 权重、尺寸、样式清理及减少动画；使用合成授权和拦截接口，不接触真实设备。

### 2026-09-22 后续：座椅、足底与机器人实体交接

`wholeChair`、`carQX`、`minzhen`、`footVideo`、`robot1`（G1）、`robotSY`（N2）、`robotLCF`（H1）已补齐上述实体交接缺口。Home 显式传入 `portalEmbedded`，`nativeSceneEntrance` 维护真实资源加载状态、宿主尺寸和卸载清理；`nativeSceneSamples` 按世界表面积选取固定三角形及重心坐标，过渡时跟随原模型/骨骼与相机。足底只采样已经加载的原生双平面透明轮廓，不创建另一套脚模型，也不改压力矩阵。

`modelParticleEntrance` 将采样点接到原实体表面，再显出原材质，反向返回复用当前预览投影。`monitoringSurface` 对受管原生模型延长等待至最多 30 秒，超时/失败显示错误，迟到结果不能再弹出；正常未完成加载可通过“取消进入”退出。只有上述原生类型和它们的副本新增直接交接，其他未接入类型仍保留原路径。

`portal-scene-catalog.mjs` 现覆盖 13 个预览和 11 个原生往返，`--native-only` 聚焦新增的 7 项实体场景，并检查实际 GPU 中间权重、慢加载、资源失败和减少动画。原生采样及生命周期测试使用真实 Three 几何，设备/授权接口仍由浏览器夹具拦截。
