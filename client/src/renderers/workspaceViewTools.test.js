import { describe, expect, it, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, EventDispatcher, Group, PerspectiveCamera, Points, Vector3 } from 'three';
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

/** 倾斜、偏置且几何中心不在原点的点图，贴近旧场景「group 里放一张 particles」的结构。 */
function planeFixture() {
  const group = new Group(), camera = new PerspectiveCamera(40, 1, 1, 10000);
  group.position.set(5, 150, 230); group.rotation.x = -Math.PI / 6; camera.position.set(0, 400, 600);
  // 3 列 × 2 行，x 方向带旧场景那种逐列偏移，所以几何中心不在原点。
  const positions = new Float32Array([-150, 0, -100, -30, 0, -100, 90, 0, -100, -150, 0, 0, -30, 0, 0, 90, 0, 0]);
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const particles = new Points(geometry); particles.scale.setScalar(0.5); particles.rotation.x = Math.PI / 3;
  group.add(particles);
  const controls = Object.assign(new EventDispatcher(), { target: new Vector3(), update: vi.fn(), reset: vi.fn() });
  const tools = createWorkspaceViewTools({ object: group, camera, controls, plane: particles });
  /** 第 index 个顶点的世界坐标。 */
  const world = (index) => {
    particles.updateWorldMatrix(true, false);
    return new Vector3().fromBufferAttribute(geometry.getAttribute('position'), index).applyMatrix4(particles.matrixWorld);
  };
  /** 点图中心，以及平面内朝「列增大」「行增大」的两个方向。 */
  const frame = () => ({ center: world(0).add(world(5)).multiplyScalar(0.5),
    right: world(2).sub(world(0)).normalize(), down: world(3).sub(world(0)).normalize() });
  return { group, particles, positions, camera, controls, tools, world, frame };
}

describe('原生展示视角工具', () => {
  it('没有点图平面的场景不提供旋转 90°，状态里的圈数恒为 0', () => {
    const { tools } = fixture();
    expect(tools.rotateQuarter).toBeUndefined();
    expect(tools.getState().quarterTurns).toBe(0); expect(tools.getSnapshot().quarterTurns).toBe(0);
  });
  it('旋转 90° 是整幅画面绕点图法线顺时针转：中心不动、顶点数据不动、四次回到原位', () => {
    const { tools, positions, frame, group } = planeFixture();
    group.updateWorldMatrix(true, true);
    const source = Array.from(positions), start = frame(), initial = group.matrixWorld.clone();
    const normal = start.down.clone().cross(start.right).normalize();
    expect(tools.rotateQuarter()).toBe(true);
    const turned = frame();
    expect(turned.center.distanceTo(start.center)).toBeLessThan(1e-9);
    // 原来朝右的一行现在朝下，原来朝下的一列现在朝左：从法线一侧看是顺时针。
    expect(turned.right.dot(start.down)).toBeCloseTo(1, 9); expect(turned.down.dot(start.right)).toBeCloseTo(-1, 9);
    expect(turned.down.clone().cross(turned.right).normalize().dot(normal)).toBeCloseTo(1, 9);
    expect(Array.from(positions)).toEqual(source);
    expect(tools.getState()).toMatchObject({ quarterTurns: 1, selectionSafe: false });
    tools.rotateQuarter(); tools.rotateQuarter(); expect(tools.getState().quarterTurns).toBe(3);
    tools.rotateQuarter();
    expect(tools.getState()).toMatchObject({ quarterTurns: 0, selectionSafe: true });
    group.updateWorldMatrix(true, true);
    group.matrixWorld.elements.forEach((value, index) => expect(value).toBeCloseTo(initial.elements[index], 9));
    expect(tools.rotateQuarter(-1)).toBe(true); expect(tools.getState().quarterTurns).toBe(3);
    expect(tools.rotateQuarter(0)).toBe(false); expect(tools.rotateQuarter(NaN)).toBe(false);
  });
  it('转过 90° 后水平翻转仍是当前画面的左右翻，再点一次回到翻转前', () => {
    const { tools, frame, group } = planeFixture();
    tools.rotateQuarter();
    group.updateWorldMatrix(true, true);
    const before = frame(), pose = group.matrixWorld.clone();
    tools.flip('x');
    const after = frame();
    // 此时屏幕左右对应数据的「行增大」方向：它反了，另一条方向不变，点图平面本身不变。
    expect(after.down.dot(before.down)).toBeCloseTo(-1, 9); expect(after.right.dot(before.right)).toBeCloseTo(1, 9);
    // 镜像之后再转 3 圈与「转 1 圈之后左右翻」是同一幅画面，所以圈数记成 3。
    expect(tools.getState()).toMatchObject({ flipX: true, flipY: false, quarterTurns: 3 });
    expect(tools.getSnapshot()).toMatchObject({ flipX: true, flipY: false, quarterTurns: 3 });
    tools.flip('x');
    expect(tools.getState()).toMatchObject({ flipX: false, flipY: false, quarterTurns: 1 });
    group.updateWorldMatrix(true, true);
    group.matrixWorld.elements.forEach((value, index) => expect(value).toBeCloseTo(pose.elements[index], 9));
    // 转 180° 与镜像可交换，圈数不变。
    tools.rotateQuarter(); tools.flip('y');
    expect(tools.getState()).toMatchObject({ flipX: false, flipY: true, quarterTurns: 2 });
  });
  it('转过之后点俯视，画面仍保持旋转后的方向', () => {
    const { particles, camera, controls, world } = planeFixture();
    const tools = createWorkspaceViewTools({ object: particles, camera, controls, localPlane: true });
    /** 「列增大」方向在屏幕上的指向：x 为右、y 为上。 */
    const screenRight = () => {
      camera.updateMatrixWorld(true);
      const direction = world(2).sub(world(0)).normalize().transformDirection(camera.matrixWorldInverse);
      // 加 0 把舍入出来的 -0 归成 0，方向只看落在哪条屏幕轴上。
      return [Math.round(direction.x) + 0, Math.round(direction.y) + 0];
    };
    tools.top(); expect(screenRight()).toEqual([1, 0]);
    tools.rotateQuarter(); tools.top();
    // 顺时针转一圈后，原来朝右的一行朝下。
    expect(screenRight()).toEqual([0, -1]);
    tools.rotateQuarter(); tools.top(); expect(screenRight()).toEqual([-1, 0]);
    tools.reset(); tools.top(); expect(screenRight()).toEqual([1, 0]);
  });
  it('旋转 90° 随快照保存与恢复，恢复视角和卸载都回到没转的状态', () => {
    const first = planeFixture();
    first.tools.rotateQuarter(); first.tools.flip('y');
    const saved = first.tools.getSnapshot();
    expect(validateWorkspaceViewSnapshot(saved)).toBe(true); expect(saved).toMatchObject({ flipY: true, quarterTurns: 3 });
    const second = planeFixture();
    expect(second.tools.restoreSnapshot(JSON.parse(JSON.stringify(saved)))).toBe(true);
    expect(second.tools.getState()).toEqual(first.tools.getState());
    second.group.updateWorldMatrix(true, true); first.group.updateWorldMatrix(true, true);
    second.group.matrixWorld.elements.forEach((value, index) => expect(value).toBeCloseTo(first.group.matrixWorld.elements[index], 9));
    second.tools.reset();
    expect(second.tools.getState()).toEqual({ available: true, flipX: false, flipY: false, quarterTurns: 0, selectionSafe: true });
    first.tools.dispose();
    expect(first.group.position.toArray()).toEqual([5, 150, 230]); expect(first.tools.rotateQuarter()).toBe(false);
    // 旧版本存下的快照没有圈数，按没转恢复；圈数非法的整体拒绝。
    const legacy = planeFixture(), old = legacy.tools.getSnapshot(); delete old.quarterTurns;
    legacy.tools.rotateQuarter();
    expect(legacy.tools.restoreSnapshot(old)).toBe(true); expect(legacy.tools.getState().quarterTurns).toBe(0);
    for (const bad of [4, -1, 1.5, '1']) expect(legacy.tools.restoreSnapshot({ ...old, quarterTurns: bad })).toBe(false);
  });
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
    expect(tools.getState()).toEqual({ available: true, flipX: true, flipY: true, quarterTurns: 0, selectionSafe: false });
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
