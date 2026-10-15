import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createMobileDisplayFrame } from './pressureDisplayFrame.js';

const require = createRequire(import.meta.url);
const { jqbed } = require('../../../sdk/backend/processing/lineOrders.js');

describe('移动手部 USB 线序', () => {
  it('1024 个点与桌面 hand 的 jqbed 完全一致，且不改写原始帧', () => {
    const values = Array.from({ length: 1024 }, (_, index) => index);
    const frame = Object.freeze({ source: 'usb', values: Object.freeze(values) });
    const output = createMobileDisplayFrame(frame).channels.sit;
    expect(output).toEqual(jqbed(values));
    expect(output.slice(0, 32)).toEqual(values.slice(15 * 32, 16 * 32));
    expect(output.slice(-32)).toEqual(values.slice(0, 32));
    expect(new Set(output).size).toBe(1024);
    expect(frame.values).toEqual(Array.from({ length: 1024 }, (_, index) => index));
  });

  it('不对显示坐标中的演示帧再次应用 USB 线序', () => {
    const values = Array.from({ length: 1024 }, (_, index) => index % 251);
    const output = createMobileDisplayFrame({ source: 'demo', values }).channels.sit;
    expect(output).toEqual(values);
    expect(output).not.toBe(values);
  });

  it('四角和行折返点脉冲落在原版坐标，列顺序不变', () => {
    const values = Array(1024).fill(0);
    [[15, 0, 11], [15, 31, 22], [0, 0, 33], [0, 31, 44], [31, 4, 55], [14, 5, 66]]
      .forEach(([row, column, value]) => { values[row * 32 + column] = value; });
    const output = createMobileDisplayFrame({ source: 'usb', values }).channels.sit;
    [[0, 0, 11], [0, 31, 22], [31, 0, 33], [31, 31, 44], [16, 4, 55], [17, 5, 66]]
      .forEach(([row, column, value]) => expect(output[row * 32 + column]).toBe(value));
    expect(output.reduce((sum, value) => sum + value, 0)).toBe(231);
  });
});
