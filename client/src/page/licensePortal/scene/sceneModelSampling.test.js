import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getMeshSurfaceArea } from './sceneModelSampling';

describe('模型粒子按实际表面积分布', () => {
  it('高细分小部件不能因顶点多而挤掉大部件', () => {
    const torso = new THREE.Mesh(new THREE.PlaneGeometry(2, 4));
    const hand = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 40, 40));
    expect(hand.geometry.attributes.position.count).toBeGreaterThan(torso.geometry.attributes.position.count);
    expect(getMeshSurfaceArea(torso)).toBeCloseTo(8);
    expect(getMeshSurfaceArea(hand)).toBeCloseTo(1);
    torso.geometry.dispose(); hand.geometry.dispose();
  });
  it('父级缩放及非索引几何按同一世界面积计算', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 3).toNonIndexed());
    const parent = new THREE.Group();
    parent.add(mesh); parent.scale.set(2, 4, 1); parent.rotation.x = .6;
    expect(getMeshSurfaceArea(mesh)).toBeCloseTo(48);
    mesh.geometry.dispose();
  });
});
