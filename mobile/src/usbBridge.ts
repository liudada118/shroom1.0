import { requireOptionalNativeModule } from 'expo';
import type { PressureFrame } from './pressureContract';

export type UsbDevice = { id: string; name: string; vendorId: number; productId: number };
export type UsbState = { status: 'connecting' | 'connected' | 'disconnected' | 'error'; message?: string; connectionId?: string };
export type UsbCapabilities = { supported: boolean; platform: string; reason?: string };
type Subscription = { remove(): void };

type UsbModule = {
  capabilities(): Promise<UsbCapabilities>;
  listDevices(): Promise<UsbDevice[]>;
  connect(options: { baudRate: number; deviceId?: string; connectionId: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(event: 'onFrame', listener: (frame: PressureFrame) => void): Subscription;
  addListener(event: 'onState', listener: (state: UsbState) => void): Subscription;
};

/** 自定义 development build 提供真实模块；Expo Go 可检查展示但不具备 USB 驱动。 */
export const usbBridge = requireOptionalNativeModule<UsbModule>('ShroomUsbSerial');

/** 统一原生异常为界面可读信息，保留无驱动、权限或设备错误的说明。 */
export function describeUsbError(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'USB 连接失败');
}
