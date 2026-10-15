import { describe, it, expect } from 'vitest';
import { interp } from './squareInterpolation.js';

describe('原版矩阵点图插值', () => {
  it('保留原始行列、半格偏移和显示倍率，不修改输入', () => {
    const input = Array.from({ length: 1024 }, (_, index) => index % 256);
    const output = Array(4096).fill(0);
    interp(input, output, 32, 2);
    for (let row = 0; row < 32; row++) for (let col = 0; col < 32; col++) {
      expect(output[(row * 2 + 1) * 64 + col * 2 + 1]).toBe(input[row * 32 + col] * 10);
    }
    expect(output[0]).toBe(0);
    expect(input[255]).toBe(255);
  });
});
