import { describe, expect, it, vi } from 'vitest';
import { createManifestRendererTools } from './manifestRendererTools.js';

/** 构造实际能力最小句柄，便于检查转发目标与迟到卸载。 */
function renderer() {
  return { sitValue: vi.fn(), backValue: vi.fn(), changeColor: vi.fn() };
}

describe('manifest renderer tool bridge', () => {
  it('加载期间不声明能力，异步挂载后重放合并的最后调参且保留零值', () => {
    const bridge = createManifestRendererTools();
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    bridge.sitValue({ valuej: 90, valuef: 4 });
    bridge.sitValue({ valuef: 0, valuel: 2 });
    bridge.changeColor({ max: 90 });
    expect(bridge.getTuningControls().showColor).toBe(false);
    expect(bridge.getSelectionTools()).toBeNull();
    expect(bridge.getViewTools()).toBeNull();

    const mounted = renderer();
    bridge.rendererRef('main', 'pointGrid')(mounted);
    expect(mounted.sitValue.mock.calls).toEqual([[{ valuej: 90, valuef: 0, valuel: 2 }]]);
    expect(mounted.changeColor.mock.calls).toEqual([[{ max: 90 }]]);
    expect(bridge.getTuningControls()).toEqual({ showGuass: true, showColor: true, showFilter: true,
      showHeight: true, showConsis: true, showInit: true, showSize: false, showSpeed: false });
  });

  it('调参仅转发当前可见矩阵，隐藏和非矩阵组件不接收', () => {
    const bridge = createManifestRendererTools();
    const left = renderer(), right = renderer(), chart = renderer();
    bridge.setWidgets([{ id: 'left', type: 'pointGrid' }, { id: 'right', type: 'pointGrid' }, { id: 'stats', type: 'stats' }]);
    bridge.rendererRef('left', 'pointGrid')(left);
    bridge.rendererRef('right', 'pointGrid')(right);
    bridge.rendererRef('stats', 'stats')(chart);
    bridge.sitValue({ valuej: 100 });
    expect(left.sitValue.mock.calls).toEqual([[{ valuej: 100 }]]);
    expect(right.sitValue.mock.calls).toEqual([[{ valuej: 100 }]]);
    expect(chart.sitValue).not.toHaveBeenCalled();

    bridge.setWidgets([{ id: 'right', type: 'pointGrid' }]);
    bridge.rendererRef('right', 'pointGrid')(right);
    bridge.sitValue({ valuej: 200 });
    expect(left.sitValue).toHaveBeenCalledTimes(1);
    expect(right.sitValue).toHaveBeenLastCalledWith({ valuej: 200 });
  });

  it('视图切换立即撤销旧能力，迟到旧回调不能替换或清除新实例', () => {
    const bridge = createManifestRendererTools();
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    const oldRef = bridge.rendererRef('main', 'pointGrid');
    const previous = { ...renderer(), getViewTools: () => ({ previous: true }) };
    oldRef(previous);
    bridge.sitValue({ valuef: 0 });
    bridge.setWidgets([{ id: 'main', type: 'blobHeatmap' }]);
    expect(bridge.getViewTools()).toBeNull();
    expect(bridge.getTuningControls().showColor).toBe(false);
    oldRef(previous);
    expect(bridge.getViewTools()).toBeNull();

    const current = renderer();
    bridge.rendererRef('main', 'blobHeatmap')(current);
    oldRef(null);
    bridge.sitValue({ valuej: 50 });
    expect(current.sitValue.mock.calls).toEqual([[{ valuef: 0 }], [{ valuej: 50 }]]);
    expect(previous.sitValue).toHaveBeenCalledTimes(1);
    expect(bridge.getTuningControls().showHeight).toBe(false);
    expect(bridge.getTuningControls().showColor).toBe(true);
  });

  it('主画布优先 main，视角和选区接口不广播到其它传感器', () => {
    const bridge = createManifestRendererTools();
    const side = { ...renderer(), changeSelectFlag: vi.fn() };
    const selection = { getSensorPoints: vi.fn() }, view = { getState: vi.fn() };
    const main = { ...renderer(), getSelectionTools: () => selection, getViewTools: () => view, changeSelectFlag: vi.fn() };
    bridge.setWidgets([{ id: 'side', type: 'pointGrid' }, { id: 'main', type: 'pointGrid' }]);
    bridge.rendererRef('side', 'pointGrid')(side);
    bridge.rendererRef('main', 'pointGrid')(main);

    expect(bridge.getViewTools()).toBe(view);
    expect(bridge.getSelectionTools()).toBe(selection);
    bridge.changeSelectFlag(false, true);
    expect(main.changeSelectFlag.mock.calls).toEqual([[false, true]]);
    expect(side.changeSelectFlag).not.toHaveBeenCalled();
    bridge.rendererRef('main', 'pointGrid')(null);
    expect(bridge.getSelectionTools()).toBeNull();
    expect(bridge.getViewTools()).toBeNull();
  });

  it.each(['numMatrix', 'webglHeatmap', 'blobHeatmap'])('%s 按实际矩阵模式提供调节项，不伪造视角或框选', (type) => {
    const bridge = createManifestRendererTools();
    bridge.setWidgets([{ id: 'main', type }]);
    bridge.rendererRef('main', type)(renderer());
    const controls = bridge.getTuningControls();
    expect(controls).toMatchObject({ showColor: true, showFilter: true, showHeight: false, showSize: false, showSpeed: false });
    expect(controls.showGuass).toBe(type !== 'numMatrix');
    expect(controls.showConsis).toBe(type !== 'numMatrix');
    expect(controls.showInit).toBe(type !== 'numMatrix');
    expect(bridge.getViewTools()).toBeNull();
    expect(bridge.getSelectionTools()).toBeNull();
    expect(bridge.changeSelectFlag(false)).toBeUndefined();
  });

  it('空布局和系统切换后没有旧句柄、调参或能力泄漏', () => {
    const bridge = createManifestRendererTools();
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    const previous = renderer();
    bridge.rendererRef('main', 'pointGrid')(previous);
    bridge.sitValue({ valuej: 100 });
    bridge.setWidgets([]);
    bridge.sitValue({ valuej: 200 });
    expect(previous.sitValue).toHaveBeenCalledTimes(1);
    expect(bridge.getTuningControls().showColor).toBe(false);
    const nextSystem = createManifestRendererTools();
    nextSystem.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    const current = renderer();
    nextSystem.rendererRef('main', 'pointGrid')(current);
    expect(current.sitValue).not.toHaveBeenCalled();
  });

  it('切回同一种模式时，旧周期迟到的挂载和卸载都不能覆盖新句柄', () => {
    const bridge = createManifestRendererTools();
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    const oldRef = bridge.rendererRef('main', 'pointGrid');
    oldRef(renderer());
    bridge.setWidgets([{ id: 'main', type: 'numMatrix' }]);
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    const current = renderer();
    const currentRef = bridge.rendererRef('main', 'pointGrid');
    currentRef(current);
    oldRef(renderer());
    oldRef(null);
    bridge.sitValue({ valuej: 300 });
    expect(current.sitValue.mock.calls).toEqual([[{ valuej: 300 }]]);
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    expect(bridge.rendererRef('main', 'pointGrid')).toBe(currentRef);
    expect(bridge.getTuningControls().showHeight).toBe(true);
  });

  it('原始数字模式隐藏过滤，切换间隙的旧高度或过滤滑块不能写入新画布', () => {
    const bridge = createManifestRendererTools();
    bridge.setWidgets([{ id: 'main', type: 'pointGrid' }]);
    bridge.sitValue({ valuef: 8, value: 3, valuej: 90 });
    bridge.changeColor({ filter: 8, max: 90 });
    bridge.setWidgets([{ id: 'main', type: 'numMatrix', rendererParams: { frameInput: 'raw' } }]);
    const current = renderer();
    bridge.rendererRef('main', 'numMatrix')(current);
    expect(bridge.getTuningControls()).toMatchObject({ showColor: true, showFilter: false, showHeight: false });
    expect(current.sitValue.mock.calls).toEqual([[{ valuej: 90 }]]);
    expect(current.changeColor.mock.calls).toEqual([[{ max: 90 }]]);
    bridge.sitValue({ value: 12, valuef: 0 });
    bridge.changeColor({ filter: 0 });
    expect(current.sitValue).toHaveBeenCalledTimes(1);
    expect(current.changeColor).toHaveBeenCalledTimes(1);
    bridge.sitValue({ valuej: 40 });
    expect(current.sitValue).toHaveBeenLastCalledWith({ valuej: 40 });
  });
});
