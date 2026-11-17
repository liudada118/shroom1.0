/**
 * matrixViewTransform.test.js - 数字矩阵展示方向（旋转 90°、水平 / 纵向翻转）的行列换算与工具状态
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createMatrixViewTools,
  isUprightMatrixView,
  matrixViewAxisLabels,
  matrixViewCell,
  matrixViewIndexMap,
  matrixViewSize,
  normalizeMatrixView,
  normalizeQuarterTurns,
  transformMatrixView,
  validateMatrixViewSnapshot,
} from './matrixViewTransform.js';

/** 3 列 × 2 行，值就是「行号 × 10 + 列号」（1 起点），一眼能看出落到了哪。 */
const SOURCE = [11, 12, 13, 21, 22, 23];
/** 只转不翻的展示方向。 */
const turned = (quarterTurns) => ({ quarterTurns });
/** 全部 16 种写法：两个翻转开关 × 四个圈数。 */
const ALL_VIEWS = [false, true].flatMap((flipX) => [false, true].flatMap((flipY) => [0, 1, 2, 3].map((quarterTurns) => ({ flipX, flipY, quarterTurns }))));
/** 把一幅行优先的画面左右镜像；测试里手工算预期用，不经过被测模块。 */
const mirrorLeftRight = ({ data, width, height }) => ({ width, height,
  data: Array.from({ length: data.length }, (_, index) => data[Math.floor(index / width) * width + (width - 1 - index % width)]) });
/** 把一幅行优先的画面上下镜像。 */
const mirrorTopBottom = ({ data, width, height }) => ({ width, height,
  data: Array.from({ length: data.length }, (_, index) => data[(height - 1 - Math.floor(index / width)) * width + index % width]) });

describe('展示旋转 90° 的行列换算', () => {
  it('顺时针转一圈：左上角到右上角，宽高互换，源数组不被改写', () => {
    const before = [...SOURCE];
    const shown = transformMatrixView(SOURCE, 3, 2, turned(1));
    expect(shown).toEqual({ width: 2, height: 3, data: [21, 11, 22, 12, 23, 13] });
    expect(SOURCE).toEqual(before);
    expect(shown.data).not.toBe(SOURCE);
  });

  it('两圈是上下左右都反过来，三圈是逆时针一圈，四圈回到原样', () => {
    expect(transformMatrixView(SOURCE, 3, 2, turned(2))).toEqual({ width: 3, height: 2, data: [23, 22, 21, 13, 12, 11] });
    expect(transformMatrixView(SOURCE, 3, 2, turned(3))).toEqual({ width: 2, height: 3, data: [13, 23, 12, 22, 11, 21] });
    expect(transformMatrixView(SOURCE, 3, 2, turned(4))).toEqual({ width: 3, height: 2, data: SOURCE });
    expect(transformMatrixView(SOURCE, 3, 2, turned(0)).data).not.toBe(SOURCE);
    expect(transformMatrixView(SOURCE, 3, 2, undefined)).toEqual({ width: 3, height: 2, data: SOURCE });
  });

  it('连转 k 次等于直接转 k 圈，每个原始格只出现一次', () => {
    for (const [width, height] of [[1, 1], [4, 4], [16, 10], [5, 7], [64, 16]]) {
      const source = Array.from({ length: width * height }, (_, index) => index + 1);
      let step = { data: source, width, height };
      for (let turns = 1; turns <= 4; turns += 1) {
        step = transformMatrixView(step.data, step.width, step.height, turned(1));
        const direct = transformMatrixView(source, width, height, turned(turns));
        expect(step).toEqual(direct);
        expect([...direct.data].sort((a, b) => a - b)).toEqual(source);
      }
      expect(step.data).toEqual(source);
    }
  });

  it('圈数按 4 取模，非法圈数当作没转', () => {
    const width = 5, height = 3, source = Array.from({ length: 15 }, (_, index) => index);
    for (let turns = -5; turns <= 9; turns += 1) {
      expect(transformMatrixView(source, width, height, turned(turns))).toEqual(transformMatrixView(source, width, height, turned(((turns % 4) + 4) % 4)));
    }
    expect([normalizeQuarterTurns(-1), normalizeQuarterTurns(5), normalizeQuarterTurns(8)]).toEqual([3, 1, 0]);
    for (const bad of [1.5, NaN, '1', null, undefined, Infinity]) expect(normalizeQuarterTurns(bad)).toBe(0);
  });

  it('帧比矩阵短的位置补 0，多出的忽略，非数值原样带过去', () => {
    expect(transformMatrixView([1, 2, 3], 2, 2, turned(1))).toEqual({ width: 2, height: 2, data: [3, 1, 0, 2] });
    expect(transformMatrixView([1, 2, 3, 4, 99], 2, 2, turned(2)).data).toEqual([4, 3, 2, 1]);
    expect(transformMatrixView(undefined, 2, 1, turned(1)).data).toEqual([0, 0]);
    expect(transformMatrixView([NaN, 'x'], 2, 1, turned(2)).data).toEqual(['x', NaN]);
    expect(transformMatrixView([1, 2, 3], 2, 2, { flipX: true }).data).toEqual([2, 1, 0, 3]);
  });
});

describe('水平 / 纵向翻转的行列换算', () => {
  it('水平翻转左右对调，纵向翻转上下对调，尺寸不变，源数组不被改写', () => {
    const before = [...SOURCE];
    expect(transformMatrixView(SOURCE, 3, 2, { flipX: true })).toEqual({ width: 3, height: 2, data: [13, 12, 11, 23, 22, 21] });
    expect(transformMatrixView(SOURCE, 3, 2, { flipY: true })).toEqual({ width: 3, height: 2, data: [21, 22, 23, 11, 12, 13] });
    expect(SOURCE).toEqual(before);
  });

  it('两个方向都翻等于转两圈', () => {
    expect(transformMatrixView(SOURCE, 3, 2, { flipX: true, flipY: true })).toEqual(transformMatrixView(SOURCE, 3, 2, turned(2)));
  });

  it('先镜像再旋转：水平翻转后顺时针一圈，原来的右上角到右下角', () => {
    // 翻完是 13 12 11 / 23 22 21，再顺时针一圈：最左一列从下往上成为第一行。
    expect(transformMatrixView(SOURCE, 3, 2, { flipX: true, quarterTurns: 1 })).toEqual({ width: 2, height: 3, data: [23, 13, 22, 12, 21, 11] });
    expect(transformMatrixView(SOURCE, 3, 2, { flipY: true, quarterTurns: 1 })).toEqual({ width: 2, height: 3, data: [11, 21, 12, 22, 13, 23] });
  });

  it('16 种写法都是不重不漏的重排，一共只有 8 幅不同的画面；镜像与旋转分得开', () => {
    const source = Array.from({ length: 15 }, (_, index) => index + 1), pictures = new Map();
    for (const view of ALL_VIEWS) {
      const shown = transformMatrixView(source, 5, 3, view);
      expect([...shown.data].sort((a, b) => a - b)).toEqual(source);
      expect(matrixViewSize(5, 3, view)).toEqual({ width: shown.width, height: shown.height });
      pictures.set(JSON.stringify(shown), view);
    }
    expect(pictures.size).toBe(8);
    const rotations = [0, 1, 2, 3].map((turns) => JSON.stringify(transformMatrixView(source, 5, 3, turned(turns))));
    expect(rotations).not.toContain(JSON.stringify(transformMatrixView(source, 5, 3, { flipX: true })));
    expect(rotations).not.toContain(JSON.stringify(transformMatrixView(source, 5, 3, { flipY: true })));
  });

  it('单格换算、下标对照表与整幅重排三者一致', () => {
    const width = 5, height = 3, source = Array.from({ length: 15 }, (_, index) => index);
    for (const view of ALL_VIEWS) {
      const shown = transformMatrixView(source, width, height, view), map = matrixViewIndexMap(width, height, view);
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
          const cell = matrixViewCell(row, col, width, height, view);
          expect(shown.data[cell.row * shown.width + cell.col]).toBe(row * width + col);
          expect(map[row * width + col]).toBe(cell.row * shown.width + cell.col);
        }
      }
    }
  });

  it('下标对照表按尺寸和方向缓存，淘汰后重建的内容不变', () => {
    const first = matrixViewIndexMap(4, 3, { flipX: true, quarterTurns: 1 });
    expect(matrixViewIndexMap(4, 3, { flipX: true, quarterTurns: 1, flipY: false })).toBe(first);
    expect(matrixViewIndexMap(4, 3, { flipX: true, quarterTurns: 2 })).not.toBe(first);
    const copy = Array.from(first);
    for (let size = 1; size <= 12; size += 1) matrixViewIndexMap(size, size + 1, turned(1));
    expect(Array.from(matrixViewIndexMap(4, 3, { flipX: true, quarterTurns: 1 }))).toEqual(copy);
  });

  it('行列号标的是原始行列：翻过的方向倒着标，转过之后画面的行对应原始的列', () => {
    expect(matrixViewAxisLabels(3, 2, turned(0))).toEqual({ rows: [1, 2], cols: [1, 2, 3] });
    expect(matrixViewAxisLabels(3, 2, turned(1))).toEqual({ rows: [1, 2, 3], cols: [2, 1] });
    expect(matrixViewAxisLabels(3, 2, turned(2))).toEqual({ rows: [2, 1], cols: [3, 2, 1] });
    expect(matrixViewAxisLabels(3, 2, turned(3))).toEqual({ rows: [3, 2, 1], cols: [1, 2] });
    expect(matrixViewAxisLabels(3, 2, { flipX: true })).toEqual({ rows: [1, 2], cols: [3, 2, 1] });
    expect(matrixViewAxisLabels(3, 2, { flipY: true })).toEqual({ rows: [2, 1], cols: [1, 2, 3] });
    expect(matrixViewAxisLabels(3, 2, { flipX: true, quarterTurns: 1 })).toEqual({ rows: [3, 2, 1], cols: [2, 1] });
    // 与整幅重排对拍：画面第 r 行第 c 列的值，按标号能查回原始的行列。
    for (const view of ALL_VIEWS) {
      const shown = transformMatrixView(SOURCE, 3, 2, view), labels = matrixViewAxisLabels(3, 2, view);
      for (let row = 0; row < shown.height; row += 1) {
        for (let col = 0; col < shown.width; col += 1) {
          const [sourceRow, sourceCol] = view.quarterTurns % 2 ? [labels.cols[col], labels.rows[row]] : [labels.rows[row], labels.cols[col]];
          expect(shown.data[row * shown.width + col]).toBe(sourceRow * 10 + sourceCol);
        }
      }
    }
  });

  it('缺字段或类型不对的展示方向当作没翻、没转', () => {
    expect(normalizeMatrixView()).toEqual({ flipX: false, flipY: false, quarterTurns: 0 });
    expect(normalizeMatrixView({ flipX: 'true', flipY: 1, quarterTurns: 1.5 })).toEqual({ flipX: false, flipY: false, quarterTurns: 0 });
    expect(normalizeMatrixView({ flipX: true, quarterTurns: 7 })).toEqual({ flipX: true, flipY: false, quarterTurns: 3 });
    expect([isUprightMatrixView(), isUprightMatrixView({ quarterTurns: 4 }), isUprightMatrixView({ flipY: true }), isUprightMatrixView(turned(1))])
      .toEqual([true, true, false, false]);
  });
});

describe('数字矩阵的展示工具', () => {
  it('每点一次顺时针转 90°，四次回到原位；转过之后不允许按屏幕框选', () => {
    const apply = vi.fn(), tools = createMatrixViewTools(apply);
    expect(tools.getState()).toEqual({ available: true, flipX: false, flipY: false, quarterTurns: 0, selectionSafe: true });
    expect(tools.rotateQuarter()).toBe(true);
    expect(tools.getState()).toMatchObject({ quarterTurns: 1, selectionSafe: false });
    tools.rotateQuarter(); tools.rotateQuarter(); tools.rotateQuarter();
    expect(tools.getState()).toMatchObject({ quarterTurns: 0, selectionSafe: true });
    expect(apply.mock.calls.map(([view]) => view.quarterTurns)).toEqual([1, 2, 3, 0]);
    tools.rotateQuarter(-1); expect(tools.getState().quarterTurns).toBe(3);
    expect(tools.rotateQuarter(0)).toBe(false); expect(tools.rotateQuarter(NaN)).toBe(false);
    expect(tools.getState().quarterTurns).toBe(3);
  });

  it('水平、纵向翻转各自开关，再点一次恢复；翻过之后不允许按屏幕框选', () => {
    const apply = vi.fn(), tools = createMatrixViewTools(apply);
    expect(tools.flip('x')).toBe(true);
    expect(tools.getState()).toEqual({ available: true, flipX: true, flipY: false, quarterTurns: 0, selectionSafe: false });
    expect(tools.flip('y')).toBe(true);
    expect(tools.getState()).toMatchObject({ flipX: true, flipY: true, quarterTurns: 0, selectionSafe: false });
    tools.flip('x'); expect(tools.getState()).toMatchObject({ flipX: false, flipY: true });
    tools.flip('y'); expect(tools.getState()).toEqual({ available: true, flipX: false, flipY: false, quarterTurns: 0, selectionSafe: true });
    expect(apply.mock.calls.map(([view]) => view)).toEqual([{ flipX: true, flipY: false, quarterTurns: 0 }, { flipX: true, flipY: true, quarterTurns: 0 },
      { flipX: false, flipY: true, quarterTurns: 0 }, { flipX: false, flipY: false, quarterTurns: 0 }]);
    for (const bad of ['z', undefined, null, 1]) expect(tools.flip(bad)).toBe(false);
    expect(apply).toHaveBeenCalledTimes(4);
  });

  it('转过之后翻的是当前看到的左右和上下：圈数从 1 记成 3，画面是转过那幅的镜像', () => {
    for (const [width, height] of [[3, 2], [4, 4], [5, 7]]) {
      const source = Array.from({ length: width * height }, (_, index) => index + 1);
      for (let turns = 0; turns < 4; turns += 1) {
        for (const [axis, mirror] of [['x', mirrorLeftRight], ['y', mirrorTopBottom]]) {
          let view = null;
          const tools = createMatrixViewTools((next) => { view = next; });
          for (let turn = 0; turn < turns; turn += 1) tools.rotateQuarter();
          const before = transformMatrixView(source, width, height, turned(turns));
          tools.flip(axis);
          expect(transformMatrixView(source, width, height, view)).toEqual(mirror(before));
          expect(tools.getState().quarterTurns).toBe((4 - turns) % 4);
          // 再翻一次回到只转过的画面。
          tools.flip(axis);
          expect(view).toEqual({ flipX: false, flipY: false, quarterTurns: turns });
        }
      }
    }
    const tools = createMatrixViewTools(() => {});
    tools.rotateQuarter(); tools.flip('x');
    expect(tools.getState()).toMatchObject({ flipX: true, flipY: false, quarterTurns: 3 });
  });

  it('没有镜头类动作：旋转 30°、俯视和缩放都不存在', () => {
    const tools = createMatrixViewTools(() => {});
    for (const name of ['rotate', 'top', 'zoom']) expect(tools[name]).toBeUndefined();
  });

  it('场景重建时带着原有方向建，不重复回调后端；交给后端的对象改了也不影响工具', () => {
    const apply = vi.fn(), tools = createMatrixViewTools(apply, { flipX: true, quarterTurns: 3 });
    expect(tools.getState()).toMatchObject({ flipX: true, flipY: false, quarterTurns: 3 }); expect(apply).not.toHaveBeenCalled();
    expect(createMatrixViewTools(apply, { quarterTurns: 7.5 }).getState().quarterTurns).toBe(0);
    tools.rotateQuarter();
    apply.mock.calls[0][0].quarterTurns = 2; apply.mock.calls[0][0].flipX = false;
    expect(tools.getState()).toMatchObject({ flipX: true, quarterTurns: 0 });
  });

  it('展示方向随快照保存恢复，订阅方拿到变化；恢复视角回到与数据同向', () => {
    const apply = vi.fn(), tools = createMatrixViewTools(apply), received = [];
    const off = tools.subscribe((snapshot) => received.push(snapshot));
    tools.rotateQuarter(); tools.flip('y');
    const saved = tools.getSnapshot();
    expect(saved).toEqual({ schemaVersion: 1, kind: 'matrix', flipX: false, flipY: true, quarterTurns: 3 });
    expect(received).toEqual([{ schemaVersion: 1, kind: 'matrix', flipX: false, flipY: false, quarterTurns: 1 }, saved]);
    const next = createMatrixViewTools(apply);
    apply.mockClear();
    expect(next.restoreSnapshot(JSON.parse(JSON.stringify(saved)))).toBe(true);
    expect(next.getState()).toMatchObject({ flipX: false, flipY: true, quarterTurns: 3 });
    expect(apply.mock.calls).toEqual([[{ flipX: false, flipY: true, quarterTurns: 3 }]]);
    // 恢复同一份不重复回调后端。
    expect(next.restoreSnapshot(saved)).toBe(true); expect(apply).toHaveBeenCalledTimes(1);
    expect(next.reset()).toBe(true);
    expect(next.getState()).toEqual({ available: true, flipX: false, flipY: false, quarterTurns: 0, selectionSafe: true });
    expect(next.reset()).toBe(true); expect(apply).toHaveBeenCalledTimes(2);
    off(); tools.rotateQuarter(); expect(received).toHaveLength(2);
    // 订阅方抛错不影响操作。
    next.subscribe(() => { throw new Error('storage full'); });
    expect(next.flip('x')).toBe(true); expect(next.getState().flipX).toBe(true);
  });

  it('只存了圈数的旧快照按没翻恢复', () => {
    const tools = createMatrixViewTools(() => {});
    tools.flip('x');
    expect(tools.restoreSnapshot({ schemaVersion: 1, kind: 'matrix', quarterTurns: 2 })).toBe(true);
    expect(tools.getState()).toMatchObject({ flipX: false, flipY: false, quarterTurns: 2 });
  });

  it('不是数字矩阵的快照整体拒绝，画面保持不变', () => {
    const apply = vi.fn(), tools = createMatrixViewTools(apply);
    tools.rotateQuarter(); apply.mockClear();
    const sceneSnapshot = { schemaVersion: 1, flipX: false, flipY: false, quarterTurns: 2, object: {}, camera: {} };
    for (const bad of [null, sceneSnapshot, { schemaVersion: 2, kind: 'matrix', quarterTurns: 1 },
      { schemaVersion: 1, kind: 'matrix', quarterTurns: 4 }, { schemaVersion: 1, kind: 'matrix', quarterTurns: 1.5 },
      { schemaVersion: 1, kind: 'matrix', quarterTurns: '1' }, { schemaVersion: 1, kind: 'matrix', quarterTurns: 1, flipX: 'yes' },
      { schemaVersion: 1, kind: 'matrix', quarterTurns: 1, flipY: 1 }, { schemaVersion: 1, kind: 'matrix', flipX: true }]) {
      expect(validateMatrixViewSnapshot(bad)).toBe(false);
      expect(tools.restoreSnapshot(bad)).toBe(false);
    }
    expect(tools.getState()).toMatchObject({ flipX: false, flipY: false, quarterTurns: 1 }); expect(apply).not.toHaveBeenCalled();
  });

  it('卸载后拒绝迟到的操作，也不再通知', () => {
    const apply = vi.fn(), tools = createMatrixViewTools(apply), listener = vi.fn();
    tools.subscribe(listener); tools.dispose();
    expect(tools.getState().available).toBe(false); expect(tools.getSnapshot()).toBe(null);
    expect(tools.rotateQuarter()).toBe(false); expect(tools.flip('x')).toBe(false); expect(tools.reset()).toBe(false);
    expect(tools.restoreSnapshot({ schemaVersion: 1, kind: 'matrix', quarterTurns: 1 })).toBe(false);
    expect(apply).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
  });
});
