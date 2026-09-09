---
name: add-display-app
description: 创建并安装本地离线运行的 Shroom 渲染器和图表展示组件，保持固定后端处理链路不变。
---

# 新增展示应用

本技能仅用于生成和安装展示应用。机器可读规则以
[`../policy.json`](../policy.json) 为准。开始工作前必须完整阅读该文件；
本文说明执行流程，不能替代策略文件。

## 必须遵守的边界

- 不得修改 `app/electron/`、`backend/`、`sdk/backend/`、`client/`、稳定契约、
  SQLite 数据库结构、WebSocket 网关、回放、CSV、`package.json` 或已打包的应用文件。
- 通过 `POST /api/agent-apps` 安装。应用文件是由沙箱宿主读取的本地数据，不是对应用源码的补丁。
- 渲染器和图表代码只负责展示。不得打开串口、SQLite、任意 HTTP、WebSocket、Electron IPC、
  Node、命令行或文件系统，也不得下载依赖。只有当前宿主明确允许时，才可用 `fetch`
  读取本应用准确的 `/api/agent-apps/:id/files/` 前缀下已打包的文件。
- 沙箱为经过审查的已打包代码划定能力边界，不能保证防住恶意代码或 CPU、内存耗尽。
  安装前审查源码和资源；禁止页面导航、动态下载、代码混淆和故意耗尽资源的操作。
- 不得读取或生成顶层 `sitData`、`backData` 或 `headData`。
  数值只能通过下文约定的沙箱帧消息到达，来源为标准 `sensor.frame.payload.value` 的投影。
- 不得根据 COM、协议、端口顺序、帧顺序或数组下标推断业务角色。
  各通道均使用完整标准 `channelId` 作为键，并显示宿主提供的 `sensorLabel`。

如果需求无法在这些边界内完成，停止并说明缺少哪项平台能力。

## 必须先查询的能力

创建文件前，按顺序调用以下 API：

1. `GET /api/sdk/contract`：响应是原始契约对象，不是 `HttpResult`，也不是 `data.*`。
   使用其中当前有效的路由、稳定契约版本、可用通道、算法、协议预设、渲染器和能力目录。
   不得依赖记忆中的值。
2. `GET /api/agent-apps/policy`：要求 `data.policy.schemaVersion === 1`，并遵守返回的策略。
3. `GET /api/agent-apps`：检查 `data.apps`。
   除非用户明确要求替换某个准确的应用，否则不得复用已有标识。

契约不可用或不兼容时停止。不得通过修改应用源码绕过缺失的 API。

## 选择展示组件

算法、主渲染器、图表的来源必须分别遵循用户选择，可以混合使用系统自带与 Agent 新建。
选择新建某一项不意味着其他两项也要重写。未指定来源时，自动复用当前兼容能力，
按展示系统技能用一句普通话说明后继续，不要求用户先确认技术选型。
用户明确选择新建时允许在相应扩展边界内实现，不能强制改回自带组件。

当前契约或目录提供的内置渲染器能够表达需求时，优先使用其准确标识，不得猜测内置名称。

仅在需要时使用自定义应用。安装后，平台渲染器标识为 `agent:<appId>`，
其中 `appId` 对应 `app.json.id`。
内部 `renderer.id` 默认为 `main`，它不是平台选择渲染器时使用的标识。

Agent 渲染器是宿主既有主可视化区域中的组件，不是独立仪表盘。
使用透明、占满可用尺寸的根容器，让用户要求的主要可视化填满渲染器 iframe。
不得在图形周围增加可见标题、描述、应用标识、通道标识、波特率、状态条、页脚条、卡片外壳或独立背景。
这些层次以及加载和错误显示由宿主管理。只有用于解释图形本身时，才允许在画布中放置小型图例。
不得重复创建 Shroom 顶栏、渲染器或方案控件、传感器摘要卡片、图表侧栏、下载控件或另一层应用外框。

标量时间序列优先使用宿主公式图表目录。
对于 XY 轨迹、多条同步曲线或公式目录无法表达的图形，在 `app.json.charts[]` 中声明应用图表。
实现用户已请求但没有可用模板或兼容组件的图表，属于正常生成步骤，无需用户先说出“新建图表代码”；
用户明确要求只用自带时除外。应只补图表，不重写另外两项，也不新增替代测量算法。
宿主会分配 `agent-chart:<appId>:<chartId>`，并将其 iframe 挂载到既有侧栏图表区域。
不得把这些图表放进主渲染器。
一个应用包可以只包含渲染器、只包含图表，也可以同时包含两者。

## 从模板开始

将[`template/app.json`](template/app.json)、
[`template/frontend/index.html`](template/frontend/index.html) 和
[`template/frontend/app.js`](template/frontend/app.js) 复制到新的暂存目录。
所有资源保存在该目录内，使用正斜杠的相对路径。
可执行 JavaScript 放在本地外部脚本文件中；宿主 CSP 不允许内联脚本。

更新 `app.json`：

- `schemaVersion` 保持为 `1`。
- `id` 使用新的小写字母、数字和连字符标识，符合
  `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`，长度最多 64 个字符。
- `name` 是面向用户的应用名称，`version` 使用语义化版本号。
- 至少声明一张图表时，`renderer` 可以省略。
  渲染器的 `entry` 指向随包提供的本地文件，通常为 `frontend/index.html`。
- `charts[]` 可选。每项声明安全的本地 `id`、显示名称、本地入口文件，以及 160–2000 像素的高度。
  安装后的标识以 API 响应为准，不得在安装前自行虚构。
- `renderer` 与 `charts[]` 至少存在一项。
- `permissions` 保持为 `['sensor.read']`，除非当前策略明确支持更小的权限集合。

不得将通道标识或 COM 路径写入 `app.json`。
各 iframe 在运行时通过 `shroom.renderer.init` 接收传感器身份。

## 沙箱消息契约

宿主只发送以下版本 1 消息：

```js
{
  type: 'shroom.renderer.init',
  schemaVersion: 1,
  payload: {
    appId, rendererId, widgetId, label,
    surface, surfaceId, config,
    displaySystemId, sensorId, sensorLabel, sensorType, outputChannel, channelId
  }
}

{
  type: 'shroom.renderer.frame',
  schemaVersion: 1,
  payload: {
    displaySystemId, sensorId, sensorLabel, sensorType, outputChannel, channelId,
    timestamp, values, rawValues, matrix, metrics, algorithmMetrics, serial,
    channels // 可选的多传感器扩展；每项具有相同的身份和数据字段
  }
}
```

`values` 的类型为 `(finite number|null)[]`，即由有限数值或 null 组成的数组。
`matrix` 描述当前 `values` 的几何尺寸，完整帧必须满足 `values.length === matrix.total`。
`rawValues` 是协议解码阶段的独立数组，可能缺席、为空或与展示矩阵点数不同。
只能校验它的数组和数值类型，**不得要求 `rawValues.length === matrix.total`**，也不得截断或补零伪造长度。
线序、点位映射或可视插值会改变长度；呼吸和重心图表优先读取 `algorithmMetrics`，不能因未使用的原始数组长度阻断。
多传感器 `channels[]` 中每路按自身 `matrix` 校验，不能强迫它们与当前组件使用同一尺寸。
模块更新后通过宿主重新加载入口重新握手；单个图表错误不能阻断其他图表、渲染或采集。
必须满足 `channelId === displaySystemId + ':' + sensorId`。
只有收到 `init` 后才能接收 `frame`，并拒绝 `channelId` 与初始化通道不同的帧。
顶层字段始终描述当前组件所在通道。
可选的 `channels[]` 存在时，应逐项校验，并用完整 `channelId` 作为映射表的键维护多传感器状态；
不得把数组下标当作身份。单通道宿主可以省略 `channels`。
只处理 `event.source === window.parent` 的消息。

只有当前通道已经产生完整矩阵帧，宿主才会发送该通道的帧。
可选的 `channels[]` 也只包含已经产生完整帧的传感器；
已声明的传感器在首帧到达前可能不在数组中。
缺席应视为“等待数据”，不能当成空矩阵，并应保留其他通道最后一帧有效数据。

顶层及各 `channels[]` 项中的 `serial` 都是可选的只读诊断元数据。
只使用白名单中的 `role`、`portId`、`path`、`baudRate`、`parserChannel`、
`status`、`isOpen` 和 `openedAt` 字段。
它可能在重连后变化，不能用于定义左手、右手、靠背或座椅身份。
不得期待其中存在设备句柄、方法、解析器对象或 Electron 对象。

渲染器只发送：

```js
{ type: 'shroom.renderer.ready', schemaVersion: 1, payload: {} }
{ type: 'shroom.renderer.error', schemaVersion: 1, payload: { message: '...' } }
```

使用 `window.parent.postMessage(...)`。
由于沙箱使用不透明来源，宿主必须通过 iframe 窗口识别发送者，不能信任任意消息内容。
不得新增控制消息，也不得将帧数值回传。

`init` 必须按幂等方式处理，即重复接收同一有效初始化不应产生额外副作用。
脚本启动时发送一次 `ready`，此后每次收到有效 `init` 都再次发送 `ready`，
以处理首次就绪消息早于宿主监听器挂载的情况。

`surface` 的值为 `renderer` 或 `chart`。
图表通过 `surfaceId` 接收安装后的 `agent-chart:*` 标识；
`config` 只包含展示系统图表卡片声明的 JSON `source/options`。
两类展示组件均接收相同的已清理帧载荷，以及可选的、具有稳定身份的 `channels[]` 集合。

## 算法

可以不选算法，也可以使用当前平台契约已声明的算法。
已有算法在固定处理链路的上游运行，渲染器只负责展示处理后的 `values`。

呼吸图表只能读取所选内置或 Agent 算法包明确提供的呼吸指标。算法每次返回一个值即可按时间入队并画曲线，
不要求一次返回整段数组；呼吸率单值画“呼吸率趋势（次/分）”，呼吸信号采样值画对应信号曲线。
队列按 channelId、指标和帧时间隔离，限制时长/容量，去重时间戳而不是数值，切换通道/指标时清空。
按所选包语义排除无效标记（例如 -1 未稳定、88 检测中），不能当真实读数或用压力补位。
预热、失败、缺失或过期时清除当前读数并中断曲线，恢复后重新成段，不跨缺口连线或将旧值当成当前结果。
禁止以总压力、平均压力、滤波压力或去基线压力趋势替代呼吸输出，不能以代理标签或放进算法包规避。
用户明确要求呼吸波形而算法只有呼吸率时，才报告波形能力缺口；普通“呼吸趋势”允许呼吸率队列。
队列和绘图属于展示，不是新增测量算法；用户另行请求的压力趋势应是独立图表。

新增任意 JavaScript/Python 算法、WASM、原生代码、软件包、DLL 或运行时依赖需要用户明确授权。
公开图表扩展内、仅消费既有算法指标的绘图 JavaScript 不属于新增算法。
即使已获授权，也必须使用既有算法宿主和处理链路；
不得将算法藏在渲染器 HTML 中。

## 构造安装请求

将 `app.json` 解析为 `manifest`。
不得在 `files` 中再次提交 `app.json`，服务器会根据 `manifest` 写入该文件。
文本采用 UTF-8 编码，二进制资源采用 base64 编码：

```json
{
  "manifest": {
    "schemaVersion": 1,
    "id": "pressure-grid-demo",
    "name": "离线压力点阵",
    "version": "1.0.0",
    "renderer": {
      "id": "main",
      "label": "压力点阵",
      "entry": "frontend/index.html",
      "height": 520
    },
    "charts": [
      {
        "id": "cop-track",
        "label": "重心轨迹",
        "entry": "charts/cop.html",
        "height": 260
      }
    ],
    "permissions": ["sensor.read"]
  },
  "files": [
    {
      "path": "frontend/index.html",
      "encoding": "utf8",
      "content": "<!doctype html>..."
    },
    {
      "path": "frontend/app.js",
      "encoding": "utf8",
      "content": "(() => {...})();"
    }
  ],
  "overwrite": false
}
```

限制：展示组件高度为 160–2000 像素；最多 16 张图表、128 个文件；
每个文件解码后最多 24 MiB，全部文件解码后总计最多 32 MiB；
每条可移植相对路径最多 240 个字符。
重复路径、路径越界、绝对路径、URL、符号链接和 `files/app.json` 均不合法。

将请求发送到 `POST /api/agent-apps`。
声明了渲染器时，`HttpResult.data.app.rendererId` 必须等于 `agent:<manifest.id>`；
每张图表必须返回 `agent-chart:<manifest.id>:<chart.id>`。
按稳定的 `AGENT_APP_*` 错误码处理失败；
未经明确授权，遇到 `AGENT_APP_EXISTS` 时不得改用 `overwrite:true` 重试。

只有当前契约或安装响应要求时，才调用 `POST /api/agent-apps/reload`；
随后确认应用能在 `GET /api/agent-apps` 中正常列出，且没有错误。

## 验收检查

宣布完成前：

1. 将 `app.json` 和已安装的策略文件均按严格 JSON 解析。
2. 确认所有文件均为本地文件、只提交一次、未超出限制，
   且安装后能通过 `/api/agent-apps/:id/files/*` 访问。
3. 确认宿主响应中的 CSP 阻止外部连接和导航，包括 `navigate-to 'none'`，
   并将脚本和资源限制在本应用准确的静态文件前缀内。
   渲染器 HTML 不得尝试削弱或替换该策略；脚本必须随包提供并作为外部文件加载，不能内联，
   也不能使用远程 URL、动态下载或禁止的 API。
   只有当前策略明确公开本应用准确的静态前缀时，才允许读取同包文件的请求。
4. 在每个渲染器或图表沙箱中，观察启动 `ready`，多次发送同一有效 `init`，
   验证每次有效初始化都被幂等处理并回复 `ready`；
   然后发送 `frame`，确认数值能正确绘制。
   在内部或无障碍诊断中保留 `sensorLabel` 和标准 `channelId` 以供身份核对，
   但不得新增重复的可见元数据条。
   用户明确要求图内连接诊断时，可以只读显示 `serial`，但不能改变传感器身份。
5. 发送错误版本、格式错误的数值和不匹配的当前通道，验证渲染器发出 `error`，
   且不覆盖最后一帧有效数据。
   测试 `channels[]` 时，确认状态按标准 `channelId` 存储，并在数组重排后仍然正确。
6. 确认安装使用 `overwrite:false`，固定后端和稳定契约文件均未改动。

最终报告应用标识、可选的 `agent:<appId>` 渲染器标识、全部 `agent-chart:*` 标识、
已安装版本、所选通道标识、测试结果，以及任何被策略拒绝的功能。
