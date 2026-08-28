/**
 * 瀹炴椂 telemetry 缃戝叧銆?
 *
 * 璐熻矗鎶婃棫 sit/back/head 瀹炴椂 payload 鍚屾椂鍙戝竷鍒版棫 WebSocket 閫氶亾鍜屾柊鐨?
 * 鏍囧噯 telemetry channel銆傚畠鏄棫鍓嶇鍏煎閫氶亾涓庢柊 ChannelBus 妯″瀷涔嬮棿鐨勬ˉ銆?
 */
const {
  normalizeLegacyRealtimeFrame,
  parsePayload,
} = require('@shroom/backend/telemetry/telemetryNormalizer.js');

/**
 * 旧三通道 payload 已有 sitData/backData/headData；manifest 自定义通道使用
 * `${outputChannel}Data`。在不改 SDK 契约和原始 WebSocket payload 的前提下，
 * 为标准 telemetry 归一化补一个统一 pressureData 视图。
 */
function prepareTelemetryPayload(channel, payload) {
  const data = parsePayload(payload);
  if (!data || Array.isArray(data.pressureData)) return payload;
  const channelData = data[`${String(channel || '').trim()}Data`];
  const pressureData = Array.isArray(channelData)
    ? channelData
    : (Array.isArray(data.data) ? data.data : null);
  return pressureData ? { ...data, pressureData } : payload;
}

/**
 * 鍒涘缓瀹炴椂 telemetry 缃戝叧銆?
 *
 * @param {object} deps ChannelBus銆佽闃呯鐞嗗櫒鍜屼紶鎰熷櫒绫诲瀷璇诲彇鍣ㄣ€?
 * @returns {{ publishRealtimeFrame: Function }} 瀹炴椂鍙戝竷 API銆?
 */
function createRealtimeTelemetryGateway({
  channelBus,
  wsSubscriptions,
  getSensorType,
  source = 'server.js',
} = {}) {
  if (!channelBus) {
    throw new Error('channelBus is required');
  }
  if (!wsSubscriptions) {
    throw new Error('wsSubscriptions is required');
  }

  /**
   * 鍙戝竷瀹炴椂甯э細鍏煎鏃ч€氶亾鎺ㄩ€侊紝鍚屾椂鐢熸垚鏍囧噯 telemetry 閫氶亾甯с€?
   *
   * @param {string} channel 鏃у疄鏃堕€氶亾锛屼緥濡?sit/back/head銆?
   * @param {string | object} payload 鏃ч€氶亾 payload銆?
   * @returns {{legacySent: number, telemetrySent: number, telemetryFrame: object | null}}
   */
  function publishRealtimeFrame(channel, payload) {
    const sensorType = typeof getSensorType === 'function' ? getSensorType() : undefined;
    const legacyEvent = channelBus.publish(channel, payload, {
      sensorType,
      source,
    });
    const legacySent = wsSubscriptions.publish(channel, payload);
    const telemetryFrame = normalizeLegacyRealtimeFrame(
      channel,
      prepareTelemetryPayload(channel, payload),
      {
        sensorType,
        timestamp: legacyEvent.timestamp,
      },
    );

    if (!telemetryFrame) {
      return {
        legacySent,
        telemetrySent: 0,
        telemetryFrame: null,
      };
    }

    channelBus.publish(telemetryFrame.channelId, telemetryFrame, {
      sensorType,
      source: 'telemetry-normalizer',
      legacyChannel: channel,
      standard: true,
    });

    return {
      legacySent,
      telemetrySent: wsSubscriptions.publishExact(telemetryFrame.channelId, telemetryFrame),
      telemetryFrame,
    };
  }

  return {
    publishRealtimeFrame,
  };
}

module.exports = {
  createRealtimeTelemetryGateway,
  prepareTelemetryPayload,
};
