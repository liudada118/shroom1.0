/**
 * `@shroom/backend/telemetry` - 实时帧通道
 *
 * 依赖只有 Node 内置 `events`。
 *
 * - `createChannelBus()`：按 `channelId` 发布/订阅的进程内总线，带每通道计数和时间戳。
 * - `normalizeLegacyRealtimeFrame()`：把旧实时下发 payload 归一成标准 telemetry 帧
 *   （`channelId` / `deviceId` / `portId` / `metric` / `value` / `quality`），
 *   帧形状的定义在 `@shroom/backend/contract` 的 `telemetry.frameShape`。
 */
module.exports = {
  ...require('./channelBus'),
  ...require('./telemetryNormalizer'),
};
