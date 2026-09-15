import { describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { createWorkspaceViewTools } from './workspaceViewTools';

/** 用真实 Three.js 变换与轻量 controls 验证工具不依赖 WebGL。 */
function fixture() {
  const object = new Group(), camera = new PerspectiveCamera(40, 1, 1, 10000);
  object.scale.set(2, 3, 4); object.position.set(2, 5, 6); camera.position.set(0, 100, 200);
  const originalCamera = camera.position.clone();
  const controls = { target: new Vector3(), update: vi.fn(), reset: vi.fn(() => camera.position.copy(originalCamera)) };
  return { object, camera, controls, tools: createWorkspaceViewTools({ object, camera, controls }) };
}

describe('原生展示视角工具', () => {
  it('旋转精确为 30°，反向可恢复，非法轴不改变对象', () => {
    const { object, tools } = fixture();
    expect(tools.rotate('y')).toBe(true);
    expect(object.rotation.y).toBeCloseTo(Math.PI / 6, 12);
    expect(tools.getState().selectionSafe).toBe(false);
    tools.rotate('y', -1); expect(object.rotation.y).toBeCloseTo(0, 12);
    expect(tools.getState().selectionSafe).toBe(true);
    expect(tools.rotate('pressure')).toBe(false);
  });
  it('镜像只改垫面轴，压力高度不变，重复点击或 reset 可恢复', () => {
    const { object, tools, controls } = fixture();
    tools.flip('x'); tools.flip('y');
    expect(object.scale.toArray()).toEqual([-2, 3, -4]);
    expect(tools.getState()).toEqual({ available: true, flipX: true, flipY: true, selectionSafe: false });
    tools.flip('x'); expect(object.scale.x).toBe(2);
    tools.rotate('x'); tools.reset();
    expect(object.scale.toArray()).toEqual([2, 3, 4]);
    expect(object.rotation.x).toBe(0); expect(controls.reset).toHaveBeenCalledOnce();
  });
  it('放大缩小仅改变相机距离，俯视没有零向量', () => {
    const { tools, object, camera } = fixture();
    const before = camera.position.length();
    tools.zoom(1); expect(camera.position.length()).toBeCloseTo(before * .85);
    tools.zoom(-1); expect(camera.position.length()).toBeCloseTo(before);
    tools.top(); expect(camera.position.x).toBe(0); expect(camera.position.y).toBeCloseTo(before);
    expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
    expect(object.scale.toArray()).toEqual([2, 3, 4]);
  });
  it('dispose 复原共享对象，拒绝迟到的动作', () => {
    const { object, tools } = fixture();
    tools.flip('x'); tools.dispose();
    expect(object.scale.x).toBe(2); expect(tools.getState().available).toBe(false);
    expect(tools.rotate('x')).toBe(false); expect(tools.flip('x')).toBe(false);
    expect(tools.reset()).toBe(false); expect(tools.zoom(1)).toBe(false); expect(tools.top()).toBe(false);
  });
});
