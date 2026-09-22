import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNativeSceneEntrance } from './nativeSceneEntrance';

vi.mock('gsap', () => ({ default: { to: vi.fn(() => ({ kill: vi.fn() })) } }));

const observers = [], cleanups = [];

/** 提供最小 DOM 边界，保留真实几何、采样、材质及粒子入口。 */
function fixture() {
  const container = { clientWidth: 800, clientHeight: 400, dataset: {}, children: [],
    appendChild: (node) => { node.parent = container; container.children.push(node); } };
  const canvas = { dataset: {}, style: {}, getBoundingClientRect: () => ({
    x: 0, y: 0, width: container.clientWidth, height: container.clientHeight,
  }) };
  let alpha = 1;
  const originalRender = vi.fn();
  const renderer = { domElement: canvas, render: originalRender, setSize: vi.fn(),
    getPixelRatio: () => 1, getClearAlpha: () => alpha, setClearAlpha: (value) => { alpha = value; } };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 100); camera.position.z = 10;
  const api = createNativeSceneEntrance(renderer, scene, camera, container);
  cleanups.push(() => api.dispose());
  return { api, canvas, container, renderer, scene, camera, originalRender, observer: observers.at(-1) };
}

/** 创建拥有独立几何、材质和贴图的异步加载结果，记录资源释放。 */
function loadedModel() {
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const model = new THREE.Mesh(geometry, material);
  return { model, releases: [geometry, material, texture].map((resource) => vi.spyOn(resource, 'dispose')) };
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ style: {}, setAttribute: vi.fn(),
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); },
  }) });
  vi.stubGlobal('ResizeObserver', class {
    /** 保存真实触发回调，以验证卸载后的迟到尺寸事件。 */
    constructor(callback) { this.callback = callback; this.observe = vi.fn(); this.disconnect = vi.fn(); observers.push(this); }
  });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  observers.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('原生异步场景入口生命周期', () => {
  it('模型未就绪时没有粒子入口，原生材质及姿态准备后才允许交接', () => {
    const { api, canvas, container, renderer, scene, camera, originalRender } = fixture();
    expect(canvas.dataset.modelState).toBe('loading');
    expect(canvas.shroomParticleEntrance).toBeUndefined();
    renderer.render(scene, camera);
    expect(originalRender).toHaveBeenCalledWith(scene, camera);
    const { model } = loadedModel(); model.position.x = 3;
    expect(api.accept(model)).toBe(true);
    scene.add(model); api.setModel(model);
    expect(canvas.dataset.modelState).toBe('ready');
    expect(container.dataset.modelState).toBe('ready');
    expect(canvas.shroomParticleEntrance?.play).toBeTypeOf('function');
    expect(model.position.x).toBe(3);
  });

  it('卸载后迟到模型被回收，不创建入口或写回已移除宿主', () => {
    const { api, canvas, container } = fixture();
    api.dispose();
    const { model, releases } = loadedModel();
    expect(api.accept(model)).toBe(false);
    releases.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    api.setModel(model); api.fail();
    expect(canvas.shroomParticleEntrance).toBeUndefined();
    expect(canvas.shroomSceneLoading).toBeUndefined();
    expect(container.children).toHaveLength(0);
    expect(container.dataset.modelState).toBeUndefined();
  });

  it('失败保持错误状态，随后成功到达的资源不能突然展示', () => {
    const { api, canvas, container } = fixture();
    api.fail();
    expect(container.dataset.modelState).toBe('error');
    expect(container.children[0].textContent).toContain('场景加载失败');
    const { model, releases } = loadedModel();
    expect(api.accept(model)).toBe(false);
    api.setModel(model);
    expect(canvas.dataset.modelState).toBe('error');
    expect(canvas.shroomParticleEntrance).toBeUndefined();
    releases.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });

  it('空模型按加载失败处理，不能把无实体画布标记为可交接', () => {
    const { api, canvas } = fixture();
    api.setModel(new THREE.Group());
    expect(canvas.dataset.modelState).toBe('error');
    expect(canvas.shroomParticleEntrance).toBeUndefined();
  });

  it('跟随宿主 resize，卸载恢复 render 并清理观察器和临时点云', () => {
    const { api, canvas, container, renderer, scene, camera, observer, originalRender } = fixture();
    expect(renderer.setSize).toHaveBeenLastCalledWith(800, 400, false);
    expect(camera.aspect).toBe(2);
    const { model, releases } = loadedModel(); scene.add(model); api.setModel(model);
    container.clientWidth = 600; container.clientHeight = 600; observer.callback();
    expect(renderer.setSize).toHaveBeenLastCalledWith(600, 600, false);
    expect(camera.aspect).toBe(1);
    const resizeCount = renderer.setSize.mock.calls.length;
    api.dispose(); observer.callback(); api.resize();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(renderer.setSize).toHaveBeenCalledTimes(resizeCount);
    expect(renderer.render).toBe(originalRender);
    expect(canvas.shroomParticleEntrance).toBeUndefined();
    expect(scene.children).toEqual([model]);
    expect(container.children).toHaveLength(0);
    releases.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    api.dispose();
    releases.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });

  it('形变中每次真实 render 跟随最新原生姿态，取消后不残留点云', async () => {
    const { api, canvas, renderer, scene, camera } = fixture();
    const { model } = loadedModel(); scene.add(model); api.setModel(model);
    const points = scene.children.find((child) => child.isPoints);
    const before = points.geometry.attributes.position.array.slice();
    const playing = canvas.shroomParticleEntrance.play({
      positions: new Float32Array([400, 200, 0]), colors: new Float32Array([1, 1, 1]), sizes: new Float32Array([2]),
    });
    model.position.x = 3; renderer.render(scene, camera);
    for (let i = 0; i < before.length; i += 3) expect(points.geometry.attributes.position.array[i]).toBeCloseTo(before[i] + 3, 5);
    api.dispose(); await playing;
    expect(scene.children).toEqual([model]);
    expect(model.material.opacity).toBe(1);
  });
});
