/**
 * `@shroom/backend/serial` - 串口生命周期与切帧
 *
 * **这是包里唯一硬依赖原生模块的入口**（peer: `serialport` +
 * `@serialport/parser-delimiter`）。没装它们的消费者仍然可以用
 * `/protocol`、`/processing`、`/sensors`、`/collection` —— 分层就是为这条线切的。
 *
 * | 模块 | 管什么 |
 * | :--- | :--- |
 * | `serialHelper` | 单个串口的打开/关闭/写入，以及端口枚举 |
 * | `serialManager` | 多路串口（sit / back / head / sensor）的生命周期与断线重连 |
 * | `serialPathReservation` | 协议探测与业务打开之间的物理路径互斥 |
 * | `serialParserManager` | 命名 parser 通道；`createParserFromProtocol()` 把一份 protocol 声明直接变成切帧器 |
 * | `serialPortFilterService` | 按平台和厂商 ID 过滤掉不是传感器的端口 |
 *
 * `createSerialManager` / `createSerialParserManager` 都是依赖注入的工厂，
 * `logger`、`createSerialPort` 都能替换，所以测试里不需要真串口。
 *
 * 协议声明本身在 `@shroom/backend/protocol`，那一层不碰硬件。
 */
module.exports = {
  ...require('./serialPathReservation'),
  ...require('./serialHelper'),
  ...require('./serialManager'),
  ...require('./serialParserManager'),
  ...require('./serialPortFilterService'),
};
