function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 实时画布以 canonical channelId 为唯一状态键；outputChannel 只给旧消息兜底。
 */
export function getManifestFrameKey(frame = {}) {
  return String(frame.channelId || frame.outputChannel || frame.channel || '').trim();
}

/**
 * 把一批已路由帧合并进画布状态。只替换本批出现的通道，避免乱序到达时互相覆盖。
 * serial 使用本帧快照整体替换，断开/重连时不会残留上一次 COM 路径。
 */
export function reduceManifestChannelFrames(currentState = {}, routedFrames = []) {
  const frames = Array.isArray(routedFrames) ? routedFrames : [];
  let nextState = currentState;

  frames.forEach((frame) => {
    const key = getManifestFrameKey(frame);
    if (!key) return;
    if (nextState === currentState) nextState = { ...currentState };
    nextState[key] = {
      ...frame,
      serial: isObject(frame.serial) ? { ...frame.serial } : null,
    };
  });

  return nextState;
}

/**
 * 优先按 channelId 取状态；第二个键只用于没有 canonical 身份的旧通道。
 */
export function getManifestChannelFrame(channelFrames = {}, channelId = '', legacyChannel = '') {
  return channelFrames[String(channelId || '').trim()]
    || channelFrames[String(legacyChannel || '').trim()]
    || null;
}

/**
 * widget 标题同时展示画布名称、传感器业务名和当前物理串口。
 */
export function buildManifestWidgetLabel(baseLabel, frame, declaredSensor = {}) {
  const sensorLabel = String(
    frame?.sensorLabel
    || declaredSensor?.sensorLabel
    || declaredSensor?.label
    || declaredSensor?.sensorId
    || declaredSensor?.id
    || '',
  ).trim();
  const serialPath = String(
    frame?.serial?.path
    || frame?.serialPortPath
    || declaredSensor?.serial?.path
    || '',
  ).trim();
  const parts = [String(baseLabel || '').trim(), sensorLabel, serialPath].filter(Boolean);
  return [...new Set(parts)].join(' · ');
}
