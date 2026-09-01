/**
 * index.js - `@shroom/backend` 根出口
 *
 * ## 分层：按「要不要原生依赖」切，不按业务切
 *
 * | 入口 | 内容 | 依赖 |
 * | :--- | :--- | :--- |
 * | `@shroom/backend/contract` | HTTP 路由表、命令信封、telemetry 帧形状 | 无 |
 * | `@shroom/backend/processing` | 线序、矩阵、压力、插值、平滑、通用数学 | 无 |
 * | `@shroom/backend/protocol` | protocol schema + 10 份串口协议预设 | fs |
 * | `@shroom/backend/sensors` | 传感器注册表 + 5 个协议插件 | 无 |
 * | `@shroom/backend/telemetry` | 通道总线 + 帧归一化 | events |
 * | `@shroom/backend/collection` | 采集限流、磁盘保护、入库队列 | 无 |
 * | `@shroom/backend/identity` | 多传感器 channelId 构造、解析与一致性校验 | 无 |
 * | `@shroom/backend/logger` | 统一日志 | fs |
 * | `@shroom/backend/serial` | 串口生命周期与切帧 | peer: serialport |
 * | `@shroom/backend/storage` | SQLite 采集库 | peer: better-sqlite3 |
 * | `@shroom/backend/export` | CSV 导出 | peer: csv-writer |
 * | `@shroom/backend/client` | 连已跑起来的后端 | peer: ws |
 * | `@shroom/backend/session` | 上面这些串成的一条链 | peer: serialport |
 *
 * ## 根出口为什么要懒加载
 *
 * 上半张表（到 `logger` 为止）在这里是**直接展开**的：零原生依赖，什么都不装也能 require。
 *
 * 下半张表是 `Object.defineProperty` 的 getter，**碰到才加载**。原因很实际：
 * `serialport` / `better-sqlite3` 都是需要编译的原生模块，一个只想用线序和压力换算的
 * 消费者不该因为根出口而被迫装它们。写成 getter 之后，
 * `require('@shroom/backend').press(...)` 在没装任何 peer 的机器上也能跑，
 * 只有真的去取 `ShroomSensorSDK` 才会触发 `serialport` 的加载。
 *
 * 对照前端包 `@shroom/frontend`：那边根出口是**整个不含** `react/`（一旦含了，裸 Node
 * 消费者连 import 都做不到）。ESM 的 `export *` 没法懒，CJS 有 getter，所以这边能做得更松。
 *
 * ⚠️ 代价：**对根出口做 `{...require('@shroom/backend')}` 会触发全部 getter**，
 * 等于把 4 个 peer 全加载一遍。要转出请直接 `module.exports = require('@shroom/backend')`。
 */

/* ── 零依赖层：直接展开 ─────────────────────────────────────────── */
module.exports = {
  ...require('./contract'),
  ...require('./processing'),
  ...require('./protocol'),
  ...require('./sensors'),
  ...require('./telemetry'),
  ...require('./collection'),
  ...require('./identity'),
  logger: require('./logger'),
};

/* ── 需要 peer 依赖的层：碰到才加载 ─────────────────────────────── */
const LAZY_EXPORTS = {
  './serial': [
    'FRAME_DELIMITER',
    'SerialManager',
    'closePort',
    'createParserFromProtocol',
    'createSerialManager',
    'createSerialParserManager',
    'createSerialPort',
    'createSerialPortFilterService',
    'getSerialPathReservation',
    'listPorts',
    'openPort',
    'releaseSerialPath',
    'reserveSerialPath',
    'writeToPort',
  ],
  './storage': [
    'CaptureStore',
    'MemoryCaptureStore',
  ],
  './export': [
    'CsvExporter',
    'createPressureStatsCsvWriter',
    'createSensorCsvWriter',
    'generateCsvFileName',
  ],
  './client': [
    'BACKEND_OPERATIONS',
    'BackendCommandRouter',
    'BackendSdkClient',
    'listBackendOperations',
  ],
  './session': [
    'DEFAULT_SENSOR_PROFILES',
    'LicenseService',
    'LineOrderRegistry',
    'PROJECT_LINE_ORDER_NAMES',
    'PathService',
    'ProtocolRegistry',
    'ReplayService',
    'ReportService',
    'SMALL_BED_12B_FRAME_TAIL',
    'STANDARD_FRAME_DELIMITER',
    'SensorSession',
    'ShroomSensorSDK',
    'ZeroCalibrator',
    'createProjectLineOrderRegistry',
    'getDefaultBaudRate',
    'resolveProfile',
  ],
};

Object.entries(LAZY_EXPORTS).forEach(([modulePath, names]) => {
  names.forEach((name) => {
    Object.defineProperty(module.exports, name, {
      configurable: true,
      enumerable: true,
      get() {
        return require(modulePath)[name];
      },
    });
  });
});
