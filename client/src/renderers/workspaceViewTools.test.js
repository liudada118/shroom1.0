import { describe, expect, it, vi } from 'vitest';
import { EventDispatcher, Group, PerspectiveCamera, Vector3 } from 'three';
import { createWorkspaceViewTools } from './workspaceViewTools';
import { validateWorkspaceViewSnapshot } from '@shroom/frontend/renderers/shared/three/workspaceViewTools.js';

/** 用真实 Three.js 变换与轻量 controls 验证工具不依赖 WebGL。 */
function fixture() {
  const object = new Group(), camera = new PerspectiveCamera(40, 1, 1, 10000);
  object.scale.set(2, 3, 4); object.position.set(2, 5, 6); camera.position.set(0, 100, 200);
  const originalCamera = camera.position.clone();
  const controls = Object.assign(new EventDispatcher(), { target: new Vector3(), update: vi.fn(), reset: vi.fn(() => camera.position.copy(originalCamera)) });
  return { object, camera, controls, tools: createWorkspaceViewTools({ object, camera, controls }) };
}

describe('原生展示视角工具', () => {
  it('倾斜点阵俯视沿真实垫面法线，缩放仍围绕当前矩阵中心', () => {
    const { object, camera, controls } = fixture();
    object.rotation.x = Math.PI / 3;
    controls.target.copy(object.position);
    const tools = createWorkspaceViewTools({ object, camera, controls, localPlane: true });
    const distance = camera.position.distanceTo(controls.target);
    tools.top();
    const expected = new Vector3(0, 1, 0).transformDirection(object.matrixWorld);
    expect(camera.position.clone().sub(controls.target).normalize().dot(expected)).toBeCloseTo(1, 12);
    tools.zoom(1);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(distance * .85);
  });
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
  it('镜头和对象快照跨实例恢复，镜像按钮状态与实际显示一致，复位仍使用初始状态', () => {
    const first = fixture();
    first.tools.rotate('x'); first.tools.flip('x'); first.tools.flip('y'); first.tools.top(); first.tools.zoom(1);
    first.controls.target.add(new Vector3(12, 3, 5)); first.camera.position.add(new Vector3(12, 3, 5));
    const saved = first.tools.getSnapshot();
    expect(validateWorkspaceViewSnapshot(saved)).toBe(true);
    const second = fixture(), originalCamera = second.camera.position.toArray();
    expect(second.tools.restoreSnapshot(JSON.parse(JSON.stringify(saved)))).toBe(true);
    expect(second.tools.getSnapshot()).toEqual(saved);
    expect(second.object.matrixWorld.elements).toEqual(first.object.matrixWorld.elements);
    expect(second.tools.getState()).toMatchObject({ flipX: true, flipY: true, selectionSafe: false });
    second.tools.reset();
    expect(second.object.position.toArray()).toEqual([2, 5, 6]); expect(second.object.scale.toArray()).toEqual([2, 3, 4]);
    expect(second.camera.position.toArray()).toEqual(originalCamera);
    expect(second.tools.getState()).toMatchObject({ flipX: false, flipY: false, selectionSafe: true });
  });
  it('坏缓存必须整体拒绝，不能先改镜像再发现镜头非法', () => {
    const { tools } = fixture(); tools.flip('x');
    const before = tools.getSnapshot();
    const changes = [
      (value) => { value.object.position[0] = NaN; },
      (value) => { value.object.quaternion = [0, 0, 0, 0]; },
      (value) => { value.object.scale[1] = 0; },
      (value) => { value.object.scale[0] = 2; },
      (value) => { value.camera.up = [0, 0, 0]; },
      (value) => { value.camera.zoom = Infinity; },
      (value) => { value.camera.target = [...value.camera.position]; },
      (value) => { value.flipY = 1; },
      (value) => { value.schemaVersion = 2; },
    ];
    for (const change of changes) {
      const invalid = JSON.parse(JSON.stringify(before)); change(invalid);
      expect(tools.restoreSnapshot(invalid)).toBe(false); expect(tools.getSnapshot()).toEqual(before);
    }
  });
  it('按钮和鼠标控制变化合并通知，监听方拿不到可变对象引用', async () => {
    const { tools, camera, controls } = fixture(), received = [];
    const off = tools.subscribe((snapshot) => received.push(snapshot));
    tools.rotate('x'); tools.flip('y');
    expect(received).toHaveLength(0); await Promise.resolve();
    expect(received).toHaveLength(1); expect(received[0]).toEqual(tools.getSnapshot());
    camera.position.x += 10; controls.dispatchEvent({ type: 'change' }); await Promise.resolve();
    expect(received).toHaveLength(2);
    received[1].object.position[0] = 999; expect(tools.getSnapshot().object.position[0]).toBe(2);
    off(); tools.rotate('x'); await Promise.resolve(); expect(received).toHaveLength(2);
  });
  it('卸载前同步通知最终视角，恢复共享对象的动作不能覆盖保存值', async () => {
    const { tools, object, controls } = fixture(), received = [];
    tools.subscribe((snapshot) => received.push(snapshot));
    tools.rotate('x'); tools.flip('x'); const final = tools.getSnapshot();
    tools.dispose();
    expect(received).toEqual([final]); expect(object.rotation.x).toBe(0); expect(object.scale.x).toBe(2);
    controls.dispatchEvent({ type: 'change' }); await Promise.resolve();
    expect(received).toEqual([final]); expect(tools.getSnapshot()).toBe(null);
    expect(tools.restoreSnapshot(final)).toBe(false);
  });
});
