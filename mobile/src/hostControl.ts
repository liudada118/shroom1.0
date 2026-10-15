import type { FrameSource } from './pressureContract';
import type { UsbDevice } from './usbBridge';

type CommandHeader = { type: 'usb.command'; version: 1; requestId: string };
export type UsbCommand = CommandHeader & (
  { action: 'refresh' | 'disconnect' | 'demo' } |
  { action: 'connect'; deviceId?: string; baudRate: number }
);
export type HostState = {
  status: string;
  error: string;
  devices: UsbDevice[];
  selectedDevice?: string;
  baudRate: number;
  busy: boolean;
  frameCount: number;
  source: FrameSource | null;
};

/** 在原生 USB 操作前校验网页命令的类型、大小及参数。 */
export function parseUsbCommand(raw: string): UsbCommand {
  if (raw.length > 2048) throw new Error('页面命令过长');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('页面命令格式无效');
  const message = value as Record<string, unknown>;
  if (message.type !== 'usb.command' || message.version !== 1) throw new Error('不支持此页面命令');
  if (typeof message.requestId !== 'string' || !message.requestId.trim() || message.requestId.length > 80) {
    throw new Error('页面命令缺少有效请求标识');
  }
  if (message.deviceId !== undefined && (typeof message.deviceId !== 'string' || !message.deviceId.trim() || message.deviceId.length > 256)) {
    throw new Error('USB 设备标识无效');
  }
  const header: CommandHeader = { type: 'usb.command', version: 1, requestId: message.requestId };
  if (message.action === 'connect') {
    if (typeof message.baudRate !== 'number' || !Number.isSafeInteger(message.baudRate) || message.baudRate < 115200 || message.baudRate > 1000000) {
      throw new Error('波特率应为 115200–1000000 的整数');
    }
    return { ...header, action: 'connect', baudRate: message.baudRate, ...(message.deviceId === undefined ? {} : { deviceId: message.deviceId as string }) };
  }
  if (message.action === 'refresh' || message.action === 'disconnect' || message.action === 'demo') return { ...header, action: message.action };
  throw new Error('不支持此 USB 操作');
}

/** 将宿主状态编码为固定入口调用，所有内容仅作为 JSON 数据传递。 */
export function serializeHostState(state: HostState): string {
  const json = JSON.stringify({ type: 'host.state', version: 1, ...state, selectedDevice: state.selectedDevice ?? null })
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.ShroomMobileHost && window.ShroomMobileHost.receive(${json});true;`;
}
