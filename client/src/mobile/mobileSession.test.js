import { describe, it, expect } from 'vitest';
import { readHostState, createUsbCommand } from './mobileSession.js';
import { MOBILE_SYSTEMS, canRunMobileSystem } from './mobileSystems.js';

describe('iPad 页面与原生设备边界', () => {
  it('只有已适配的32×32系统允许进入真实USB工作区', () => {
    expect(MOBILE_SYSTEMS.find((system) => system.value === 'hand').label).toBe('手部检测');
    expect(canRunMobileSystem('hand')).toBe(true);
    expect(canRunMobileSystem('hand0205')).toBe(false);
    expect(canRunMobileSystem('unknown')).toBe(false);
  });
  it('连接命令携带实际端口和波特率，拒绝非法参数及未知动作', () => {
    expect(createUsbCommand('connect', { deviceId: 'CH340', baudRate: 1000000 }, 'request-1'))
      .toEqual({ type: 'usb.command', version: 1, action: 'connect', requestId: 'request-1', deviceId: 'CH340', baudRate: 1000000 });
    expect(() => createUsbCommand('connect', { baudRate: 1 })).toThrow();
    expect(() => createUsbCommand('license.activate')).toThrow();
  });
  it('未收到宿主状态时不伪造连接；非法状态不会覆盖真实状态', () => {
    expect(readHostState({ type: 'host.state', version: 2 })).toBeNull();
    const state = { type: 'host.state', version: 1, status: 'USB 数据接收中', error: '',
      devices: [{ id: 'CH340', name: 'Shroom CH340', vendorId: 6790, productId: 29987 }],
      selectedDevice: 'CH340', baudRate: 1000000, busy: false, frameCount: 12, source: 'usb' };
    expect(readHostState(state)).toMatchObject({ status: state.status, frameCount: 12, source: 'usb' });
    expect(readHostState({ ...state, devices: [{ name: 'invalid' }] })).toBeNull();
    expect(readHostState({ ...state, frameCount: -1 })).toBeNull();
  });
});
