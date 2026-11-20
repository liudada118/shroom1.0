import { describe, expect, it } from 'vitest';
import { interp } from '../../assets/util/util';
import { collectSmallBedAsidePoints } from './smallBedAsideStats';

const SIZE = 32, INTERP = 2, X_STRETCH = 2;

/**
 * 按 smallBed.jsx 的做法把原始点阵铺成显示网格：先 interp 放大，再横向每列复制 xStretch 份。
 * @returns {{ grid: number[], columns: number, rows: number }} 下标是 列*rows+行，和渲染循环一致
 */
function displayGrid(raw) {
  const base = SIZE * INTERP;
  const big = new Array(base * base).fill(0);
  interp(raw, big, SIZE, INTERP);
  const grid = new Array(base * base * X_STRETCH).fill(0);
  for (let i = 0; i < base; i++) {
    for (let j = 0; j < base; j++) {
      for (let stretch = 0; stretch < X_STRETCH; stretch++) grid[(i * X_STRETCH + stretch) * base + j] = big[i * base + j];
    }
  }
  return { grid, columns: base * X_STRETCH, rows: base };
}

/** 渲染循环里落在框选范围内的显示格子所对应的原始值（interp 把原始值乘了 10）。 */
function rawValuesInsideSelection(raw, selection) {
  const { grid, columns, rows } = displayGrid(raw);
  const values = new Set();
  for (let ix = 0; ix < columns; ix++) {
    for (let iy = 0; iy < rows; iy++) {
      const inside = ix >= selection[0] && ix < selection[1] && iy >= selection[2] && iy < selection[3];
      if (inside && grid[ix * rows + iy] > 0) values.add(grid[ix * rows + iy] / 10);
    }
  }
  return [...values].sort((a, b) => a - b);
}

const collect = (raw, extra = {}) => collectSmallBedAsidePoints({ raw, width: SIZE, height: SIZE, interp: INTERP, xStretch: X_STRETCH, ...extra });

describe('小床侧栏统计取数', () => {
  it('整张床都有读数时有效点数是 1024，不是显示网格的 8192', () => {
    const raw = new Array(SIZE * SIZE).fill(20);
    expect(displayGrid(raw).grid).toHaveLength(8192);
    expect(collect(raw)).toHaveLength(1024);
  });

  it('只取大于阈值的原始值，顺序和原始点阵一致', () => {
    const raw = new Array(SIZE * SIZE).fill(0);
    raw[5] = 12; raw[40] = 6; raw[41] = 3; raw[1023] = 255;
    expect(collect(raw)).toEqual([12, 6, 3, 255]);
    expect(collect(raw, { threshold: 5 })).toEqual([12, 6, 255]);
    expect(collect(new Array(SIZE * SIZE).fill(0))).toEqual([]);
  });

  it('没有框选或框选全 0 时统计整张床', () => {
    const raw = Array.from({ length: SIZE * SIZE }, (_, index) => index + 1);
    expect(collect(raw, { selection: [] })).toHaveLength(1024);
    expect(collect(raw, { selection: [0, 0, 0, 0] })).toHaveLength(1024);
    expect(collect(raw, { selection: null })).toHaveLength(1024);
  });

  it('框选时取到的原始点和画面上框住的点一致', () => {
    const raw = Array.from({ length: SIZE * SIZE }, (_, index) => index + 1);
    // 行列不对称的框，行列对调写反了这些断言会失败
    for (const selection of [[0, 40, 10, 30], [64, 128, 0, 16], [3, 4, 0, 64], [20, 100, 31, 33], [0, 128, 0, 64], [126, 128, 62, 64]]) {
      const selected = collect(raw, { selection }).sort((a, b) => a - b);
      expect(selected, `selection ${selection}`).toEqual(rawValuesInsideSelection(raw, selection));
    }
    expect(collect(raw, { selection: [0, 40, 10, 30] })).toHaveLength(100);
  });

  it('按传入的宽高取数，16×16 最多 256 点', () => {
    expect(collectSmallBedAsidePoints({ raw: new Array(256).fill(1.5), width: 16, height: 16 })).toHaveLength(256);
  });
});
