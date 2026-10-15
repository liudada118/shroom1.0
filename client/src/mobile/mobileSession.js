const ACTIONS = new Set(['refresh', 'connect', 'disconnect', 'demo']);
export const INITIAL_HOST = Object.freeze({ status: '等待连接', error: '', devices: [],
  selectedDevice: '', baudRate: 1000000, busy: false, frameCount: 0, source: null });

/** 只构造当前iPad支持的命令，不开放桌面授权、存储或任意脚本入口。 */
export function createUsbCommand(action, options = {}, requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  if (!ACTIONS.has(action)) throw new Error('不支持的设备操作');
  if (typeof requestId !== 'string' || !requestId.length || requestId.length > 80) throw new Error('无效的请求标识');
  const command = { type: 'usb.command', version: 1, action, requestId };
  if (action === 'connect') {
    if (!Number.isSafeInteger(options.baudRate) || options.baudRate < 115200 || options.baudRate > 1000000) throw new Error('波特率应为115200–1000000的整数');
    if (options.deviceId !== undefined && (typeof options.deviceId !== 'string' || !options.deviceId.length || options.deviceId.length > 256)) throw new Error('请选择有效设备');
    command.baudRate = options.baudRate;
    if (options.deviceId !== undefined) command.deviceId = options.deviceId;
  }
  return command;
}

/** 校验宿主设备状态；错误或未知消息不能把界面变成已连接。 */
export function readHostState(message) {
  if (!message || message.type !== 'host.state' || message.version !== 1 || typeof message.status !== 'string'
    || typeof message.error !== 'string' || typeof message.busy !== 'boolean'
    || !Number.isSafeInteger(message.frameCount) || message.frameCount < 0
    || !Number.isSafeInteger(message.baudRate) || message.baudRate < 115200 || message.baudRate > 1000000
    || ![null, 'usb', 'demo'].includes(message.source) || !Array.isArray(message.devices) || message.devices.length > 64
    || !message.devices.every((device) => device && typeof device.id === 'string' && device.id.length > 0 && device.id.length <= 256
      && typeof device.name === 'string' && Number.isInteger(device.vendorId) && Number.isInteger(device.productId))) return null;
  return { ...INITIAL_HOST, ...message, selectedDevice: typeof message.selectedDevice === 'string' ? message.selectedDevice : '' };
}
