import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({ refs: [], effects: [], cleanups: [], animation: null }));

vi.mock('react', () => {
  return { default: { forwardRef: (render) => render, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    useRef: (value) => { const ref = { current: value }; hooks.refs.push(ref); return ref; },
    useMemo: (create) => create(), useCallback: (callback) => callback,
    useEffect: (callback) => { hooks.effects.push(callback); },
    useImperativeHandle: (ref, create) => { ref.current = create(); },
    useState: (value) => [value, vi.fn()],
  };
});
vi.mock('../blobHeatmap/core/intensity.js', () => ({ createIntensity: () => ({ getImageData: () => new Uint8ClampedArray(1024) }), colorize: vi.fn() }));
vi.mock('../blobHeatmap/core/pipeline.js', async (original) => {
  const actual = await original();
  return { ...actual, buildBlobPoints: vi.fn(actual.buildBlobPoints), groupByAlpha: vi.fn(actual.groupByAlpha) };
});
vi.mock('../webglHeatmap/core/pipeline.js', async (original) => {
  const actual = await original();
  return { ...actual, buildHeatPoints: vi.fn(actual.buildHeatPoints) };
});
vi.mock('../webglHeatmap/react/blobs.js', () => ({ WebGLCanvas: class { render() { return [{}]; } } }));

import BlobHeatmapRenderer from '../blobHeatmap/react/BlobHeatmapRenderer.jsx';
import WebglHeatmapRenderer from '../webglHeatmap/react/WebglHeatmapRenderer.jsx';
import { buildBlobPoints, groupByAlpha } from '../blobHeatmap/core/pipeline.js';
import { buildHeatPoints } from '../webglHeatmap/core/pipeline.js';

/** 提供真实帧管线所需的 Canvas 接口，不依赖 GPU 或浏览器布局。 */
function canvas() {
  const context = { clearRect: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), putImageData: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(16) }) };
  return { width: 32, height: 32, getContext: () => context };
}

/** 建立命令式渲染器实例，挂画布后执行 React 效果。 */
function mount(Renderer, params) {
  const data = { changeData: vi.fn(), handleCharts: vi.fn(), handleChartsArea: vi.fn() };
  const ref = {};
  Renderer({ params, data: { current: data }, local: true }, ref);
  hooks.refs[0].current = canvas();
  for (const effect of hooks.effects) {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  }
  return { api: ref.current, data };
}

/** WebGL 只消费当前待绘制的帧，不启动常驻测试循环。 */
function flush() { const callback = hooks.animation; hooks.animation = null; callback?.(); }

beforeEach(() => {
  vi.clearAllMocks(); hooks.refs = []; hooks.effects = []; hooks.cleanups = []; hooks.animation = null;
  vi.stubGlobal('window', { innerHeight: 100 });
  vi.stubGlobal('document', { createElement: () => canvas() });
  vi.stubGlobal('requestAnimationFrame', (callback) => { hooks.animation = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { hooks.cleanups.forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('matrix renderer workspace tuning', () => {
  for (const [name, Renderer, extra, spy] of [
    ['blob', BlobHeatmapRenderer, { transposeAxes: true }, buildBlobPoints],
    ['webgl', WebglHeatmapRenderer, { workspaceTuning: true }, buildHeatPoints],
  ]) {
    it(`${name} redraws the cached frame for each setting and leaves raw statistics unchanged`, () => {
      const { api, data } = mount(Renderer, { dataWidth: 2, dataHeight: 2, minFrameLength: 4, edgeClear: null, mirrorX: false, valueScale: 1, ...extra });
      const raw = Object.freeze([5, 50, 100, 0]);
      api.sitData({ wsPointData: raw }); flush();
      expect(spy.mock.calls.at(-1)[0]).toEqual(raw);
      const baselineStats = data.changeData.mock.calls[0][0];
      expect(baselineStats.totalPres).toBe(155);
      api.sitValue({ valuef: 60 }); flush();
      expect(spy.mock.calls.at(-1)[0]).toEqual([0, 0, 100, 0]);
      api.sitValue({ valuef: 0, valuelInit: 156 }); flush();
      expect(spy.mock.calls.at(-1)[0]).toEqual([0, 0, 0, 0]);
      api.sitValue({ valuelInit: 0 }); flush();
      expect(spy.mock.calls.at(-1)[0]).toEqual(raw);
      api.sitValue({ valueg: 1 }); flush();
      expect(spy.mock.calls.at(-1)[0][2]).toBeLessThan(100);
      expect(spy.mock.calls.at(-1)[0][3]).toBeGreaterThan(0);
      api.sitValue({ valueg: 0, valuej: 80 }); flush();
      expect(spy.mock.calls.at(-1)[0]).toEqual(raw);
      if (name === 'blob') expect(groupByAlpha.mock.calls.at(-1)[1]).toBe(80);
      expect(data.changeData).toHaveBeenCalledOnce();
      expect(data.changeData.mock.calls[0][0]).toEqual(baselineStats);
      expect(raw).toEqual([5, 50, 100, 0]);
      expect(api.getTuningControls()).toEqual({ showColor: true, showGuass: true, showConsis: true, showFilter: true, showInit: true });
      api.sitValue({ valuel: 4 }); api.sitData({ wsPointData: [0, 0, 0, 0] }); flush();
      expect(spy.mock.calls.at(-1)[0][2]).toBeGreaterThan(0);
      expect(spy.mock.calls.at(-1)[0][2]).toBeLessThan(100);
      api.sitValue({ valuel: 0 }); flush();
      expect(spy.mock.calls.at(-1)[0]).toEqual([0, 0, 0, 0]);
    });
  }

  it('legacy blob keeps the four inert controls and paints its unprocessed input', () => {
    const { api } = mount(BlobHeatmapRenderer, { dataWidth: 2, dataHeight: 2 });
    api.sitValue({ valueg: 8, valuel: 100, valuef: 65535, valuelInit: 1e9 });
    api.sitData({ wsPointData: [1, 2, 3, 4] });
    expect(buildBlobPoints.mock.calls.at(-1)[0]).toEqual([1, 2, 3, 4]);
    expect(api.getTuningControls()).toEqual({ showColor: true, showGuass: false, showConsis: false, showFilter: false, showInit: false });
  });

  it('legacy webgl keeps its existing floor pipeline without enabling new smoothing or gates', () => {
    const { api } = mount(WebglHeatmapRenderer, { dataWidth: 2, dataHeight: 2, minFrameLength: 4, edgeClear: null, mirrorX: false });
    api.sitValue({ valueg: 8, valuel: 100, valuef: 3, valuelInit: 1e9 });
    api.sitData({ wsPointData: [1, 2, 3, 4] }); flush();
    expect(buildHeatPoints.mock.calls.at(-1)[0]).toEqual([0, 0, 3, 4]);
    expect(api.getTuningControls()).toEqual({ showColor: true, showGuass: false, showConsis: false, showFilter: true, showInit: false });
  });
});
