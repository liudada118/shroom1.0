/** 采集只接受当前系统的真实设备连接；串口名称和设备列表不是已连接的证据。 */
export function hasCollectionDevice({ definition, serialStates = {}, halowStatus, allowHalow = false, localCar = false, wsConnected }) {
  if (wsConnected !== true) return false;
  if (localCar) return true;
  const roles = definition?.source === 'manifest'
    ? (definition.sensors || []).map(sensor => sensor.serialRole || sensor.serial?.role || sensor.sensorId || sensor.id)
    : definition?.channels || [];
  if (roles.some(role => serialStates[role]?.status === 'open' && serialStates[role]?.isOpen === true)) return true;
  return Boolean(allowHalow && halowStatus?.running && halowStatus.phase === 'listening'
    && halowStatus.selectedDeviceId && halowStatus.clients?.some(client => client.deviceId === halowStatus.selectedDeviceId));
}

/** 新宿主的有效帧判定优先；旧宿主与独立网络采集必须有本次连接的新鲜压力帧。 */
export function collectionStartBlock({ history, wsConnected, systemId, sourceStatus, deviceConnected, localFrameReady, localCar = false }) {
  if (history !== 'now') return 'monitorUi.collectionExitPlayback';
  if (wsConnected !== true) return 'monitorUi.collectionConnectFirst';
  if (sourceStatus && !localCar) {
    if (sourceStatus.systemId !== systemId) return 'monitorUi.collectionWaitingForData';
    if (sourceStatus.code === 'COLLECTION_PLAYBACK_ACTIVE') return 'monitorUi.collectionExitPlayback';
    if (!sourceStatus.connected) return 'monitorUi.collectionConnectFirst';
    return sourceStatus.ready === true ? null : 'monitorUi.collectionWaitingForData';
  }
  if (!deviceConnected) return 'monitorUi.collectionConnectFirst';
  return localFrameReady === true ? null : 'monitorUi.collectionWaitingForData';
}
