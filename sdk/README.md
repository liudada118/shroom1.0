# Shroom Backend SDK

第一版 SDK 只负责后端数据链路，不包含 UI。它把当前后端里的 WebSocket 命令、串口读取、协议解析、采集、回放和下载拆成可复用模块。

## 后端操作映射

当前 `server.js` 的后端能力可以拆成这些 SDK 域：

| 域 | 原后端操作 | SDK 模块 |
| :--- | :--- | :--- |
| 授权 | 密钥解密、到期时间、授权系统下发 | `LicenseService` |
| 系统配置 | `file` 切换、波特率、协议类型 | `ProtocolRegistry` / `profiles` |
| 串口 | 串口识别、打开、关闭、通道绑定 | `ShroomSensorSDK.listPorts()` / `open()` / `SensorSession` |
| 实时解析 | parser `data` 事件、原始帧解析、实时 payload | `ProtocolRegistry.parse()` / `session.on('frame')` |
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
});
```

如果协议特殊，可以提供 `parseFrame(buffer, profile, context)`，返回和默认 frame 相同结构的数据。
