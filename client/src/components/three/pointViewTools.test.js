import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, PerspectiveCamera, Points, Vector3 } from 'three';
import { createPointViewTools } from './pointViewTools';

/** 使用真实偏置矩阵与倾斜垫面，验证镜头不会追到世界原点。 */
function fixture() {
  const object = new Group();
  object.position.set(5, 150, 230);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([1, 4, 7, 2, 5, 8], 3));
  const plane = new Points(geometry);
  plane.rotation.x = Math.PI / 3;
  object.add(plane);
  const camera = new PerspectiveCamera(40, 1, 1, 150000);
  camera.position.set(0, 200, 300);
  const initial = camera.position.clone();
  const controls = { target: new Vector3(), update: vi.fn(), reset: vi.fn(() => {
    controls.target.set(0, 0, 0); camera.position.copy(initial);
  }) };
  return { object, plane, camera, controls,
    tools: createPointViewTools({ object, camera, controls, plane }) };
}

describe('旧点图视角中心', () => {
  it('俯视沿倾斜点面的真实法线，绕点图中心而不是世界原点', () => {
    const { object, plane, camera, controls, tools } = fixture();
    tools.rotate('y'); tools.top();
    expect(controls.target.toArray()).toEqual(object.position.toArray());
    const normal = new Vector3(0, 1, 0).transformDirection(plane.matrixWorld);
    expect(camera.position.clone().sub(controls.target).normalize().dot(normal)).toBeCloseTo(1, 12);
    expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
  });
  it('缩放保留点图中心，变换不修改压力顶点；复位回到初始镜头', () => {
    const { object, plane, camera, controls, tools } = fixture();
    const positions = Array.from(plane.geometry.attributes.position.array);
    const distance = camera.position.distanceTo(object.position);
    tools.zoom(1);
    expect(camera.position.distanceTo(object.position)).toBeCloseTo(distance * .85, 10);
    tools.flip('x'); tools.flip('y'); tools.rotate('x'); tools.top(); tools.reset();
    expect(Array.from(plane.geometry.attributes.position.array)).toEqual(positions);
    expect(camera.position.toArray()).toEqual([0, 200, 300]);
    expect(controls.target.toArray()).toEqual([0, 0, 0]);
    expect(tools.getState().selectionSafe).toBe(true);
  });
  it('卸载后旧工具不能重新移动镜头或恢复镜像', () => {
    const { camera, tools } = fixture();
    tools.flip('x'); tools.dispose();
    const before = camera.position.toArray();
    expect(tools.top()).toBe(false); expect(tools.zoom(1)).toBe(false);
    expect(tools.rotate('y')).toBe(false); expect(tools.flip('y')).toBe(false);
    expect(camera.position.toArray()).toEqual(before);
  });
});
