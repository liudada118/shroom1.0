import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createModelParticleSamples, installModelParticleEntrance } from './modelParticleEntrance';
vi.mock('gsap', () => ({ default: { to: (target, options) => {
  target.value = .8; options.onUpdate();
  target.value = options.value; options.onUpdate(); options.onComplete(); return { kill: vi.fn() };
} } }));

/** 测试使用真实网格矩阵，只替换不依赖 WebGL 的动画时钟。 */
function fixture() {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
  const model = new THREE.Group(); model.position.set(2, 3, 4); model.add(mesh);
  const scene = new THREE.Scene(); scene.add(model);
  const camera = new THREE.PerspectiveCamera(40, 2, .1, 100); camera.position.z = 10;
  const canvas = { dataset: {}, getBoundingClientRect: () => ({ x: 0, y: 0, width: 800, height: 400 }) };
  const renderer = { domElement: canvas, getPixelRatio: () => 2, getClearAlpha: () => 0, setClearAlpha: vi.fn(), render: vi.fn() };
  return { mesh, model, scene, camera, canvas, renderer };
}

describe('手模型点云到真实实体衔接', () => {
  it('采样跟随模型世界姿态，不修改原几何', () => {
    const { model, mesh } = fixture();
    const original = [...mesh.geometry.attributes.position.array];
    const samples = createModelParticleSamples(model, 10);
    const before = [...samples.positions];
    model.position.x += 5; samples.update();
    expect(samples.positions[0]).toBeCloseTo(before[0] + 5);
    expect([...mesh.geometry.attributes.position.array]).toEqual(original);
    expect(createModelParticleSamples(new THREE.Group())).toBeNull();
  });
  it('进退场和卸载恢复材质深度与原模型，不残留临时点云', async () => {
    const { mesh, model, scene, camera, renderer, canvas } = fixture();
    const entrance = installModelParticleEntrance(renderer, scene, camera, model);
    const source = { positions: new Float32Array([10, 20, 0]), colors: new Float32Array([1, 1, 1]), sizes: new Float32Array([2]) };
    for (const reverse of [false, true]) {
      await canvas.shroomParticleEntrance.play(source, { reverse, onProgress: (value) => {
        if (value === .8) { expect(mesh.material.depthWrite).toBe(true); expect(mesh.material.side).toBe(THREE.FrontSide); }
      } });
      expect(mesh.material.opacity).toBe(1); expect(mesh.material.depthWrite).toBe(true);
      expect(mesh.material.side).toBe(THREE.DoubleSide);
      expect(scene.children.find((item) => item.isPoints).visible).toBe(false);
    }
    entrance.dispose(); expect(canvas.shroomParticleEntrance).toBeUndefined(); expect(scene.children).toEqual([model]);
  });
  it('骨骼与父级姿态只应用一次，不用上一帧的绑定逆矩阵采样', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([1, 0, 0], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial({ skinning: true }));
    const bone = new THREE.Bone(); mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    const model = new THREE.Group(); model.add(mesh); model.position.x = 2;
    const samples = createModelParticleSamples(model);
    expect(samples.positions[0]).toBeCloseTo(3);
    model.position.x = 5; bone.position.x = 4; samples.update();
    expect(samples.positions[0]).toBeCloseTo(10);
    expect(geometry.attributes.position.array[0]).toBe(1);
  });
});
