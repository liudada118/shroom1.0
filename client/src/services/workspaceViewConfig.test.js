import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDispatcher, Group, PerspectiveCamera, Vector3 } from 'three';
import { createWorkspaceViewTools } from '../renderers/workspaceViewTools';
import { bindWorkspaceViewPersistence, readWorkspaceViewConfig, writeWorkspaceViewConfig, workspaceViewStorageKey } from './workspaceViewConfig';

const disposals = [];
/** 用真实变换对象及事件控制器检查持久化往返，不需要 WebGL 或设备连接。 */
function scene(options = { systemId: 'smallBedNoAlg', mode: 'normal' }) {
  const object = new Group(), camera = new PerspectiveCamera(40, 1, 1, 10000), controls = new EventDispatcher();
  object.position.set(2, 5, 6); camera.position.set(0, 100, 200);
  const initial = camera.position.clone();
  controls.target = new Vector3();
  controls.update = () => camera.lookAt(controls.target);
  controls.reset = () => { camera.position.copy(initial); camera.up.set(0, 1, 0); controls.target.set(0, 0, 0); controls.update(); };
  const view = createWorkspaceViewTools({ object, camera, controls }), rendererRef = { current: { getViewTools: () => view } };
  const binding = bindWorkspaceViewPersistence({ rendererRef, ...options });
  disposals.push(() => { binding.dispose(); view.dispose(); });
  return { view, object, camera, controls, binding, rendererRef };
}

describe('视角与镜像按系统/模式持久化', () => {
  beforeEach(() => {
    localStorage.clear(); vi.useFakeTimers();
    const lifecycle = new EventTarget();
    for (const name of ['addEventListener', 'removeEventListener', 'dispatchEvent']) vi.stubGlobal(name, lifecycle[name].bind(lifecycle));
  });
  afterEach(() => { while (disposals.length) disposals.pop()(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('旋转、镜像、缩放和鼠标镜头在新场景中恢复，静止时不反复保存', async () => {
    const first = scene(), write = vi.spyOn(localStorage, 'setItem');
    first.view.rotate('x'); first.view.flip('x'); first.view.flip('y'); first.view.zoom(1);
    first.camera.position.x += 10; first.controls.target.z = 6; first.controls.dispatchEvent({ type: 'change' });
    await vi.advanceTimersByTimeAsync(300);
    const saved = first.view.getSnapshot();
    expect(readWorkspaceViewConfig({ systemId: 'smallBedNoAlg' })).toEqual(saved);
    const writes = write.mock.calls.length; await vi.advanceTimersByTimeAsync(2000);
    expect(write).toHaveBeenCalledTimes(writes);
    first.binding.dispose(); first.view.dispose();
    const reopened = scene();
    expect(reopened.view.getSnapshot()).toEqual(saved);
    expect(reopened.view.getState()).toMatchObject({ flipX: true, flipY: true });
  });

  it('不同系统、副本和显示模式各自保存，恢复视角后再次进入保持默认', async () => {
    const a = scene({ systemId: 'copy-a', mode: 'normal' }); a.view.rotate('x'); a.view.flip('x');
    await vi.advanceTimersByTimeAsync(300); a.binding.dispose(); a.view.dispose();
    for (const options of [{ systemId: 'copy-b' }, { systemId: 'hand' }, { systemId: 'copy-a', mode: 'gloveTerrain' }]) {
      const other = scene(options);
      expect(other.view.getState().flipX).toBe(false); expect(other.object.rotation.x).toBe(0);
    }
    const reopened = scene({ systemId: 'copy-a', mode: 'normal' });
    expect(reopened.view.getState().flipX).toBe(true);
    reopened.view.reset(); await vi.advanceTimersByTimeAsync(300);
    reopened.binding.dispose(); reopened.view.dispose();
    const reset = scene({ systemId: 'copy-a', mode: 'normal' });
    expect(reset.object.rotation.x).toBeCloseTo(0); expect(reset.view.getState().flipX).toBe(false);
  });

  it('工具栏没有打开也能等异步画布就绪恢复，卸载前最后一击不会丢失', async () => {
    const options = { systemId: 'async', mode: 'normal' }, original = scene(options);
    original.view.rotate('x'); original.view.flip('y');
    const expected = original.view.getSnapshot();
    original.view.dispose(); original.binding.dispose();
    expect(readWorkspaceViewConfig(options)).toEqual(expected);
    const rendererRef = { current: null }, binding = bindWorkspaceViewPersistence({ rendererRef, ...options });
    disposals.push(() => binding.dispose());
    const loaded = scene({ systemId: 'isolated-loading' }); loaded.binding.dispose();
    rendererRef.current = { getViewTools: () => loaded.view };
    await vi.advanceTimersByTimeAsync(250);
    expect(loaded.view.getSnapshot()).toEqual(expected);
  });

  it('刷新前冲刷尚未防抖保存的变化，并释放旧画布监听', async () => {
    const original = scene(); original.view.flip('x');
    globalThis.dispatchEvent(new Event('pagehide'));
    expect(readWorkspaceViewConfig({ systemId: 'smallBedNoAlg' }).flipX).toBe(true);
    original.binding.dispose();
    original.view.flip('x'); await vi.advanceTimersByTimeAsync(500);
    expect(readWorkspaceViewConfig({ systemId: 'smallBedNoAlg' }).flipX).toBe(true);
  });

  it('坏缓存或存储拒绝只影响记忆，不改变可用视角和原系统默认值', async () => {
    const options = { systemId: 'bad' };
    localStorage.setItem(workspaceViewStorageKey(options), '{invalid');
    expect(readWorkspaceViewConfig(options)).toBeNull();
    const current = scene(options);
    const bad = current.view.getSnapshot(); bad.camera.position[0] = Infinity;
    expect(writeWorkspaceViewConfig(options, bad)).toBe(false);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(current.view.rotate('x')).toBe(true); expect(current.view.flip('y')).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(current.view.getState()).toMatchObject({ available: true, flipY: true });
  });
});
