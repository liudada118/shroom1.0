import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createEdgeBufferPoints } from '@shroom/frontend/renderers/pointGrid/react/edgeBufferPoints.js';

describe('外围点图与主场景隔离', () => {
  it('使用主图当前平滑值且保持主几何、中心与镜像，变宽和卸载释放新增资源', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 5 * 2 * 3), 3));
    const material = new THREE.PointsMaterial();
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const points = new THREE.Points(geometry, material);
    points.position.set(4, 5, 6);
    points.rotation.set(0.2, 0.3, 0.4);
    points.scale.set(-2, 3, 4);
    const matrix = points.matrix.clone();
    const edge = createEdgeBufferPoints({ points, rows: 3, columns: 5, rowStretch: 2,
      positionAt: (row, col) => [row * 10 - 30, col * 10 - 25] });
    const raw = Object.freeze(new Array(15).fill(1000));
    const stats = raw.reduce((a, b) => a + b, 0);
    edge.update(raw, 5, 3, 0, 2);
    const border = points.children[0];
    const oldGeometry = border.geometry;
    const disposeGeometry = vi.spyOn(oldGeometry, 'dispose');
    edge.render({ height: 2, smoothedValues: new Array(30).fill(20), color: () => [255, 0, 0] });
    const positions = border.geometry.attributes.position.array;
    const ys = Array.from(positions).filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBe(20);
    expect(Math.min(...ys)).toBe(0);
    expect(points.geometry).toBe(geometry);
    expect(points.matrix.equals(matrix)).toBe(true);
    expect(points.scale.x).toBe(-2);
    expect(raw.reduce((a, b) => a + b, 0)).toBe(stats);
    expect(edge.sample(0, 0)).toBe(1000);
    expect(edge.sample(5, 0)).toBe(1000);
    edge.update(raw, 5, 3, 0, 4);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    edge.render({ height: 2, smoothedValues: new Array(30).fill(20), color: () => [255, 0, 0] });
    expect(border.geometry.attributes.position.count).toBe(((3 + 8) * (5 + 8) - 15) * 2);
    edge.update(raw, 5, 3, 0, 0);
    expect(border.visible).toBe(false);
    expect(edge.sample(0, 123)).toBe(123);
    edge.dispose();
    expect(points.children).toHaveLength(0);
    expect(disposeMaterial).not.toHaveBeenCalled();
  });
});
