import { decodeWebSocketPayload } from './sensorFrameDecoder';

export function parseJsonMessage(event) {
  return decodeWebSocketPayload(event?.data);
}

export function createJsonWebSocket(url, handlers = {}) {
  const socket = new WebSocket(url.trim());
  socket.onopen = handlers.onOpen || null;
  socket.onclose = handlers.onClose || null;
  socket.onerror = handlers.onError || null;
  socket.onmessage = (event) => {
    handlers.onMessage?.(parseJsonMessage(event), event);
  };
  return socket;
}

export function isObjectMessage(message) {
  return message != null && typeof message === 'object' && !Array.isArray(message);
}

export function hasValidLicenseDate(message) {
  return isObjectMessage(message) && message.date != null && message.date > 0 && message.valid !== false;
}

export function isExpiredLicenseMessage(message) {
  if (!hasValidLicenseDate(message)) return false;
  const serverNow = message.nowDate ? parseFloat(message.nowDate) : window.Date.now();
  const endDate = parseFloat(message.date);
  return endDate <= serverNow;
}

export function applyLicenseScopeToStorage(message) {
  if (!isObjectMessage(message) || message.selectFlag == null) return;

  if (message.selectFlag === 'all') {
    localStorage.setItem('matrixTitle', true);
    localStorage.removeItem('allowedTypes');
    return;
  }

  if (Array.isArray(message.selectFlag)) {
    localStorage.setItem('matrixTitle', true);
    localStorage.setItem('allowedTypes', JSON.stringify(message.selectFlag));
    return;
  }

  localStorage.removeItem('matrixTitle');
  localStorage.removeItem('allowedTypes');
}

export function getLicenseKeyFromMessage(message) {
  if (!isObjectMessage(message) || typeof message.licenseKey !== 'string') return '';
  return message.licenseKey.trim();
}

export function getSensorTypeListMap(message) {
  if (
    isObjectMessage(message) &&
    message.sensorTypeList &&
    message.sensorTypeList.map &&
    typeof message.sensorTypeList.map === 'object'
  ) {
    return message.sensorTypeList.map;
  }
  return null;
}

export function toLicenseStatus(message) {
  if (!isObjectMessage(message)) return null;

  if (message.licenseLocked) {
    return { locked: true, valid: false, error: message.reason || '检测到异常行为' };
  }

  if (message.licenseChecking) {
    return { checking: true };
  }

  if (message.licenseType !== undefined && message.date != null) {
    return {
      checking: !!message.checking,
      valid: !!message.valid,
      locked: false,
      type: message.licenseType,
      date: message.date,
      remainingDays: message.remainingDays,
      offline: !!message.offline,
    };
  }

  return null;
}

export function mergeLicenseErrorStatus(previousStatus, message) {
  if (!isObjectMessage(message) || message.licenseError == null) return previousStatus;
  return {
    ...(previousStatus || {}),
    checking: false,
    valid: false,
    locked: false,
    error: message.licenseError,
    noLicense: !!message.noLicense,
  };
}
