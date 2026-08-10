/**
 * `@shroom/backend/session` - 串起来的一条链
 *
 * peer: `serialport` + `@serialport/parser-delimiter`（`ShroomSensorSDK.open()` 用）。
 *
 * 上面那些层是零件，这一层是**装好的整机**，新项目从这里起步最快：
 *
 * ```text
 * SerialPort → DelimiterParser → ProtocolRegistry.parse → ZeroCalibrator
 *            → frame 事件 → CaptureStore → CsvExporter
 * ```
 *
 * ```js
 * const { ShroomSensorSDK } = require('@shroom/backend/session');
 * const sdk = new ShroomSensorSDK();
 * const session = await sdk.open({ sensorType: 'hand0205', port: 'COM3', channels: ['sit'] });
 * session.on('frame', (frame) => console.log(frame.pressureData.length));
 * ```
 *
 * 完整可跑的例子见 `examples/quickstart.js`（带 `--mock`，没硬件也能跑）。
 *
 * ## 和 `@shroom/backend/sensors` 的关系
 *
 * `profiles.js` 是这一层自己的传感器档案（波特率 / 分帧 / 解码偏移），
 * 和 `sensors/registry.js` 的传感器定义**目前是两份**。两边对同一类型的波特率
 * 必须一致，由 `session/profiles.test.js` 守着；合并留到下一轮
 * （`profiles` 有 registry 没有的规则，比如 `robot` 前缀匹配）。
 */
module.exports = {
  ...require('./ShroomSensorSDK'),
  ...require('./profiles'),
  ...require('./protocol/ProtocolRegistry'),
  ...require('./protocol/parsers'),
  ...require('./serial/SensorSession'),
  ...require('./processing/ZeroCalibrator'),
  ...require('./replay/ReplayService'),
  ...require('./line/LineOrderRegistry'),
  ...require('./line/projectLineOrders'),
  ...require('./config/PathService'),
  ...require('./license/LicenseService'),
  ...require('./report/ReportService'),
  ...require('./utils/stats'),
};
