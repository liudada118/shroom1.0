# Workspace：Display System Builder 的后端

> 最后更新：2026-08-29

一个文件，745 行。前端的可视化 Builder 靠它把用户在界面上拼出来的东西**落成一个真正能装的 Display System 目录**。

和 `../manifest/`、`../runtime/` 的分工：那两个是「读别人写好的系统」，这个是「帮用户写出一个系统」。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `displaySystemWorkspaceService.js` | Builder 后端全部能力，745 行。5 个导出：`createDisplaySystemWorkspaceService`（save / read / duplicate / saveDisplaySection 四个操作）、`buildDisplaySystemBuilderCatalog`（给前端零件栏的可选项目录）、`createIdentityDefinitions`（生成恒等线序/点序）、`validateBuilderAlgorithmSource`、`DEFAULT_ALGORITHM_SOURCES` | 写盘前一律走 `../manifest/` 的 validator。Builder 存出来的东西必须和手写 manifest 走**同一套**校验，否则「界面拼的能存、装的时候报错」 |

## 四个操作

| 操作 | 干什么 |
| --- | --- |
| `save` | 校验 → 写 manifest → 写线序/点序/坐标/算法各文件。`overwrite` 默认 false，防止误覆盖已有系统 |
| `read` | 读回一个已存在的系统，填充 Builder 界面 |
| `duplicate` | 复制整个目录（`copyDirectoryRecursive`）作为新系统的起点 |
| `saveDisplaySection` | 只改页面外观（`canvas` / `chartAppearance` / `chartCards` 三段），不动协议和数据链路 |

`saveDisplaySection` 单独存在是因为调外观是高频操作——改个配色不该重跑整套协议校验，也不该有机会碰坏线序。

## 几个值得知道的约束

**ID 必须匹配 `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`。** 这个 id 会变成目录名，用户可以任意输入。不限制就意味着路径穿越（`../`）和各种文件名非法字符。

**写文件是原子的。** `writeJsonAtomic` / `writeTextAtomic` 先写临时文件再 rename。Builder 保存时要写好几个文件，中途失败留下半份配置的话，下次加载会校验失败而用户不知道为什么——原子写让「要么全成要么没动」。

**恒等线序不是占位符。** `createIdentityDefinitions(matrix)` 生成的是「第 n 个点就映射到第 n 个位置」的映射。新建系统时必须有一份，否则 manifest 缺文件；而且它是**正确的默认值**——用户没配线序时，按原顺序显示是唯一合理的行为。

**波特率是白名单。** `BUILDER_BAUD_RATES` 列了 7 个（9600 到 2000000）。这不是限制用户，是防止手输错一位——波特率错了的表现是收到一堆乱码，没有任何报错，是这个项目里最典型的静默失败。

**算法类型四种**：`none` / `json` / `js` / `python`，其中后两种是代码（`CODE_ALGORITHM_TYPES`），`validateBuilderAlgorithmSource` 会按类型分别校验源码。`DEFAULT_ALGORITHM_SOURCES` 提供可运行的模板骨架，让用户从一个能跑的东西开始改。

Python 还可以提交 `definitions.sensors[id].algorithmPackage + algorithmSource`。Workspace 会把
`algorithm-package.json` 和入口源码写入同一包目录：API V1 校验 `calculate(raw_data, context)`，
API V2 校验 `process(request)`；多传感器包只能挂到其 `triggerSensor`，引用的 sensor id 必须
都存在于同一份 schema-v3 manifest。目录接口的 `algorithmPackageContract` 是 Agent/Builder 的
实时能力来源，不应在调用方再写一份版本和模板。

目录接口同时返回 `algorithmPackages`：它来自只读 `agent-resources/algorithm-packages`（打包后为
`Resources/agent/algorithm-packages`），每项包含已校验的可移植 Manifest、入口源码、矩阵兼容范围
和指标定义。Builder 选中后把内容复制到用户展示系统目录，不保存安装机绝对路径。

目录接口还返回 `agentChartContract`。标量趋势仍可使用宿主公式图表；XY 轨迹、多序列等自定义图表
先通过 Agent App `charts[]` 安装，再以返回的 `agent-chart:<appId>:<chartId>` 写入
`display.chartCards[].agentChartId`。宿主将其挂在原侧栏并转发同一 canonical 帧，Builder 读写时
保留这些卡片，但不会把图表代码写入展示系统算法或永久后端。

## 边界

- 校验逻辑不在这里，在 `../manifest/`。这里只调用。重复实现一套就会漂移。
- 串口协议模板来自 `@shroom/backend/protocol/presets/`（`buildSerialTemplateFromPreset`），不在这里硬编码。
- 用户写的算法代码会被 `../runtime/` 执行。这里只做语法层面的基本校验，不做安全沙箱——沙箱在执行侧。
