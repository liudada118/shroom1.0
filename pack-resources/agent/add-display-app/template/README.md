# 离线压力点阵模板

本目录提供最小可用的沙箱渲染器包。规则以
[`../../policy.json`](../../policy.json) 为准，安装流程见
[`../SKILL.md`](../SKILL.md)。

- 解析 `app.json`，将其作为 `POST /api/agent-apps` 请求体的 `manifest` 字段提交。
- 将 `frontend/index.html` 和 `frontend/app.js` 作为 UTF-8 文件条目放入 `files`。
- 不要在 `files` 中再次提交 `app.json`，安装器会根据 `manifest` 生成它。
- 保持 `overwrite: false`，除非用户明确授权替换该准确标识对应的应用。
- 安装后，使用 `agent:pressure-grid-demo` 选择此渲染器。
- 宿主动态响应中的 CSP 具有约束效力，不得添加可能削弱它或阻止不透明来源包资源加载的 meta CSP。

HTML 和本地外部脚本完全离线运行。脚本在启动时，以及每次有效且幂等处理的 `init` 之后，
发送 `shroom.renderer.ready`。只接收父窗口发出的
`shroom.renderer.init` 与 `shroom.renderer.frame` 消息，
绘制当前通道的 `payload.values`，按完整标准 `channelId`
维护可选的 `payload.channels[]` 状态，并通过 `shroom.renderer.error` 报告格式错误的消息。
可选且位于白名单中的 `serial` 元数据仅用于连接诊断。

模板只负责一个主画布可视化。生成的应用应保持这一分工：
公式图表通过展示系统的 `chartCards` 声明，由宿主绘制到既有侧栏。
公式无法表达 XY 轨迹或多条曲线时，在 `app.json.charts[]` 中增加本地入口；
宿主仍将其挂载到同一侧栏，不能放进主渲染器 iframe。
