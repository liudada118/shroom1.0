import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, PerspectiveCamera, Points, Vector3 } from 'three';
import { createPointViewTools } from './pointViewTools';

/** 使用真实偏置矩阵与倾斜垫面，验证镜头不会追到世界原点。 */
function fixture(localCenter = null) {
  const object = new Group();
  object.position.set(5, 150, 230);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([1, 4, 7, 2, 5, 8], 3));
  const plane = new Points(geometry);
  plane.rotation.x = Math.PI / 3;
  if (localCenter) plane.scale.setScalar(.0062);
  object.add(plane);
  const camera = new PerspectiveCamera(40, 1, 1, 150000);
  camera.position.set(0, 200, 300);
  const initial = camera.position.clone();
  const controls = { target: new Vector3(), target0: new Vector3(),
    update: vi.fn(() => camera.lookAt(controls.target)), reset: vi.fn(() => {
    controls.target.copy(controls.target0); camera.position.copy(initial);
  }) };
  return { object, plane, camera, controls,
    tools: createPointViewTools({ object, camera, controls, plane, localCenter }) };
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
  it('小床初始旋转目标和复位快照均位于缩放倾斜后的真实底面中心', () => {
    const localCenter = new Vector3(-50, 0, -50);
    const { object, plane, camera, controls } = fixture(localCenter);
    const expected = plane.localToWorld(localCenter.clone());
    expect(controls.target.distanceTo(expected)).toBeLessThan(1e-12);
    expect(controls.target.distanceTo(object.position)).toBeGreaterThan(.1);
    expect(controls.target0.distanceTo(expected)).toBeLessThan(1e-12);
    const direction = camera.getWorldDirection(new Vector3());
    expect(direction.dot(expected.sub(camera.position).normalize())).toBeCloseTo(1, 12);
    expect(localCenter.toArray()).toEqual([-50, 0, -50]);
  });
  it('小床工具变换与复位保持同一底面中心，压力顶点不参与目标计算', () => {
    const localCenter = new Vector3(-50, 0, -50);
    const { plane, camera, controls, tools } = fixture(localCenter);
    const initialTarget = controls.target0.clone();
    const positions = Array.from(plane.geometry.attributes.position.array);
    for (const [method, args] of [['rotate', ['x']], ['rotate', ['z', -1]],
      ['flip', ['x']], ['flip', ['y']], ['top', []], ['zoom', [1]], ['reset', []]]) {
      expect(tools[method](...args)).toBe(true);
      expect(controls.target.distanceTo(plane.localToWorld(localCenter.clone()))).toBeLessThan(1e-12);
      expect(controls.target0.toArray()).toEqual(initialTarget.toArray());
      expect(Array.from(plane.geometry.attributes.position.array)).toEqual(positions);
      expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
    }
    expect(camera.position.toArray()).toEqual([0, 200, 300]);
    plane.geometry.attributes.position.setY(0, 10000);
    tools.recenter();
    expect(controls.target.toArray()).toEqual(initialTarget.toArray());
  });
  it('小床平移不会在常规更新时被归中，无效和卸载操作不能移动目标', () => {
    const { camera, controls, tools } = fixture(new Vector3(-50, 0, -50));
    controls.target.add(new Vector3(10, 0, 20));
    const target = controls.target.toArray();
    controls.update();
    expect(controls.target.toArray()).toEqual(target);
    expect(tools.rotate('invalid')).toBe(false);
    expect(tools.flip('invalid')).toBe(false);
    expect(controls.target.toArray()).toEqual(target);
    tools.dispose();
    const position = camera.position.toArray();
    for (const [method, args] of [['recenter', []], ['reset', []], ['rotate', ['y']], ['flip', ['x']]]) {
      expect(tools[method](...args)).toBe(false);
    }
    expect(controls.target.toArray()).toEqual(target);
    expect(camera.position.toArray()).toEqual(position);
  });
  it('X/Y按钮混合点击时绕点图自身轴旋转30度，中心和镜头保持不动', () => {
    const localCenter = new Vector3(-50, 0, -50);
    const { object, plane, camera, controls, tools } = fixture(localCenter);
    const center = plane.localToWorld(localCenter.clone());
    const pivot = object.worldToLocal(center.clone());
    const cameraMatrix = camera.matrixWorld.clone();
    const target = controls.target.clone();
    for (const [axis, direction] of [['y', 1], ['x', 1], ['y', -1], ['x', 1], ['y', 1]]) {
      const axisVector = new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, 0);
      const across = new Vector3(axis === 'y' ? 1 : 0, axis === 'x' ? 1 : 0, 0);
      const axialPoint = pivot.clone().addScaledVector(axisVector, 10);
      const acrossPoint = pivot.clone().addScaledVector(across, 10);
      const beforeAxis = object.localToWorld(axialPoint.clone());
      const beforeAcross = object.localToWorld(acrossPoint.clone()).sub(center);
      expect(tools.rotate(axis, direction)).toBe(true);
      expect(plane.localToWorld(localCenter.clone()).distanceTo(center)).toBeLessThan(1e-10);
      expect(object.localToWorld(axialPoint.clone()).distanceTo(beforeAxis)).toBeLessThan(1e-10);
      const afterAcross = object.localToWorld(acrossPoint.clone()).sub(center);
      expect(beforeAcross.angleTo(afterAcross)).toBeCloseTo(Math.PI / 6, 10);
      expect(camera.matrixWorld.elements).toEqual(cameraMatrix.elements);
      expect(controls.target.toArray()).toEqual(target.toArray());
    }
  });
  it('小床镜像及混合轴旋转保持底面中心，12次旋转和反向操作均可还原', () => {
    const localCenter = new Vector3(-50, 0, -50);
    const { object, plane, camera, controls, tools } = fixture(localCenter);
    const center = plane.localToWorld(localCenter.clone());
    const initial = object.matrixWorld.clone();
    const cameraPosition = camera.position.clone();
    tools.flip('x'); tools.flip('y'); tools.flip('x'); tools.flip('y');
    expect(plane.localToWorld(localCenter.clone()).distanceTo(center)).toBeLessThan(1e-10);
    for (let index = 0; index < 12; index++) tools.rotate('x');
    for (let index = 0; index < 12; index++) tools.rotate('y');
    tools.rotate('x'); tools.rotate('y'); tools.rotate('y', -1); tools.rotate('x', -1);
    expect(Math.max(...object.matrixWorld.elements.map((value, index) => Math.abs(value - initial.elements[index])))).toBeLessThan(1e-10);
    expect(camera.position.toArray()).toEqual(cameraPosition.toArray());
    expect(controls.target.distanceTo(center)).toBeLessThan(1e-10);
    tools.reset();
    expect(object.matrixWorld.elements).toEqual(initial.elements);
  });
  it('保存旋转镜像后的底面补偿，重新挂载恢复同一中心和镜头且默认复位不受污染', async () => {
    const localCenter = new Vector3(-50, 0, -50), first = fixture(localCenter);
    const received = [];
    first.tools.subscribe((value) => received.push(value));
    const center = first.plane.localToWorld(localCenter.clone());
    first.tools.rotate('x'); first.tools.flip('y'); first.tools.rotate('x', -1); first.tools.top(); first.tools.zoom(1);
    await Promise.resolve();
    expect(received).toHaveLength(1);
    const saved = received[0]; expect(saved).toEqual(first.tools.getSnapshot());
    expect(first.plane.localToWorld(localCenter.clone()).distanceTo(center)).toBeLessThan(1e-10);
    const second = fixture(localCenter), initialTarget = second.controls.target0.clone();
    expect(second.tools.restoreSnapshot(saved)).toBe(true);
    expect(second.plane.localToWorld(localCenter.clone()).distanceTo(center)).toBeLessThan(1e-10);
    expect(second.camera.position.toArray()).toEqual(first.camera.position.toArray());
    expect(second.controls.target.toArray()).toEqual(first.controls.target.toArray());
    expect(second.controls.target0.toArray()).toEqual(initialTarget.toArray());
    expect(second.object.matrixWorld.elements).toEqual(first.object.matrixWorld.elements);
    second.tools.reset();
    expect(second.controls.target.toArray()).toEqual(initialTarget.toArray());
    expect(second.camera.position.toArray()).toEqual([0, 200, 300]);
    expect(second.tools.getState()).toMatchObject({ flipX: false, flipY: false });
  });
});
