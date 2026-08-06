# Shroom SDK

这个目录下有**两个 SDK**，管的是二开的两侧：

| | 这份文档（`sdk/examples/`） | [`sdk/frontend/`](frontend/README.md) |
| :--- | :--- | :--- |
| 包名 | 无 —— 是 demo 脚本，直接 `node` 跑 | `@shroom/frontend`（可 `npm i`） |
| 管什么 | **连后端**：契约发现、串口开关、采集控制、历史查询 | **画画面**：渲染器、帧管线、配色、阈值 |
| 跑在哪 | Node（Electron 主进程侧） | 浏览器（`/core` 也可裸 Node） |
| 入口 | `npm run sdk:demo` / `npm run sdk:serial-demo` | `cd sdk/frontend/example && npm i && npm run dev` |
| 文档 | 就是这份 README | `npm run sdk:frontend-docs` → **在线可预览文档站**，10 页 |

**想拿这套东西起一个新项目、看到画面的，先开文档站**：

```bash
npm run sdk:frontend-docs     # 在仓库根上跑，10 页：讲解 + 活预览 + 「显示代码」
```

它比 README 多的不是篇幅，是**不会过期**：契约表、7 条配色、6 条预设、8 条帧通道全部从 `core`
**直接 import 渲染**，每段代码样例用 Vite 的 `?raw` 显示**正在上面那块画面里跑的那个文件本身**。
README 里的表格是手抄的 —— `RENDERER_METHODS` 改一行，README 不会有任何报错。文档站会跟着变。

其中「写自己的渲染器」那一页是重点：一个约 140 行的 Canvas 2D 渲染器，不属于包，走完整条正式
路径（`forwardRef` → `registerRenderer` → `validateRendererDescriptor` → `RendererHost`），
源码就在页面里。「坑」那一页是踩过的账，包括下面提到的 tarball 缺陷。

不想开站的话，[`frontend/README.md`](frontend/README.md) 有最短可跑路径和消费者必须做的**四**件事
（`resolve.dedupe`、peer 依赖、混淆器 `exclude`、打包器要能处理 `.png` import）。本文档往下是后端侧。

---

## 前端包 `@shroom/frontend`（速览）

```bash
cd frontend/example && npm i && npm run dev     # → 32×32 数字矩阵，游动的高斯斑
```

`private: true`，不发公共 registry；分发走 `file:` 依赖或 `npm pack` tarball。主应用自己就是
第一个消费者（`client/package.json` 里 `"@shroom/frontend": "file:../sdk/frontend"`），所以包
里的代码和主界面跑的是**同一份**，不是副本。

四个入口，按「有没有 React / three / DOM」分层 —— 这条线同时决定谁能消费和能不能在裸 Node
里加载：

| 入口 | 内容 | 依赖 |
| :--- | :--- | :--- |
| `@shroom/frontend` | 传输（`SensorClient`）、帧存储（`FrameStore`）、展示系统定义（`DisplayRegistry`），并全量转出 `core` | 无 |
| `@shroom/frontend/core` | 契约、渲染器注册表、帧管线、配色、阈值、坐标布局 | 无 |
| `@shroom/frontend/react` | `RendererHost`、`useSceneFrame`、`registerBuiltinRenderers`、`numMatrix` + `pointGrid` | peer: react ≥18 + three **≥0.127** |
| `@shroom/frontend/styles/canvas.css` | 6 行 | 无 |

根出口**刻意不含 `react/`**：一旦含了，`SensorClient` 的裸 Node 消费者（本仓 `backend/tests/sdk/`
里就有一个）连 import 都做不到。

**`three` 的 peer 范围必须宽到 `>=0.127`** —— 主应用 pin 的是 `^0.127.0`（2021 年的版本），写
`^0.170` 会让主应用装不上。

三行就能出画面：

```jsx
import { RendererHost, registerBuiltinRenderers } from '@shroom/frontend/react';
import '@shroom/frontend/styles/canvas.css';

registerBuiltinRenderers();
<RendererHost rendererId="numMatrix" params={params} values={frame} channel="sit" />
```

在仓库根上跑它的检查：

```bash
npm run sdk:frontend-test     # vitest 131 例
npm run sdk:frontend-smoke    # 裸 Node 跑一遍 core，15 项
npm run sdk:frontend-docs     # 文档站开发服务器
```

`sdk:frontend-smoke` 不是补充测试，是**包边界的守卫** —— 无打包器、无 `localStorage` 垫片、无
vitest，这三样在测试环境里都会把「装到新项目里就崩」那类错遮住（少写 `.js` 扩展名、模块顶层读
`localStorage`、悄悄引入 react/three）。

> **⚠️ 已知缺口：根出口在 `npm pack` 装出来的包里加载不了。** `frontend/src/client/commands.js`
> 有一条 `import ... from '../../../../shared/commandSchema.json'` —— 四级向上跑出了包根。仓库里
> （`file:` / `npm link`）它解析到 `<repo>/shared/`，所以主应用和 demo 都正常；tarball 装出来之后
> 四级向上是 `node_modules/`，于是整个根 barrel 在 import 时就抛。**`/core` 与 `/react`（也就是
> 画画面那条路）不受影响。** 修法是先定 `shared/commandSchema.json` 归后端还是归 SDK（它现在有
> 5 个消费者），细节见 [`frontend/README.md`](frontend/README.md)。

---

## Backend SDK demo

This repo now includes a thin backend-facing SDK client and a runnable demo.

```bash
npm run sdk:demo
```

The default demo is read-only:

- reads `GET /api/sdk/contract`
- reads serial status and available display systems
- connects to the realtime WebSocket
- subscribes to the `sit` channel for 10 seconds

Optional commands:

```bash
npm run sdk:demo -- --channels sit,back --duration 15000
npm run sdk:demo -- --sensor hand0205
npm run sdk:demo -- --open sit=COM3
npm run sdk:demo -- --start-collection sdk_demo
```

Use `BackendSdkClient` directly:

```js
const { BackendSdkClient } = require('./sdk');

async function main() {
  const client = new BackendSdkClient({
    httpBaseUrl: 'http://127.0.0.1:19245',
    wsUrl: 'ws://127.0.0.1:19999',
  });

  const contract = await client.getContract();
  console.log(contract.contractVersion);

  console.log(await client.listSerialPorts());
  console.log(await client.listDisplaySystems());

  client.on('frame', (frame) => {
    console.log(frame.channelId, frame.value?.length);
  });
  client.connectRealtime({ channels: ['sit'] });
}

main().catch(console.error);
```

## Local serial chain demo

Use this when you want the SDK itself to read a physical serial port without going through the running backend process.

```bash
npm run sdk:serial-demo -- --list-ports
npm run sdk:serial-demo -- --sensor hand0205 --channel sit --port COM3
```

The chain is:

```text
SerialPort -> DelimiterParser -> ProtocolRegistry.parse -> ZeroCalibrator -> frame event -> MemoryCaptureStore
```

Useful options:

```bash
npm run sdk:serial-demo -- --mock
npm run sdk:serial-demo -- --port COM3 --duration 30000 --max-frames 100
npm run sdk:serial-demo -- --sensor smallBed12B --channel sit --port COM5
npm run sdk:serial-demo -- --capture none --port COM3
```

`--mock` runs the same parse/capture path with generated bytes, so the demo can be checked without hardware.

第一版 SDK 只负责后端数据链路，不包含 UI。它把当前后端里的 WebSocket 命令、串口读取、协议解析、采集、回放和下载拆成可复用模块。

## 推荐边界

外部应用优先使用“薄 SDK”：只依赖后端 HTTP 控制 API、WebSocket 实时订阅和标准 telemetry 数据模型。

- 后端契约入口：`GET /api/sdk/contract`
- 控制类操作：HTTP
- 实时数据：WebSocket 订阅
- SDK 不直接依赖：`server.js`、串口 parser、legacy runtime、零点缓存、采集内部状态

当前 `sdk/src` 里的串口、协议、线序和存储模块更适合作为“后端能力包”或离线工具复用。对外发布 SDK 时，应优先封装 `/api/sdk/contract` 暴露的稳定契约，避免把内部重构债务带给 SDK 使用者。

## 后端操作映射

当前 `server.js` 的后端能力可以拆成这些 SDK 域：

| 域 | 原后端操作 | SDK 模块 |
| :--- | :--- | :--- |
| 授权 | 密钥解密、到期时间、授权系统下发 | `LicenseService` |
| 系统配置 | `file` 切换、波特率、协议类型 | `ProtocolRegistry` / `profiles` |
| 串口 | 串口识别、打开、关闭、通道绑定 | `ShroomSensorSDK.listPorts()` / `open()` / `SensorSession` |
| 实时解析 | parser `data` 事件、原始帧解析、实时 payload | `ProtocolRegistry.parse()` / `session.on('frame')` |
| 线序 | `jqbed`、`handSinglePoint`、`carSitLine` 等线序转换 | `LineOrderRegistry` / `applyLineOrder()` |
| 清零 | `resetZero`、基准帧、清零后矩阵 | `ZeroCalibrator` |
| 采集 | `flag`、`colName`、`time`、`colHZ`、入库 | `CaptureStore` / `startCapture()` |
| 回放 | `getTime`、`local`、`play`、`value`、`speed` | `ReplayService` |
| 下载 | `download`、`downloadOptions`、CSV 文件 | `CsvExporter` / `exportCsv()` |
| HTTP 报告 | `/getDbHeatmap`、`/uploadCanvas`、Python 报告 | `ReportService` + 注入式 `pythonClient` |

可以通过 `listBackendOperations()` 获取完整清单。

## 能力范围

- 串口识别：`listPorts()`
- 串口连接读取：`open({ sensorType, channels })`
- 协议解析：通过 sensor profile 统一配置帧尾、波特率、数值类型和矩阵长度
- 线序转换：复用后端 `backend/processing/lineOrders.js` 和 `utilMatrix.js` 中的线序/矩阵函数
- 实时数据：`session.on('frame', handler)`
- 清零处理：`zeroCalibrator.captureBaseline(frame)` / `clearBaseline()`
- 采集入库：`startCapture(session, options)` / `stopCapture(session)`
- 历史回放：`replay(options)`
- CSV 导出：`exportCsv(options)`

## 基础用法

```js
const { ShroomSensorSDK } = require('./sdk');

async function main() {
  const sdk = new ShroomSensorSDK({
    dbDir: './db',
    exportDir: './data',
  });

  const ports = await sdk.listPorts({ onlyLikelySensorPorts: true });
  console.log(ports);

  const session = await sdk.open({
    sensorType: 'hand0205',
    channels: {
      sit: 'COM3',
      back: 'COM4',
    },
  });

  session.on('frame', (frame) => {
    console.log(frame.channel, frame.stats);
  });

  sdk.startCapture(session, {
    name: 'demo_capture',
    hz: 200,
  });

  // ...
  sdk.stopCapture(session);

  const result = await sdk.exportCsv({
    sensorType: 'hand0205',
    captureName: 'demo_capture',
    language: 'zh',
  });

  console.log(result.files);
}

main().catch(console.error);
```

## 不接串口的模拟用法

```js
const { ShroomSensorSDK, MemoryCaptureStore } = require('./sdk');

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

## 注册新系统协议

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

如果协议特殊，可以提供 `parseFrame(buffer, profile, context)`，返回和默认 frame 相同结构的数据。

## 线序函数

SDK 会把当前项目 `backend/processing/lineOrders.js` 和 `utilMatrix.js` 里导出的线序/矩阵函数注册到 `LineOrderRegistry`。

```js
const { ShroomSensorSDK } = require('./sdk');

const sdk = new ShroomSensorSDK();

console.log(sdk.listLineOrders());

const raw = new Array(1024).fill(1);
const mapped = sdk.applyLineOrder('jqbed', raw);
```

常用线序名包括：

- `jqbed`
- `handSinglePoint`
- `handL`
- `handR`
- `carSitLine`
- `carBackLine`
- `yanfeng10sit`
- `yanfeng10back`
- `smallBed`
- `smallBed1`
- `tempFullBed`

如果新硬件有独立线序，可以注册：

```js
sdk.registerLineOrder('myLine', (data) => data.reverse());
```
