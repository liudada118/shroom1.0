import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveGrid, LEGACY_PRESETS, normalizeNumMatrixParams } from '../../core/params.js';
import { createWebglMatrixBackend } from './webgl.js';
import { deleteGlResources } from '../../../shared/webgl/glUtil.js';

vi.mock('../../../shared/webgl/glUtil.js', () => ({
  prewarmShaders: vi.fn(),
  buildProgram: () => ({ program: {}, vs: {}, fs: {} }),
  bindAttribBuffer: () => ({}),
  createLuminanceTexture: (_gl, _unit, width, height) => ({ texture: {}, data: new Uint8Array(width * height) }),
  deleteGlResources: vi.fn(),
  uploadLuminance: (gl, _unit, _texture, data, width, height) => gl.uploads.push({ data: [...data], width, height }),
}));

/** 替换 DOM/GPU 边界并记录实际纹理上传，业务路由使用真实后端。 */
function createHarness(preset, overrides = {}) {
  const canvases = [], listeners = new Map(), animation = new Map();
  let nextFrame = 0;
  /** 构造后端需要的节点，每块画布拥有独立的 WebGL/叠加层记录。 */
  function element(tag) {
    const events = new Map(), captures = new Set();
    const node = { tag, children: [], style: {}, appendChild(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; }, events,
      addEventListener(type, callback) { events.set(type, callback); },
      removeEventListener(type, callback) { if (events.get(type) === callback) events.delete(type); },
      getBoundingClientRect: () => ({ left: 100, top: 50 }),
      setPointerCapture(id) { captures.add(id); }, hasPointerCapture: (id) => captures.has(id),
      releasePointerCapture(id) { captures.delete(id); } };
    if (tag !== 'canvas') return node;
    const gl = { canvas: node, uploads: [], TRIANGLES: 4,
      useProgram: vi.fn(), getUniformLocation: (_program, name) => name,
      uniform1f: vi.fn(), uniform1i: vi.fn(), uniform2f: vi.fn(), viewport: vi.fn(), drawArrays: vi.fn() };
    const overlay = { canvas: node, clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fillText: vi.fn(), fillRect: vi.fn(), setTransform: vi.fn() };
    node.gl = gl;
    node.overlay = overlay;
    node.getBoundingClientRect = () => ({ left: 100 + (parseFloat(node.style.marginLeft) || 0), top: 50,
      right: 100 + (parseFloat(node.style.marginLeft) || 0) + node.width, bottom: 50 + node.height,
      width: node.width, height: node.height });
    node.getContext = (type) => type === 'webgl' ? gl : overlay;
    canvases.push(node);
    return node;
  }
  vi.stubGlobal('document', { createElement: element });
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 1080);
  vi.stubGlobal('requestAnimationFrame', (callback) => { animation.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id) => animation.delete(id));
  vi.stubGlobal('addEventListener', (type, callback) => listeners.set(type, callback));
  vi.stubGlobal('removeEventListener', (type, callback) => { if (listeners.get(type) === callback) listeners.delete(type); });
  const raw = LEGACY_PRESETS[preset];
  const { matrix = {}, ...webgl } = overrides;
  const config = normalizeNumMatrixParams({ ...raw, ...matrix, webgl: { ...raw.webgl, ...webgl } });
  const reportStats = vi.fn(), tuning = { valuej1: 80, valuef1: 100, valuelInit1: 0 };
  const container = element('main');
  const backend = createWebglMatrixBackend({ container, config, grid: deriveGrid(config), tuning, reportStats });
  backend.start();
  /** 执行合并后的绘制队列，模拟一次显示刷新。 */
  function flush() {
    for (const [id, callback] of [...animation]) { animation.delete(id); callback(); }
  }
  flush();
  return { backend, config, tuning, reportStats, container, listeners, animation, flush,
    left: canvases[0], leftOverlay: canvases[1], right: canvases[2] };
}

/** 读取 POT 纹理有效行，排除 GPU 对齐产生的空白。 */
function frame(canvas, width, height) {
  const uploaded = canvas.gl.uploads.at(-1);
  return Array.from({ length: height }, (_, y) => uploaded.data.slice(y * uploaded.width, y * uploaded.width + width)).flat();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('原始数字矩阵鼠标查看', () => {
  it('以光标为中心缩放且限制范围，不重复上传纹理或改变原始统计', () => {
    const h = createHarness('webglRawDefault');
    const input = Array.from({ length: 1024 }, (_, i) => i);
    h.backend.setRawFrame(input);
    h.flush();
    const row = h.container.children[0].children[0];
    const uploads = h.left.gl.uploads.length, statsCalls = h.reportStats.mock.calls.length;
    const event = { deltaY: -120, clientX: 300, clientY: 200, preventDefault: vi.fn() };
    row.events.get('wheel')(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(row.style.transform).toMatch(/scale\(1\.1\)/);
    const offsets = row.style.transform.match(/translate\(([^p]+)px, ([^p]+)px\)/);
    expect(Number(offsets[1])).toBeCloseTo(-20);
    expect(Number(offsets[2])).toBeCloseTo(-15);
    for (let i = 0; i < 100; i++) row.events.get('wheel')(event);
    expect(row.style.transform).toContain('scale(8)');
    for (let i = 0; i < 100; i++) row.events.get('wheel')({ ...event, deltaY: 120 });
    expect(row.style.transform).toContain('scale(0.5)');
    expect(h.left.gl.uploads).toHaveLength(uploads);
    expect(h.reportStats).toHaveBeenCalledTimes(statsCalls);
    expect(h.reportStats.mock.lastCall[0]).toEqual(input);
    h.backend.dispose();
  });

  it('拖动查看与框选、量尺互斥，卸载回收监听和正在捕获的指针', () => {
    const h = createHarness('webglRawDefault');
    const row = h.container.children[0].children[0];
    const start = { button: 0, pointerId: 7, clientX: 300, clientY: 200 };
    row.events.get('pointerdown')(start);
    row.events.get('pointermove')({ ...start, clientX: 340, clientY: 220 });
    expect(row.style.transform).toBe('translate(40px, 20px) scale(1)');
    expect(row.hasPointerCapture(7)).toBe(true);
    h.backend.sensorGrid.onInteractionChange(true);
    expect(row.hasPointerCapture(7)).toBe(false);
    row.events.get('pointerdown')(start);
    row.events.get('pointermove')({ ...start, clientX: 400 });
    row.events.get('wheel')({ ...start, deltaY: -120, preventDefault: vi.fn() });
    expect(row.style.transform).toBe('translate(40px, 20px) scale(1)');
    h.backend.sensorGrid.onInteractionChange(false);
    row.events.get('pointerdown')(start);
    const staleWheel = row.events.get('wheel');
    h.backend.dispose();
    expect(row.events.size).toBe(0);
    expect(row.hasPointerCapture(7)).toBe(false);
    staleWheel({ ...start, deltaY: -120, preventDefault: vi.fn() });
    expect(row.style.transform).toBe('translate(40px, 20px) scale(1)');
  });

  it('显式停用相机控制时不接管鼠标事件', () => {
    const h = createHarness('webglRawDefault', { matrix: { cameraControls: false } });
    expect(h.container.children[0].children[0].events.size).toBe(0);
    h.backend.dispose();
  });
});

describe('双手数字矩阵', () => {
  it('手套默认双零矩阵及0.75宽度，普通矩阵与显式设置保持原值', () => {
    for (const name of ['webglRawGlove', 'webglRawGloveFullPacket', 'webglNumGlove']) {
      const h = createHarness(name), { gridWidth: w, gridHeight: height } = deriveGrid(h.config);
      expect(h.config.webgl.widthRatio).toBe(0.75);
      expect(h.container.children[0].children[0].children).toHaveLength(2);
      expect(frame(h.left, w, height)).toEqual(new Array(w * height).fill(0));
      expect(frame(h.right, w, height)).toEqual(new Array(w * height).fill(0));
      expect(h.backend.sensorGrid).toBeNull();
      h.backend.dispose();
    }
    expect(normalizeNumMatrixParams(LEGACY_PRESETS.webglRawDefault).webgl.widthRatio).toBe(0.4);
    const h = createHarness('webglNumGlove', { widthRatio: 0.6, glovePrimeOnMount: false });
    expect(h.config.webgl).toMatchObject({ widthRatio: 0.6, glovePrimeOnMount: false });
    h.backend.dispose();
  });

  it('147点按15列补位，right命令和别名不覆盖左手，侧栏合并最后帧', () => {
    const h = createHarness('webglRawGlove');
    const left = Array.from({ length: 147 }, (_, i) => i + 1), right = new Array(147).fill(7);
    const expectedLeft = [...left.slice(0, 75), 0, 0, 0, ...left.slice(75)];
    const expectedRight = [...right.slice(0, 75), 0, 0, 0, ...right.slice(75)];
    h.backend.commands.changeWsData147(left);
    h.backend.commands.changeWsData147R(right, 'right');
    h.flush();
    expect(frame(h.left, 15, 10)).toEqual(expectedLeft);
    expect(frame(h.right, 15, 10)).toEqual(expectedRight);
    expect(h.reportStats.mock.lastCall[0]).toEqual([...expectedLeft, ...expectedRight]);
    h.backend.commands.changeWsData147(new Array(147).fill(11), 'right');
    h.flush();
    expect(frame(h.left, 15, 10)).toEqual(expectedLeft);
    expect(h.reportStats.mock.lastCall[0].slice(0, 150)).toEqual(expectedLeft);
    expect(left).toHaveLength(147);
    h.backend.dispose();
  });

  it('整包189点保持顺序补到195，两侧原始数值不经过过滤', () => {
    const h = createHarness('webglRawGloveFullPacket');
    const left = Array.from({ length: 189 }, (_, i) => i + 1), right = new Array(189).fill(23);
    h.backend.commands.changeWsData147(left, 'left');
    h.backend.commands.changeWsData147(right, 'right');
    h.flush();
    expect(frame(h.left, 15, 13)).toEqual([...left, ...new Array(6).fill(0)]);
    expect(frame(h.right, 15, 13)).toEqual([...right, ...new Array(6).fill(0)]);
    expect(h.reportStats.mock.lastCall[0]).toHaveLength(390);
    h.backend.dispose();
  });

  it('256点按侧裁剪补零，高频帧各自绘制最新一份', () => {
    const h = createHarness('webglNumGlove');
    h.backend.commands.changeWsData256([1, 2], 'right');
    h.backend.commands.changeWsData256([9, 8], 'right');
    h.backend.commands.changeWsData256(new Array(260).fill(4), 'left');
    h.flush();
    expect(frame(h.left, 16, 16)).toEqual(new Array(256).fill(4));
    expect(frame(h.right, 16, 16)).toEqual([9, 8, ...new Array(254).fill(0)]);
    expect(h.reportStats.mock.lastCall[0]).toEqual([...new Array(256).fill(4), 9, 8, ...new Array(254).fill(0)]);
    h.backend.dispose();
  });

  it('resize和调色保留两侧画面，dispose回收双上下文及监听', () => {
    const h = createHarness('webglRawGloveFullPacket');
    h.backend.commands.changeWsData147(new Array(189).fill(15), 'left');
    h.backend.commands.changeWsData147(new Array(189).fill(35), 'right');
    h.flush();
    const originalWidth = h.right.width;
    vi.stubGlobal('innerWidth', 1200);
    h.listeners.get('resize')();
    vi.advanceTimersByTime(200);
    h.flush();
    expect(h.right.width).toBeLessThan(originalWidth);
    expect(frame(h.left, 15, 13)[0]).toBe(15);
    expect(frame(h.right, 15, 13)[0]).toBe(35);
    const leftDraws = h.left.gl.drawArrays.mock.calls.length, rightDraws = h.right.gl.drawArrays.mock.calls.length;
    h.tuning.valuej1 = 150;
    h.backend.applyTuning({ valuej: 150 });
    h.flush();
    expect(h.left.gl.drawArrays.mock.calls.length).toBe(leftDraws + 1);
    expect(h.right.gl.drawArrays.mock.calls.length).toBe(rightDraws + 1);
    h.backend.dispose();
    expect(deleteGlResources).toHaveBeenCalledWith(h.left.gl, expect.any(Object));
    expect(deleteGlResources).toHaveBeenCalledWith(h.right.gl, expect.any(Object));
    expect(h.container.children).toHaveLength(0);
    expect(h.listeners.size).toBe(0);
    expect(h.animation.size).toBe(0);
  });

  it('非手套裸矩阵维持转置，双脚仍按原来的左右布局绘制', () => {
    const h = createHarness('webglRawTransposed');
    const input = Array.from({ length: 1024 }, (_, i) => i % 200);
    h.backend.setRawFrame(input);
    h.flush();
    expect(frame(h.left, 32, 32)).toEqual(Array.from({ length: 1024 }, (_, i) => input[(i % 32) * 32 + Math.floor(i / 32)]));
    expect(h.backend.sensorGrid).not.toBeNull();
    h.backend.dispose();
    const foot = createHarness('webglRawFoot');
    foot.backend.commands.changeWsData147R({ left: new Array(60).fill(1), right: new Array(60).fill(2) });
    foot.flush();
    expect(frame(foot.left, 6, 10)).toEqual(new Array(60).fill(1));
    expect(frame(foot.right, 6, 10)).toEqual(new Array(60).fill(2));
    foot.backend.dispose();
  });
});

describe('统一原始数字矩阵与行列索引', () => {
  it.each(['webglNumDefault', 'webglRawDefault', 'webglRawTransposed'])(
    '%s 使用蓝色数字矩阵，索引位于格外且不进入源帧或框选', (preset) => {
      const h = createHarness(preset);
      const input = new Array(1024).fill(7);
      h.backend.setRawFrame(input);
      h.flush();
      expect(h.config.webgl).toMatchObject({ whiteOnZero: false, zeroTextColor: null,
        gridColor: 'rgba(0, 0, 40, 0.6)', textColor: '#4ec7ff', indexColumn: true, indexRow: true });
      expect(h.container.children[0].style.cssText).toContain('background-color:#000');
      const cs = h.left.width / 32, left = Math.max(cs, 24), bottom = Math.max(cs * 0.7, 18);
      const painted = h.leftOverlay.overlay.fillText.mock.calls;
      expect(painted).toHaveLength(1024 + 32 + 32);
      expect(painted.slice(0, 1024).every(([text]) => text === '7')).toBe(true);
      expect(painted.slice(1024, 1056).map(([text]) => text)).toEqual(Array.from({ length: 32 }, (_, i) => String(i + 1)));
      expect(painted[1024]).toEqual(['1', -left / 2, cs / 2]);
      expect(painted[1055]).toEqual(['32', -left / 2, 31.5 * cs]);
      expect(painted[1056]).toEqual(['1', cs / 2, 32 * cs + bottom / 2]);
      expect(painted.at(-1)).toEqual(['32', 31.5 * cs, 32 * cs + bottom / 2]);
      expect(h.leftOverlay.overlay.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, left, 0);
      expect(frame(h.left, 32, 32)).toEqual(input);
      expect(h.reportStats.mock.lastCall[0]).toEqual(input);
      expect(input).toHaveLength(1024);
      const sensors = h.backend.sensorGrid.projectSensors();
      expect(sensors).toHaveLength(1024);
      expect(sensors[0]).toMatchObject({ index: 0, x: 100 + left + cs / 2, y: 50 + cs / 2 });
      expect(h.backend.sensorGrid.getGridBounds().x1).toBe(100 + left);
      h.backend.dispose();
    },
  );

  it('矩形矩阵的行列号分别按真实维度计算，resize保留最后帧及索引', () => {
    const h = createHarness('webglRawDefault', { matrix: { gridWidth: 23, gridHeight: 16 } });
    const input = Array.from({ length: 23 * 16 }, (_, i) => i % 200);
    h.backend.setRawFrame(input);
    h.flush();
    expect(h.leftOverlay.overlay.fillText.mock.calls).toHaveLength(input.length + 16 + 23);
    expect(h.leftOverlay.overlay.fillText.mock.calls.at(-1)[0]).toBe('23');
    const previousWidth = h.left.width;
    h.leftOverlay.overlay.fillText.mockClear();
    vi.stubGlobal('innerWidth', 1200);
    h.listeners.get('resize')();
    vi.advanceTimersByTime(200);
    h.flush();
    expect(h.left.width).toBeLessThan(previousWidth);
    expect(frame(h.left, 23, 16)).toEqual(input);
    expect(h.leftOverlay.overlay.fillText.mock.calls).toHaveLength(input.length + 16 + 23);
    expect(h.backend.sensorGrid.projectSensors()).toHaveLength(input.length);
    h.backend.dispose();
  });

  it('显式关闭索引仍保持准确格数，不影响已有自定义渲染参数', () => {
    const h = createHarness('webglRawDefault', { indexRow: false, indexColumn: false, textColor: '#fff' });
    h.backend.setRawFrame(new Array(1024).fill(0));
    h.flush();
    expect(h.leftOverlay.overlay.fillText.mock.calls).toHaveLength(1024);
    expect(h.left.style.marginLeft).toBe('0px');
    expect(h.config.webgl.textColor).toBe('#fff');
    h.backend.dispose();
  });

  it('12位小床保留输入的一位小数，超过255的值只缩放颜色纹理', () => {
    const h = createHarness('webglRawDefault', { matrix: { gridWidth: 2, gridHeight: 2, decimalScale: 10, totalMetric: 'max' } });
    const input = [0, 1.2, 200.1, 409.5];
    h.backend.setRawFrame(input);
    h.flush();
    expect(h.leftOverlay.overlay.fillText.mock.calls.slice(0, 4).map(([text]) => text)).toEqual(['0.0', '1.2', '200.1', '409.5']);
    expect(h.reportStats.mock.lastCall[0]).toEqual(input);
    const colors = frame(h.left, 2, 2);
    expect(colors[2]).toBeGreaterThan(colors[1]);
    expect(colors[3]).toBeGreaterThan(colors[2]);
    expect(colors[3]).toBe(255);
    expect(input).toEqual([0, 1.2, 200.1, 409.5]);
    h.backend.dispose();
  });
});
