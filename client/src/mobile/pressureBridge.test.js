import { describe, expect, it, vi } from 'vitest';
import { createPressureBridge, installPressureBridge, validatePressureMessage } from './pressureBridge.js';
import { createDemoPressureFrame } from './displayConfig.js';

/** 构造完整 USB 测试帧，不访问硬件或授权状态。 */
function usbFrame(sequence = 0, patches = {}) {
  return { type: 'pressure.frame', version: 1, source: 'usb', sequence,
    timestamp: 123456, rows: 32, columns: 32, values: Array(1024).fill(0), ...patches };
}

describe('移动压力桥协议', () => {
  it('接受完整 USB 帧与 JSON 字符串，复制读数避免后续修改污染画面', () => {
    const frame = usbFrame(7);
    frame.values[10] = 255;
    const validated = validatePressureMessage(JSON.stringify(frame));
    expect(validated).toEqual(frame);
    expect(validated.values).not.toBe(frame.values);
    const objectFrame = validatePressureMessage(frame);
    frame.values[10] = 0;
    expect(objectFrame.values[10]).toBe(255);
  });

  it.each([
    ['版本', { version: 2 }], ['类型', { type: 'serial.bytes' }], ['来源', { source: 'bluetooth' }],
    ['序号', { sequence: -1 }], ['序号类型', { sequence: '1' }],
    ['时间', { timestamp: NaN }], ['行数', { rows: 16 }], ['列数', { columns: 16 }],
    ['长度', { values: Array(1023).fill(0) }], ['下限', { values: [-1, ...Array(1023).fill(0)] }],
    ['上限', { values: [256, ...Array(1023).fill(0)] }],
    ['小数', { values: [12.5, ...Array(1023).fill(0)] }],
    ['空值', { values: [null, ...Array(1023).fill(0)] }],
    ['非数值', { values: ['255', ...Array(1023).fill(0)] }],
    ['无穷', { values: [Infinity, ...Array(1023).fill(0)] }],
  ])('拒绝非法%s', (_, patches) => {
    expect(() => validatePressureMessage(usbFrame(0, patches))).toThrow();
  });

  it('拒绝破损或过大 JSON，以及不完整重置消息', () => {
    expect(() => validatePressureMessage('{broken')).toThrow('JSON');
    expect(() => validatePressureMessage(' '.repeat(65537))).toThrow('过大');
    expect(() => validatePressureMessage({ type: 'stream.reset', version: 1 })).toThrow('来源');
    expect(() => validatePressureMessage(null)).toThrow('对象');
  });

  it('错误、重复和乱序帧不覆盖最近合法帧或正常接收计数', () => {
    const onFrame = vi.fn();
    const postMessage = vi.fn();
    const bridge = createPressureBridge({ onFrame, postMessage, now: () => 2000 });
    expect(bridge.receive(usbFrame(9, { values: [42, ...Array(1023).fill(0)] }))).toBe(true);
    expect(bridge.receive(usbFrame(10, { values: [] }))).toBe(false);
    expect(bridge.receive(usbFrame(9))).toBe(false);
    expect(bridge.receive(usbFrame(8))).toBe(false);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(bridge.snapshot()).toMatchObject({ acceptedFrames: 1, rejectedFrames: 3,
      sequence: 9, peak: 42, active: 1, status: 'receiving' });
    expect(bridge.snapshot().latestFrame.values[0]).toBe(42);
    expect(postMessage.mock.calls[0][0]).toEqual({ type: 'web.frame', sequence: 9 });
    expect(postMessage.mock.calls[1][0].type).toBe('web.error');
  });

  it('通过显式 reset 切换演示和 USB，重置画面及计数后接受从零开始的序号', () => {
    const onReset = vi.fn();
    const onFrame = vi.fn();
    const bridge = createPressureBridge({ onReset, onFrame, now: () => 2000 });
    bridge.receive(createDemoPressureFrame(100, 1000));
    expect(bridge.receive(usbFrame(0))).toBe(false);
    expect(bridge.snapshot().source).toBe('demo');
    expect(bridge.receive({ type: 'stream.reset', version: 1, source: 'usb' })).toBe(true);
    expect(bridge.snapshot()).toMatchObject({ source: 'usb', sequence: null,
      latestFrame: null, acceptedFrames: 0, rejectedFrames: 0, status: 'waiting', peak: 0 });
    expect(onReset).toHaveBeenCalledOnce();
    expect(bridge.receive(usbFrame(0))).toBe(true);
    bridge.receive({ type: 'stream.reset', version: 1, source: null });
    expect(bridge.snapshot().source).toBeNull();
    expect(bridge.receive(usbFrame(0))).toBe(true);
  });

  it('按本机接收时间显示断流，设备帧时间不能伪造实时状态', () => {
    let current = 1000;
    const bridge = createPressureBridge({ now: () => current });
    expect(bridge.snapshot()).toMatchObject({ status: 'waiting', fps: 0 });
    bridge.receive(usbFrame(0, { timestamp: 999999999999 }));
    expect(bridge.snapshot()).toMatchObject({ status: 'receiving', fps: 1 });
    current = 3000;
    expect(bridge.snapshot()).toMatchObject({ status: 'stale', fps: 0, acceptedFrames: 1 });
    bridge.receive(usbFrame(1));
    expect(bridge.snapshot().status).toBe('receiving');
  });

  it('ready 发出前安装入口，卸载后移除自己的入口但保留新的宿主入口', () => {
    const postMessage = vi.fn();
    const target = { ReactNativeWebView: { postMessage } };
    const bridge = createPressureBridge();
    const cleanup = installPressureBridge(target, bridge);
    expect(target.ShroomMobile.receive).toBe(bridge.receive);
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'web.ready', version: 1 }));
    cleanup();
    expect(target.ShroomMobile).toBeUndefined();
    const secondCleanup = installPressureBridge(target, bridge);
    target.ShroomMobile = { another: true };
    secondCleanup();
    expect(target.ShroomMobile).toEqual({ another: true });
  });
});
