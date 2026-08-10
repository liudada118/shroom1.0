# `@shroom/backend`

压力传感**后端能力**的可安装包。76 个文件、约 11000 行，是主应用后端跑的**同一份代码** ——
不是抽出来的副本，`backend/**` 里对应位置留的是一行转出壳。

想拿这套东西起一个新的 Node 项目、把串口数据读进来存下来导出去，从这里开始。

```bash
node sdk/backend/examples/quickstart.js --mock      # 没硬件也能跑完整条链
npm run sdk:quickstart -- --mock                    # 在仓库根上
```

> **📖 有一个能拨的文档站：`npm run sdk:backend-docs`**（[`docs/`](docs/)，10 页）
>
> 讲解 + **活预览** + 「显示代码」。协议解码、37 个线序、57 个传感器定义、
> 采集的三个条件、命令信封校验，都是在页面上跑**包里的真函数**，不是截图。
> 站上每一张表也都是渲染时从真代码读的 —— 这份 README 里的表格改代码不会报错，
> 那边的会跟着变。
>
> 出静态产物：`npm run sdk:backend-docs-build`，`dist/` 丢任意静态服务器（含子路径）即可。
> 另有两道守卫：`sdk:backend-docs-check`（SSR 逐页渲染，抓表格读崩）和
> `sdk:backend-docs-click`（真浏览器点十页 + 子路径下伺服产物，抓白屏）。

它会打印传感器定义、造 20 帧假数据走完解码→线序→清零→入库，最后吐一个 CSV 出来。
把 `--mock` 换成 `--port COM3` 就是真串口。

---

## 装

`private: true`，不发公共 registry。分发走 `file:` 依赖或 `npm pack` tarball。

```json
{
  "dependencies": {
    "@shroom/backend": "file:../shroom1/sdk/backend"
  }
}
```

主仓自己就是第一个消费者（根 `package.json` 里 `"@shroom/backend": "file:sdk/backend"`），
所以包里的代码和主应用跑的是同一份，不会出现「包里修了主程序没修」。

原生依赖全部是 **optional peer**，按需装：

| 你要用 | 得装 |
| :--- | :--- |
| 开串口、切帧 | `serialport` + `@serialport/parser-delimiter` |
| 采集落 SQLite | `better-sqlite3` |
| 导出 CSV | `csv-writer` |
| 连一个已跑起来的后端的 WebSocket | `ws` |

只用线序、压力换算、协议校验的话，**一个都不用装**。

---

## 十二个入口，按「要不要原生依赖」分层

这条线不是审美，它决定谁能消费你的代码。

| 入口 | 内容 | 依赖 |
| :--- | :--- | :--- |
| `@shroom/backend` | 门面，见下面「根出口的懒加载」 | 视你取什么 |
| `@shroom/backend/contract` | HTTP 路由表、命令信封、telemetry 帧形状、manifest 形状 | **无** |
| `@shroom/backend/processing` | 线序、矩阵修补、压力换算、插值、平滑、视频映射、通用数学 | **无** |
| `@shroom/backend/protocol` | protocol schema（归一化/校验/解码）+ 内置串口协议预设 | fs |
| `@shroom/backend/sensors` | 传感器注册表 + 5 个协议插件 | **无** |
| `@shroom/backend/telemetry` | 通道总线、旧帧归一化 | events |
| `@shroom/backend/collection` | 采集限流、磁盘保护、入库判定、批量队列 | **无**（db 靠注入） |
| `@shroom/backend/logger` | 统一日志（`LOG_LEVEL` / `LOG_FILE`） | fs |
| `@shroom/backend/serial` | 串口生命周期、断线重连、命名 parser 通道 | peer: serialport |
| `@shroom/backend/storage` | SQLite 采集库 + 内存库 + 主应用历史库结构 | peer: better-sqlite3 |
| `@shroom/backend/export` | CSV 导出 | peer: csv-writer |
| `@shroom/backend/client` | 连一个**已经跑起来的**后端（HTTP 控制 + WS 订阅） | peer: ws |
| `@shroom/backend/session` | 上面这些串成的一条链（`ShroomSensorSDK`） | peer: serialport |

子路径也开着，写全 `.js`：`require('@shroom/backend/processing/lineOrders.js')`、
`require('@shroom/backend/protocol/presets/matrix-256.json')`。

### 根出口的懒加载

零依赖那七层在根出口是**直接展开**的，后面五层是 getter，**碰到才加载**：

```js
const shroom = require('@shroom/backend');
shroom.press(...)            // 直接可用，一个 peer 都不用装
shroom.ShroomSensorSDK       // 这一下才 require serialport
```

对照前端包 `@shroom/frontend`：那边根出口**整个不含** `react/`，因为 ESM 的 `export *`
没法懒加载，一含进去裸 Node 消费者连 import 都做不到。CJS 有 getter，所以这边能做得更松。

> ⚠️ 代价：对根出口做 `{ ...require('@shroom/backend') }` 会**触发全部 getter**，
> 等于把四个 peer 全加载一遍。要转出请写 `module.exports = require('@shroom/backend')`。

---

## 三条常用路径

### 1. 我有硬件，想自己读

```js
const { ShroomSensorSDK } = require('@shroom/backend/session');

const sdk = new ShroomSensorSDK({ dbDir: './db', exportDir: './out' });
const session = await sdk.open({ sensorType: 'hand0205', channels: { sit: 'COM3' } });

const capture = sdk.getStore().createCapture({ name: 'run-1', sensorType: 'hand0205' });
session.on('frame', (frame) => {
  sdk.getStore().insertFrame({ captureId: capture.id, sensorType: 'hand0205', channel: 'sit', frame });
});
// ...
await sdk.exportCsv({ captureId: capture.id });
```

链路是 `SerialPort → DelimiterParser → ProtocolRegistry.parse → ZeroCalibrator → frame 事件 → CaptureStore → CsvExporter`。
完整可跑版本见 [`examples/quickstart.js`](examples/quickstart.js)。

### 2. 主应用已经在跑，我只想连上去

```js
const { BackendSdkClient } = require('@shroom/backend/client');

const client = new BackendSdkClient({
  httpBaseUrl: 'http://127.0.0.1:19245',
  wsUrl: 'ws://127.0.0.1:19999',
});

const contract = await client.getContract();   // 路由和命令格式从这儿拿，别硬编码
client.on('frame', (frame) => console.log(frame.channelId, frame.value?.length));
client.connectRealtime({ channels: ['sit'] });
```

控制走 HTTP，实时走 WebSocket 订阅。`npm run sdk:demo` 是只读版演示。

### 3. 我只想用算法，不碰硬件

```js
const { jqbed, press, zeroLine, findMax } = require('@shroom/backend/processing');
const { decodeProtocolValues, getSerialProtocolPreset } = require('@shroom/backend/protocol');

const preset = getSerialProtocolPreset('matrix-256');
const values = decodeProtocolValues(rawFrame, preset.protocol);
const matrix = jqbed(values);
```

这条路径**零依赖**，装个包就能跑。

---

## 加一种自己的传感器

不用改包。协议声明是数据，`protocol` 段三件事说清楚就够了：

```json
{
  "baudRate": 921600,
  "framing": { "type": "delimiter", "delimiter": [170, 85, 3, 153] },
  "decoding": { "valueType": "uint8", "byteOffset": 0, "valueCount": 256 }
}
```

`createParserFromProtocol()` 直接把它变成切帧器。同一段 JSON 也能整段粘进展示系统
manifest 的 `protocol` 字段 —— **不是两套格式**，schema 只有
[`protocol/displaySystemProtocol.js`](protocol/displaySystemProtocol.js) 这一份。

内置预设和逐字节说明在 [`protocol/presets/README.md`](protocol/presets/README.md)。
主应用打包后，用户往 `<runtimeWritableRoot>/serial-protocols/` 丢 JSON 就能加协议，
同 id 覆盖内置，不用重新构建。

---

## 检查

```bash
npm run sdk:backend-smoke     # 包边界守卫，10 项
npm test                      # 仓库全量后端测试，39 个文件
npm run sdk:quickstart -- --mock
npm run sdk:serial-demo -- --mock
```

`sdk:backend-smoke` **不是补充测试，是包边界的守卫**。`backend/tests/` 全部在主仓上下文里跑，
`node_modules` 里什么都装齐了，所以它们证明不了下面两件事 —— 而这两件事就是
「在主仓里跑得好，装到新项目里就崩」的全部来源：

| 会漏掉的错 | 只有 smoke 抓得到 |
| :--- | :--- |
| 包内某个文件 require 了包外的东西 | 主仓里这条相对路径解析得开，tarball 里跑出包根就崩 |
| 零依赖层其实不零依赖 | 主仓装着 serialport，装不上原生模块的机器上直接炸 |

它还跑一条真实链路（预设 → 解码 → 线序 → 压力），因为**加载得动不等于跑得通**。

---

## 已知妥协

拆包这轮留了两处重复，都有测试守着
（[`backend/tests/sdk/backendPackageInvariants.test.js`](../../backend/tests/sdk/backendPackageInvariants.test.js)）：

**1. `commandSchema.json` 有两份。**
包内一份 [`contract/commandSchema.json`](contract/commandSchema.json)，仓库根一份
`shared/commandSchema.json`。包不能 `require('../../../shared/...')` —— 四级向上跑出包根，
在仓库里解析得开，`npm pack` 装出来就崩（前端包 `@shroom/frontend` 正踩着这个坑）。
这个 JSON 现在有 5 个消费者，还牵着 `client/` 和前端包，统一归属不在这轮范围内。
在那之前，漂移测试保证两份不会长歪。

**2. 传感器元数据有两份。**
`sensors/registry.js`（矩阵/通道/能力）和 `session/profiles.js`（分帧/解码偏移/波特率）。
没合并是因为 `getDefaultBaudRate()` 有注册表没有的规则（`robot` 前缀匹配、
`footVideo` / `eye` / `daliegu` 这些不在注册表里的类型），硬合会悄悄改掉某些类型的波特率。
两边共有的类型，波特率必须一致，由测试守着 —— 这一处长歪的表现是
「串口能开但一帧都解不出来」，而且不报错。

---

## 没进包的东西，以及为什么

不是忘了，是**搬过去别人也用不了**：

| 留在 `backend/` | 原因 |
| :--- | :--- |
| `services/export/csvDownloadService.js` | 20 个注入参数，含 `getRuntime` / `isThreePortFile` / `publishSystemEvent`，形状被应用绑死 |
| `serial/serialPortOrchestrator.js` | 注入 minzhen 传感器专用 handler |
| `processing/webStaticServer.js` | 起 http 服务、读 Electron 打包目录、调 `child_process` |
| `sensors/runtime/*` | 跟 legacy 变量（`file` / `db` / `localFlag`）强耦合，见 `backend/ARCHITECTURE_MAP.md` |
| `services/history` / `services/playback` | 依赖 runtime store 里的旧状态 |
| `server/*` | 就是应用装配本身 |

包里提供的是这些能力的**可复用版本**：`export/CsvExporter` 之于 csvDownloadService，
`session/ReplayService` 之于 playback。功能少一些，但不需要你先有一个 `server.js`。

## 后续

- `backend/**` 里对应位置现在是一行转出壳（`module.exports = require('@shroom/backend/...')`）。
  下一轮把 backend 内部的 require 直接改成包名，壳就可以删了。
- `shared/commandSchema.json` 归属统一，删掉包内副本。
- `session/profiles.js` 并进 `sensors/registry.js`。

---

# 更多用法

## 不接串口的模拟用法

```js
const { ShroomSensorSDK } = require('@shroom/backend/session');
const { MemoryCaptureStore } = require('@shroom/backend/storage');

const sdk = new ShroomSensorSDK({
  store: new MemoryCaptureStore(),
  exportDir: './tmp',
});

const frame = sdk.registry.parse(
  'hand0205',
  Buffer.concat([Buffer.alloc(256, 1), Buffer.from([1, 2, 3, 4])]),
  { channel: 'sit' },
);

const capture = sdk.getStore().createCapture({
  name: 'mock_capture',
  sensorType: 'hand0205',
  hz: 200,
});

sdk.getStore().insertFrame({
  captureId: capture.id,
  sensorType: 'hand0205',
  channel: 'sit',
  rawFrame: Buffer.alloc(260),
  frame,
});
```

`MemoryCaptureStore` 和 `CaptureStore` 接口一样，所以业务代码不用为「测试环境不落盘」分叉。

## 注册一份自己的传感器档案

```js
sdk.registerProfile('mySensor', {
  baudRate: 1000000,
  delimiter: Buffer.from([0xaa, 0x55, 0x03, 0x99]),
  valueType: 'uint8',
  pressureLength: 1024,
  matrixWidth: 32,
  matrixHeight: 32,
  lineOrder: 'jqbed',
});
```

协议特殊的话给一个 `parseFrame(buffer, profile, context)`，返回和默认 frame 相同结构即可。

## 线序

`ShroomSensorSDK` 启动时会把 `@shroom/backend/processing` 里的线序/矩阵函数
全部注册进 `LineOrderRegistry`：

```js
console.log(sdk.listLineOrders());
const mapped = sdk.applyLineOrder('jqbed', new Array(1024).fill(1));
```

常用的有 `jqbed`、`handSinglePoint`、`handL`、`handR`、`carSitLine`、`carBackLine`、
`yanfeng10sit`、`yanfeng10back`、`smallBed`、`smallBed1`、`tempFullBed`。

新硬件有独立线序就自己注册：

```js
sdk.registerLineOrder('myLine', (data) => data.reverse());
```

## 后端操作 → SDK 模块对照

主应用后端的能力，在这个包里分别落在哪：

| 域 | 后端操作 | 包里的位置 |
| :--- | :--- | :--- |
| 授权 | 密钥解密、到期时间 | `session/LicenseService` |
| 系统配置 | 波特率、协议类型切换 | `protocol` / `session/profiles` |
| 串口 | 识别、打开、关闭、通道绑定 | `serial`，或 `session` 的 `listPorts()` / `open()` |
| 实时解析 | parser `data` 事件、原始帧解析 | `protocol.decodeProtocolValues()` / `session.on('frame')` |
| 线序 | `jqbed`、`carSitLine` 等 | `processing` / `session` 的 `applyLineOrder()` |
| 清零 | 基准帧、清零后矩阵 | `session/ZeroCalibrator` |
| 采集 | 开关、频率、磁盘保护、入库 | `collection` + `storage` |
| 回放 | 时间轴、播放、调速 | `session/ReplayService` |
| 下载 | CSV 文件 | `export` |
| HTTP 报告 | Python 报告 | `session/ReportService`（注入式 `pythonClient`） |

完整清单：`require('@shroom/backend/client').listBackendOperations()`。
