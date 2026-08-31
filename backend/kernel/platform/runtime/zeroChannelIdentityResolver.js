function normalizeIdentityPart(value, fallback = 'unknown') {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized || fallback;
}

function sensorIdFromChannelId(channelId, fallback) {
  const value = String(channelId || '');
  const separator = value.indexOf(':');
  return separator >= 0
    ? value.slice(separator + 1)
    : normalizeIdentityPart(fallback, 'sensor');
}

/**
 * 解析 legacy 输出别名对应的 canonical channel identity。
 *
 * 有 manifest 时直接采用 runtime plan 的 channelId；没有 manifest 的旧传感器则使用
 * `${sensorType}:${outputChannel}` 作为稳定兼容身份。兼容身份仍包含展示系统维度，
 * 不会再把所有系统的 sit/back/head 零点混到同一组全局数组里。
 */
function createZeroChannelIdentityResolver({
  getActiveSensorType,
  listSerialChannels,
} = {}) {
  function getDeclaredChannels() {
    const sensorType = String(getActiveSensorType?.() || '').trim();
    const channels = listSerialChannels?.(sensorType);
    return Array.isArray(channels) ? channels : [];
  }

  function getActiveDisplaySystemId() {
    const declared = getDeclaredChannels();
    if (declared[0]?.displaySystemId) return String(declared[0].displaySystemId);
    const sensorType = String(getActiveSensorType?.() || '').trim();
    return sensorType ? normalizeIdentityPart(sensorType, 'legacy') : '';
  }

  function resolveChannelIdentity(outputChannel) {
    const channel = String(outputChannel || 'sit').trim() || 'sit';
    const declared = getDeclaredChannels();
    const match = declared.find((item) => (
      item.outputChannel === channel
      || item.serialRole === channel
      || item.channelId === channel
    ));

    if (match?.channelId) {
      return {
        channelId: String(match.channelId),
        displaySystemId: String(match.displaySystemId || getActiveDisplaySystemId()),
        sensorId: String(match.sensorId || sensorIdFromChannelId(match.channelId, channel)),
        sensorType: String(match.sensorType || getActiveSensorType?.() || 'legacy'),
        outputChannel: String(match.outputChannel || channel),
      };
    }

    const sensorType = normalizeIdentityPart(getActiveSensorType?.(), 'legacy');
    const normalizedChannel = normalizeIdentityPart(channel, 'sensor');
    return {
      channelId: `${sensorType}:${normalizedChannel}`,
      displaySystemId: sensorType,
      sensorId: normalizedChannel,
      sensorType,
      outputChannel: channel,
    };
  }

  function listActiveChannelIds() {
    return getDeclaredChannels()
      .map((channel) => String(channel.channelId || '').trim())
      .filter(Boolean);
  }

  return {
    getActiveDisplaySystemId,
    listActiveChannelIds,
    resolveChannelIdentity,
  };
}

module.exports = {
  createZeroChannelIdentityResolver,
  normalizeIdentityPart,
  sensorIdFromChannelId,
};
