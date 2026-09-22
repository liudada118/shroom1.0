import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFootPlaneSamples, createNativeModelSamples } from './nativeSceneSamples';

afterEach(() => vi.unstubAllGlobals());

/** 用透明像素数据替代浏览器解码，其余平面几何及世界变换使用真实 Three。 */
function mockFootImage(pixels) {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({
    drawImage: vi.fn(), getImageData: () => ({ data: pixels }),
  }) }) });
}

describe('原生场景表面采样', () => {
  it('以世界面积分配点位，高细分手部不会挤掉低细分躯干', () => {
    const model = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.PlaneGeometry(2, 4).toNonIndexed());
    torso.position.x = -10;
    const hand = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 40, 40));
    const handParent = new THREE.Group();
    handParent.position.x = 10; handParent.scale.x = 2; handParent.add(hand);
    model.add(torso, handParent);
    expect(hand.geometry.attributes.position.count).toBeGreaterThan(torso.geometry.attributes.position.count * 100);
    const samples = createNativeModelSamples(model, 900);
    const handPoints = Array.from(samples.positions).filter((value, index) => index % 3 === 0 && value > 0).length;
    // 躯干面积 8，经过父级缩放的手部面积 2，应占约五分之一。
    expect(handPoints / 900).toBeCloseTo(.2, 2);
    expect(samples.positions.every(Number.isFinite)).toBe(true);
  });

  it('随父级和骨骼姿态移动样本，不重复变换或修改原网格', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 2, 0], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    const bone = new THREE.Bone(); mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    const parent = new THREE.Group(); parent.position.x = 2; parent.add(mesh);
    const original = geometry.attributes.position.array.slice();
    const samples = createNativeModelSamples(parent, 12);
    const before = samples.positions.slice();
    parent.position.x = 5; bone.position.x = 4; samples.update();
    for (let i = 0; i < samples.positions.length; i += 3) {
      expect(samples.positions[i]).toBeCloseTo(before[i] + 7, 5);
      expect(samples.positions[i + 1]).toBeCloseTo(before[i + 1], 5);
    }
    const translated = samples.positions.slice();
    parent.rotation.z = Math.PI / 2; samples.update();
    for (let i = 0; i < samples.positions.length; i += 3) {
      expect(samples.positions[i]).toBeCloseTo(5 - translated[i + 1], 5);
      expect(samples.positions[i + 1]).toBeCloseTo(translated[i] - 5, 5);
    }
    expect(geometry.attributes.position.array).toEqual(original);
  });

  it('足底只采样透明轮廓内的像素，并跟随两个实际平面的姿态', () => {
    const pixels = new Uint8ClampedArray(192 * 192 * 4);
    pixels[3] = 255; pixels[pixels.length - 1] = 40;
    pixels[(96 * 192 + 96) * 4 + 3] = 31;
    mockFootImage(pixels);
    const texture = new THREE.Texture({});
    const model = new THREE.Group(); model.position.set(0, 3, 2);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshBasicMaterial({ map: texture }));
    const right = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshBasicMaterial({ map: texture }));
    left.position.x = -5; right.position.x = 5; model.add(left, right);
    const samples = createFootPlaneSamples(model, 4);
    expect([...samples.positions]).toEqual([-6, 5, 2, -4, 1, 2, 4, 5, 2, 6, 1, 2]);
    left.rotation.z = Math.PI / 2; samples.update();
    expect(samples.positions[0]).toBeCloseTo(-7);
    expect(samples.positions[1]).toBeCloseTo(2);
    expect([...samples.positions.slice(6)]).toEqual([4, 5, 2, 6, 1, 2]);
  });

  it('没有可见表面的资源不能伪造可交接点云', () => {
    expect(createNativeModelSamples(new THREE.Group())).toBeNull();
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(0, 0));
    expect(createNativeModelSamples(flat)).toBeNull();
    expect(createFootPlaneSamples(new THREE.Group())).toBeNull();
    mockFootImage(new Uint8ClampedArray(192 * 192 * 4));
    const foot = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshBasicMaterial({ map: new THREE.Texture({}) }));
    expect(() => createFootPlaneSamples(foot)).toThrow('足底贴图没有可见轮廓');
  });
});
