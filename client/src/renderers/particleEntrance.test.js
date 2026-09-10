import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import gsap from 'gsap';
import { captureParticleProjection, installParticleEntrance, mapParticleOrigins, patchParticleShader } from './particleEntrance';

vi.mock('gsap', () => ({ default: { to: vi.fn((target, options) => {
  target.value = options.value;
  options.onUpdate(); options.onComplete();
  return { kill: vi.fn() };
}) } }));

/** 创建真正的 Three 点阵和相机，测试中不创建 WebGL 或传感器连接。 */
function fixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0], 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 1, 1, 0, 0], 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .1, vertexColors: true }));
  const scene = new THREE.Scene(); scene.add(points);
  const camera = new THREE.PerspectiveCamera(40, 2, .1, 100); camera.position.z = 10;
  return { points, scene, camera, rect: { x: 20, y: 30, width: 800, height: 400 } };
}

describe('正式压力点图接续预览粒子', () => {
  it('使用真实对象变换和相机投影，而非模型包围盒估算', () => {
    const { points, camera, rect } = fixture();
    points.position.x = 2;
    const snapshot = captureParticleProjection(points, camera, rect);
    const expected = new THREE.Vector3(1, 0, 0).project(camera);
    expect(snapshot.positions[0]).toBeCloseTo(rect.x + (expected.x + 1) * rect.width / 2, 4);
    expect(snapshot.colors).toEqual(points.geometry.attributes.color.array);
    expect(snapshot.sizes[0]).toBeCloseTo(2);
    expect(captureParticleProjection(points, camera, { width: 0, height: 0 })).toBeNull();
  });
  it('预览数量不足时分配亮度，匹配不修改源点位或正式压力顺序', () => {
    const source = { positions: new Float32Array([50, 50, 0]), colors: new Float32Array([.2, .3, .4]), sizes: new Float32Array([4]) };
    const target = { positions: new Float32Array([0, 0, 0, 100, 100, 0]) };
    const origins = mapParticleOrigins(source, target, { x: 0, y: 0, width: 100, height: 100 }, 2);
    expect([...origins.positions]).toEqual([0, 0, 0, 0, 0, 0]);
    expect([...origins.opacity]).toEqual([.5, .5]);
    expect([...origins.sizes]).toEqual([8, 8]);
    expect([...target.positions]).toEqual([0, 0, 0, 100, 100, 0]);
  });
  it('GPU 终点沿用原生实时投影、点大小和颜色，不注入假数据', () => {
    const progress = { value: 0 };
    const shader = { uniforms: {}, vertexShader: '#include <project_vertex>\n#include <fog_vertex>', fragmentShader: '#include <color_fragment>' };
    patchParticleShader(shader, progress);
    expect(shader.uniforms.portalProgress).toBe(progress);
    expect(shader.vertexShader).toContain('mix(portalOrigin * gl_Position.w, gl_Position.xyz, portalProgress)');
    expect(shader.vertexShader).toContain('mix(portalSize, gl_PointSize, portalProgress)');
    expect(shader.fragmentShader).toContain('mix(vPortalColor, diffuseColor.rgb, portalProgress)');
  });
  it('返回的落点可随隐藏预览移动，点位配对不随排序变化而跳换', () => {
    const source = { positions: new Float32Array([20, 50, 0, 80, 50, 0]),
      colors: new Float32Array([1, 0, 0, 0, 1, 0]), sizes: new Float32Array([2, 3]) };
    const target = { positions: new Float32Array([0, 0, 0, 100, 0, 0]) };
    const mapping = mapParticleOrigins(source, target, { x: 0, y: 0, width: 100, height: 100 });
    const moved = { ...source, positions: new Float32Array([90, 50, 0, 10, 50, 0]) };
    expect(mapping.update(moved)).toBe(true);
    expect(mapping.positions[0]).toBeCloseTo(.8);
    expect(mapping.positions[3]).toBeCloseTo(-.8);
    expect([...mapping.colors]).toEqual([...source.colors]);
    const previous = mapping.positions.slice();
    expect(mapping.update(null)).toBe(false);
    expect(mapping.update({ ...moved, positions: new Float32Array(3) })).toBe(false);
    expect(mapping.positions).toEqual(previous);
    expect(source.positions[0]).toBe(20);
  });
  it('规则矩阵按行列对应，不按空间排序打散连续网格', () => {
    const source = { positions: new Float32Array([0, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 0]),
      colors: new Float32Array(12), sizes: new Float32Array(4).fill(2), grid: { rows: 2, cols: 2 } };
    const target = { positions: new Float32Array(27), grid: { rows: 3, cols: 3 } };
    const origins = mapParticleOrigins(source, target, { x: 0, y: 0, width: 100, height: 100 });
    expect([...origins.positions.subarray(0, 9)]).toEqual([-1, 1, 0, 1, 1, 0, 1, 1, 0]);
    expect([...origins.positions.subarray(18, 27)]).toEqual([-1, -1, 0, 1, -1, 0, 1, -1, 0]);
  });
  it('完成与反向后恢复材质、装饰、透明度；卸载移除入口', async () => {
    const { points, scene, camera, rect } = fixture();
    const material = points.material;
    const position = points.geometry.attributes.position.array;
    const originalPositions = new Float32Array(position);
    const grid = new THREE.GridHelper(); scene.add(grid);
    const alpha = { value: 1 };
    const canvas = { getBoundingClientRect: () => rect, dataset: {} };
    const renderer = { domElement: canvas, getPixelRatio: () => 2, getClearAlpha: () => alpha.value,
      setClearAlpha: (value) => { alpha.value = value; }, render: vi.fn() };
    const dispose = installParticleEntrance(renderer, scene, camera, points);
    const snapshot = captureParticleProjection(points, camera, rect);
    for (const reverse of [false, true]) {
      const onStart = vi.fn();
      await canvas.shroomParticleEntrance.play(snapshot, { reverse, onStart });
      expect(onStart).toHaveBeenCalledOnce();
      expect(points.material).toBe(material);
      expect(points.geometry.attributes.portalOrigin).toBeUndefined();
      expect(position).toEqual(originalPositions);
      expect(alpha.value).toBe(1);
      expect(grid.material.opacity).toBe(1);
    }
    const controller = new AbortController(); controller.abort();
    expect(canvas.shroomParticleEntrance.play(snapshot, { signal: controller.signal })).toBeNull();
    dispose(); expect(canvas.shroomParticleEntrance).toBeUndefined();
  });
  it('反向 GPU 落点使用这一帧的新投影，结束仍恢复原材质', async () => {
    const { points, scene, camera, rect } = fixture();
    const canvas = { getBoundingClientRect: () => rect, dataset: {} };
    const rendered = [];
    const renderer = { domElement: canvas, getPixelRatio: () => 1, getClearAlpha: () => 1, setClearAlpha: vi.fn(),
      render: () => { rendered.push([...points.geometry.attributes.portalOrigin.array]); } };
    const dispose = installParticleEntrance(renderer, scene, camera, points);
    const source = captureParticleProjection(points, camera, rect);
    const moved = { ...source, positions: source.positions.map((value, index) => index % 3 === 0 ? value + 30 : value) };
    const resolveSource = vi.fn((progress) => progress === 0 ? moved : source);
    await canvas.shroomParticleEntrance.play(source, { reverse: true, resolveSource });
    expect(resolveSource).toHaveBeenCalledWith(0);
    expect(rendered.at(-1)[0] - rendered[0][0]).toBeCloseTo(30 / rect.width * 2);
    expect(points.geometry.attributes.portalOrigin).toBeUndefined();
    const calls = resolveSource.mock.calls.length;
    expect(() => gsap.to.mock.calls.at(-1)[1].onUpdate()).not.toThrow();
    expect(resolveSource).toHaveBeenCalledTimes(calls);
    dispose();
  });
});
