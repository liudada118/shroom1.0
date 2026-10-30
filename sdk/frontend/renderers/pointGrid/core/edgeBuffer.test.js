import { describe, expect, it } from 'vitest';
import { gaussBlur_1 } from '../../../core/frameMath.js';
import { blurWithZeroBoundary, buildEdgeBufferRing, normalizeEdgeBuffer, sampleEdgeBuffer } from './edgeBuffer.js';

describe('点图外侧缓冲', () => {
  it('消除重复边界采样：矩形上的同强度角点与内部点峰值一致', () => {
    const width = 24, height = 18;
    const corner = Object.freeze(Array.from({ length: width * height }, (_, i) => i === 0 ? 1000 : 0));
    const center = Object.freeze(Array.from({ length: width * height }, (_, i) => i === 9 * width + 12 ? 1000 : 0));
    const old = new Array(corner.length).fill(0);
    gaussBlur_1(corner, old, width, height, 2);
    const bufferedCorner = blurWithZeroBoundary(corner, width, height, 2);
    const bufferedCenter = blurWithZeroBoundary(center, width, height, 2);
    expect(Math.max(...old)).toBe(360);
    expect(Math.max(...bufferedCorner)).toBe(40);
    expect(Math.max(...bufferedCenter)).toBe(40);
    expect(bufferedCorner).toHaveLength(corner.length);
    expect(corner.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(center.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('只衰减原矩阵外侧，外沿为零且关闭高斯不产生NaN', () => {
    const raw = Object.freeze([120, 80, 40, 90, 50, 10]);
    const blurred = blurWithZeroBoundary(raw, 3, 2, 0);
    expect(blurred).toEqual(raw);
    expect(blurred).not.toBe(raw);
    for (let index = 0; index < raw.length; index += 1) {
      expect(sampleEdgeBuffer(blurred, 2, 3, Math.floor(index / 3), index % 3, 0, 4)).toBe(raw[index]);
    }
    expect(sampleEdgeBuffer(blurred, 2, 3, -1, 0, 0, 4)).toBe(101.25);
    expect(sampleEdgeBuffer(blurred, 2, 3, -3, 0, 0, 4)).toBe(18.75);
    expect(sampleEdgeBuffer(blurred, 2, 3, -4, 0, 0, 4)).toBe(0);
    expect(sampleEdgeBuffer(blurred, 2, 3, 5, 6, 0, 4)).toBe(0);
  });

  it('矩形拉伸保持原点坐标和采样索引，缓冲是矩阵外的完整环', () => {
    const ring = buildEdgeBufferRing(3, 5, 0, 2, 2);
    expect(ring).toHaveLength(((3 + 4) * (5 + 4) - 3 * 5) * 2);
    expect(ring.every(([row, col]) => row < 0 || row >= 3 || col < 0 || col >= 5)).toBe(true);
    expect(ring).toContainEqual([-1, 0, -2]);
    expect(ring).toContainEqual([-1, 0, -1]);
    const smooth = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(sampleEdgeBuffer(smooth, 3, 5, -1, 0, 0, 2, 2, 0)).toBe(smooth[0] / 2);
    expect(sampleEdgeBuffer(smooth, 3, 5, -1, 0, 0, 2, 2, 1)).toBe(smooth[5] / 2);
    expect(buildEdgeBufferRing(11, 13, 4, 4)).toHaveLength(0);
  });

  it('整数边宽0关闭，非法输入保留回退值', () => {
    expect(normalizeEdgeBuffer(0, 4)).toBe(0);
    expect(normalizeEdgeBuffer(2.8)).toBe(3);
    expect(normalizeEdgeBuffer(100)).toBe(16);
    expect(normalizeEdgeBuffer(NaN, 4)).toBe(4);
  });
});
