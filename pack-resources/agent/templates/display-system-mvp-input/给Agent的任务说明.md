# 给 Agent 的任务说明

请使用当前运行中 Shroom 软件的公开能力，根据我提供的 MVP 输入包生成并安装一个新的展示系统。

输入包绝对路径：`请替换为复制后目录的绝对路径`

执行要求：

1. 先读取 `/api/sdk/contract`、`/api/agent-apps/policy`、展示系统 catalog 和实时协议预设，不使用记忆中的固定列表。
2. 读取输入包全部文件和 `attachments/` 中的原始文档；先列出缺失或相互矛盾的信息。
3. 每个传感器严格使用 `02-sensors.csv` 中的 sensor id、业务名称和 output channel。不要根据 COM、协议或数组顺序推断座椅/靠背/左右手。
4. 协议识别只有 `matched` 才能自动采用；`ambiguous` 或 `unknown` 时停止并向我说明需要什么证据。
5. 线序转换只执行一次。协议解码后的原始数组、标准矩阵、实时展示、存储、回放和 CSV 必须保持可追踪的一致关系。
6. 优先选择 catalog 中已有的算法、渲染器和图表。只有 `01-system.json` 明确授权时，才可以生成并安装 Python 算法或 Agent 自定义渲染器。
7. 使用 schema v3、多传感器 canonical identity 和平台现有保存 API；首次保存必须 `overwrite:false`。
8. 保存后重新加载并逐传感器回读，确认协议、矩阵、线序、算法、stored、label 和 outputChannel 没有串路。
9. 按 `05-acceptance.md` 完成真机验收；无法自动验证的项目必须标记为“待人工/真机验证”，不能猜测通过。
10. 不修改 Electron、永久后端、SDK、WebSocket、数据库、回放或 CSV 实现。

最后请报告：

- 展示系统 id 和安装结果；
- 每个 sensor id 对应的业务位置、canonical channelId 和当前物理串口；
- 每路协议识别结果、矩阵和线序数量；
- 使用的算法、渲染器与图表；
- 实时、采集、回放、CSV 和断线重连的验收证据；
- 尚未完成或需要我确认的事项。
