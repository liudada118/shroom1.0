import { describe, expect, it } from 'vitest';
import { clampRulerPoint, createRulerState, moveScreenRuler, screenRulerDistance, screenRulerReducer } from './portalRulerState';

/** 以两次落点建立一条量尺，使用和指针/键盘相同的 reducer。 */
function addLine(state, start = { x: 10, y: 20 }, end = { x: 110, y: 20 }) {
  return screenRulerReducer(screenRulerReducer(state, { type: 'place', point: start }), { type: 'place', point: end });
}

describe('传感点多量尺交互', () => {
  it('两点测量保存行列坐标，新增量尺保留前一条，编号不因删除串位', () => {
    let state = addLine(addLine(createRulerState()));
    expect(state.lines).toHaveLength(2);
    expect(screenRulerDistance(state.lines[0].start, state.lines[0].end)).toBe(100);
    state = screenRulerReducer(state, { type: 'remove', id: 1 });
    state = addLine(state);
    expect(state.lines.map((line) => line.id)).toEqual([2, 3]);
  });
  it('拖动整线贴边只限制位移，长度与方向不改变；端点可独立调整', () => {
    const line = { id: 1, start: { x: 20, y: 30 }, end: { x: 80, y: 70 } }, bounds = { width: 100, height: 100 };
    const shifted = moveScreenRuler(line, 'line', { x: 500, y: -500 }, bounds);
    expect(shifted).toEqual({ id: 1, start: { x: 40, y: 0 }, end: { x: 100, y: 40 } });
    expect(screenRulerDistance(shifted.start, shifted.end)).toBe(screenRulerDistance(line.start, line.end));
    const resized = moveScreenRuler(line, 'end', { x: -70, y: 20 }, bounds);
    expect(resized).toEqual({ id: 1, start: line.start, end: { x: 10, y: 90 } });
    expect(line.end).toEqual({ x: 80, y: 70 });
  });
  it('第九条明确提示且不覆盖已有测量；删除一条后能继续添加', () => {
    let state = createRulerState();
    for (let i = 0; i < 8; i++) state = addLine(state);
    state = addLine(state);
    expect(state.lines).toHaveLength(8); expect(state.start).toBe(null); expect(state.error).toContain('8 条');
    state = addLine(screenRulerReducer(state, { type: 'remove', id: 4 }));
    expect(state.lines).toHaveLength(8); expect(state.error).toBe(''); expect(state.lines.at(-1).id).toBe(9);
  });
  it('单点与预览不占用条数，取消绘制不删旧线，零长和非有限距离不保存', () => {
    let state = addLine(createRulerState());
    state = screenRulerReducer(state, { type: 'place', point: { x: 5, y: 5 } });
    expect(state.lines).toHaveLength(1);
    for (const point of [{ x: 5, y: 5 }, { x: NaN, y: 5 }]) {
      state = screenRulerReducer(state, { type: 'place', point });
      expect(state.lines).toHaveLength(1);
    }
    state = screenRulerReducer(state, { type: 'cancel' });
    expect(state.start).toBe(null); expect(state.lines).toHaveLength(1);
  });
  it('拖拽取消恢复手势前状态，更换矩阵时清空旧测量并把准星落到整数点', () => {
    const before = addLine(createRulerState());
    const moved = screenRulerReducer(before, { type: 'move', line: before.lines[0], part: 'end', delta: { x: 10, y: 0 }, bounds: { width: 800, height: 600 } });
    expect(screenRulerDistance(moved.lines[0].start, moved.lines[0].end)).toBe(110);
    expect(screenRulerReducer(moved, { type: 'restore', state: before })).toBe(before);
    expect(screenRulerReducer(moved, { type: 'reset', width: 375, height: 812 })).toMatchObject({ lines: [], start: null, selectedId: null, cursor: { x: 187, y: 406 } });
  });
  it('清空和删除最后一条后禁用删除；键盘准星保持在视口内', () => {
    const state = addLine(createRulerState());
    expect(screenRulerReducer(state, { type: 'remove', id: 1 }).selectedId).toBe(null);
    expect(screenRulerReducer(state, { type: 'clear' })).toMatchObject({ lines: [], start: null, selectedId: null });
    expect(clampRulerPoint({ x: -10, y: 900 }, { width: 375, height: 812 })).toEqual({ x: 0, y: 812 });
  });
  it('拒绝非传感点落点，拖动整线和端点都以整格为步长', () => {
    const state = addLine(createRulerState());
    const rejected = screenRulerReducer(state, { type: 'place', point: { x: 3.4, y: 2 } });
    expect(rejected.start).toBe(null); expect(rejected.error).toContain('传感点中心');
    const bounds = { width: 200, height: 200 };
    expect(moveScreenRuler(state.lines[0], 'line', { x: .3, y: -.3 }, bounds)).toEqual(state.lines[0]);
    expect(moveScreenRuler(state.lines[0], 'end', { x: .8, y: .2 }, bounds).end).toEqual({ x: 111, y: 20 });
  });
});
