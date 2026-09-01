/**
 * `@shroom/backend/identity` - 多传感器稳定身份。
 *
 * channelId 是展示、实时订阅和历史存储共同使用的长期主键。这里不做替换或猜测：
 * 任一身份片段包含冒号，或三个字段互相冲突，都返回 null，让边界调用方 fail-closed。
 */

const SENSOR_CHANNEL_SEPARATOR = ':';

/**
 * 校验一个身份片段。必须已去掉首尾空白，函数不会替用或裁剪显式标识。
 *
 * @param {*} value 候选 displaySystemId / sensorId。
 * @returns {string|null} 无歧义片段；无效时 null。
 */
function normalizeSensorIdentityPart(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    !normalized
    || value !== normalized
    || normalized.includes(SENSOR_CHANNEL_SEPARATOR)
  ) {
    return null;
  }
  return normalized;
}

/**
 * 由两个无歧义身份片段构造 canonical channelId。
 *
 * @param {*} displaySystemId 展示系统 ID。
 * @param {*} sensorId 传感器 ID。
 * @returns {string|null} `displaySystemId:sensorId`；任一片段无效时 null。
 */
function buildSensorChannelId(displaySystemId, sensorId) {
  const resolvedDisplaySystemId = normalizeSensorIdentityPart(displaySystemId);
  const resolvedSensorId = normalizeSensorIdentityPart(sensorId);
  if (!resolvedDisplaySystemId || !resolvedSensorId) return null;
  return `${resolvedDisplaySystemId}${SENSOR_CHANNEL_SEPARATOR}${resolvedSensorId}`;
}

/**
 * 严格解析 canonical channelId。只允许恰好一个冒号，避免 `a:b:c` 有多种切法。
 *
 * @param {*} channelId 候选通道 ID。
 * @returns {{channelId:string, displaySystemId:string, sensorId:string}|null} 身份三元组。
 */
function parseSensorChannelId(channelId) {
  if (typeof channelId !== 'string') return null;
  const normalizedChannelId = channelId.trim();
  if (channelId !== normalizedChannelId) return null;
  const firstSeparator = normalizedChannelId.indexOf(SENSOR_CHANNEL_SEPARATOR);
  if (
    firstSeparator <= 0
    || firstSeparator !== normalizedChannelId.lastIndexOf(SENSOR_CHANNEL_SEPARATOR)
    || firstSeparator >= normalizedChannelId.length - 1
  ) {
    return null;
  }

  const displaySystemId = normalizeSensorIdentityPart(
    normalizedChannelId.slice(0, firstSeparator),
  );
  const sensorId = normalizeSensorIdentityPart(
    normalizedChannelId.slice(firstSeparator + 1),
  );
  const canonicalChannelId = buildSensorChannelId(displaySystemId, sensorId);
  if (!canonicalChannelId || canonicalChannelId !== normalizedChannelId) return null;

  return {
    channelId: canonicalChannelId,
    displaySystemId,
    sensorId,
  };
}

/**
 * 校验/补齐传感器身份。
 *
 * 默认是 canonical 严格模式：三个字段必须都存在且完全一致。`allowDerived` 只给
 * legacy 适配边界使用，可由合法 channelId 补 displaySystemId/sensorId，或由后两者
 * 构造 channelId；只要调用方同时提供的字段冲突，仍返回 null。
 *
 * @param {object} identity 候选身份。
 * @param {{allowDerived?: boolean}} options 兼容选项。
 * @returns {{channelId:string, displaySystemId:string, sensorId:string}|null} 一致身份。
 */
function resolveSensorIdentity(identity = {}, options = {}) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return null;

  const allowDerived = options.allowDerived === true;
  const hasChannelId = typeof identity.channelId === 'string'
    && identity.channelId.trim() !== '';
  const hasDisplaySystemId = typeof identity.displaySystemId === 'string'
    && identity.displaySystemId.trim() !== '';
  const hasSensorId = typeof identity.sensorId === 'string'
    && identity.sensorId.trim() !== '';

  // 非空但不是字符串也属于显式坏输入，不能在 legacy 模式中当作「未提供」绕过。
  if (
    (identity.channelId != null && !hasChannelId)
    || (identity.displaySystemId != null && !hasDisplaySystemId)
    || (identity.sensorId != null && !hasSensorId)
  ) {
    return null;
  }

  if (!allowDerived && (!hasChannelId || !hasDisplaySystemId || !hasSensorId)) return null;

  const parsedChannel = hasChannelId ? parseSensorChannelId(identity.channelId) : null;
  if (hasChannelId && !parsedChannel) return null;

  const explicitDisplaySystemId = hasDisplaySystemId
    ? normalizeSensorIdentityPart(identity.displaySystemId)
    : null;
  const explicitSensorId = hasSensorId
    ? normalizeSensorIdentityPart(identity.sensorId)
    : null;
  if (
    (hasDisplaySystemId && !explicitDisplaySystemId)
    || (hasSensorId && !explicitSensorId)
  ) {
    return null;
  }

  if (
    parsedChannel
    && (
      (explicitDisplaySystemId && explicitDisplaySystemId !== parsedChannel.displaySystemId)
      || (explicitSensorId && explicitSensorId !== parsedChannel.sensorId)
    )
  ) {
    return null;
  }

  const displaySystemId = explicitDisplaySystemId || parsedChannel?.displaySystemId || null;
  const sensorId = explicitSensorId || parsedChannel?.sensorId || null;
  const channelId = parsedChannel?.channelId
    || (allowDerived ? buildSensorChannelId(displaySystemId, sensorId) : null);
  if (!channelId || !displaySystemId || !sensorId) return null;

  return { channelId, displaySystemId, sensorId };
}

module.exports = {
  SENSOR_CHANNEL_SEPARATOR,
  buildSensorChannelId,
  normalizeSensorIdentityPart,
  parseSensorChannelId,
  resolveSensorIdentity,
};
