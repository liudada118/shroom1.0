import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TranslatedAside from './Aside';

const Aside = TranslatedAside.render({}, null).type.WrappedComponent;

/** 使用实际 Aside 方法，隔离浏览器画布和 React 挂载。 */
function createAside() {
  const aside = new Aside();
  aside.props = { matrixName: 'hand0205' };
  aside._playbackCursors = {
    pressure: { style: {} }, area: { style: {} },
  };
  aside.drawChart = vi.fn();
  return aside;
}

describe('回放整段曲线与当前帧线', () => {
  beforeEach(() => {
    const context = { clearRect: vi.fn() };
    vi.stubGlobal('document', { getElementById: () => ({ width: 300, height: 150, getContext: () => context }) });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('载入时就显示完整记录；后续压力帧、面积帧、公式回调都不重画曲线', () => {
    const aside = createAside();
    const pressArr = [10, 50, 20, 90];
    const areaArr = [1, 4, 2, 7];
    aside.setPlaybackCharts({ pressArr, areaArr, length: 4 });
    expect(aside.drawChart).toHaveBeenCalledTimes(2);
    expect(aside.drawChart.mock.calls.map(([input]) => input.arr)).toEqual([pressArr, areaArr]);
    aside.handleCharts([999], 1000);
    aside.handleChartsArea([123], 200);
    aside.handleBuiltinFormulaSeries({ pressure: { values: [77] }, area: { values: [8] } });
    aside.setPlaybackChartIndex(2);
    expect(aside.drawChart).toHaveBeenCalledTimes(2);
    expect(aside._playbackCursors.pressure.style.left).toBe('60%');
    expect(aside._playbackCursors.area.style.left).toBe('60%');
  });

  it('长记录按总帧数映射抽样曲线，可回退、到末尾和钳制越界', () => {
    const aside = createAside();
    aside.setPlaybackCharts({ pressArr: [0, 50, 10, 70], areaArr: [1, 2, 3, 4], length: 50001 });
    for (const [index, position] of [[25000, '50%'], [50000, '80%'], [0, '20%'], [-5, '20%'], [99999, '80%']]) {
      aside.setPlaybackChartIndex(index);
      expect(aside._playbackCursors.pressure.style.left).toBe(position);
    }
    expect(aside.drawChart).toHaveBeenCalledTimes(2);
  });

  it('更换记录重置曲线和帧线，单帧有效，空记录不保留旧线', () => {
    const aside = createAside();
    aside.setPlaybackCharts({ pressArr: [1, 2], areaArr: [3, 4], length: 2, index: 1 });
    aside.setPlaybackCharts({ pressArr: [7], areaArr: [8], length: 1 });
    expect(aside._playbackCursors.pressure.style.left).toBe('50%');
    expect(aside._playbackCursors.pressure.hidden).toBe(false);
    aside.setPlaybackCharts({ length: 0 });
    expect(aside._playbackCursors.pressure.hidden).toBe(true);
    expect(aside._playbackCursors.area.hidden).toBe(true);
  });

  it('外观刷新仍使用完整记录；退出回放后恢复实时公式绘图', () => {
    const aside = createAside();
    aside.setPlaybackCharts({ pressArr: [1, 5, 2], areaArr: [2, 6, 3], length: 3 });
    aside.handleBuiltinFormulaSeries({ pressure: { values: [77] } });
    aside.drawFormulaAwareChart('pressure', { arr: [999] }, true);
    expect(aside.drawChart).toHaveBeenLastCalledWith(expect.objectContaining({ arr: [1, 5, 2] }));
    aside.clearPlaybackCharts();
    expect(aside._playbackCursors.pressure.hidden).toBe(true);
    aside.handleBuiltinFormulaSeries({ pressure: { values: [10, 20] } });
    expect(aside.drawChart).toHaveBeenLastCalledWith(expect.objectContaining({ arr: [10, 20] }));
  });
});
