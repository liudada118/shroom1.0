/**
 * `@shroom/backend/sensors` - 传感器注册表
 *
 * 零依赖（`wholeChair` 用到本包 `processing/mathUtils` 的高斯模糊，仍是纯计算）。
 *
 * 一个传感器类型在这里回答四个问题：矩阵多大、走哪几个通道、波特率多少、
 * 支持哪些能力（`realtime` / `playback` / `collection` / `csv` / `zeroFrame` /
 * `threePort` / `handStorage` / `smallBedMatrix`）。串口、采集、回放、CSV
 * 都应该从 `getSensorDefinition()` 读，而不是各自写一份 if。
 *
 * 五个协议插件（`smallBed12B` / `minzhen` / `wholeChair` / `handGloveFullPacket` /
 * `handGloveDouble`）是各自帧格式的真实解析实现，注册表把它们按类型挂上去。
 */
module.exports = require('./registry');
