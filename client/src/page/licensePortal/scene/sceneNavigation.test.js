import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionSceneFraming } from './sceneNavigation';

describe('常驻粒子镜头往返', () => {
  let root;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('document', { documentElement: { dataset: {} } });
    root = new EventTarget();
    root.getBoundingClientRect = () => ({ x: 0, y: 0, width: 800, height: 600 });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('先捕获当前模型，再改变布局，等待实际镜头完成事件', async () => {
    const calls = [];
    root.addEventListener('system-scene:framing-capture', () => calls.push('capture'));
    root.addEventListener('system-scene:framing-transition', (event) => calls.push(event.detail.framing));
    const done = vi.fn();
    const promise = transitionSceneFraming(root, () => calls.push('layout')).then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    expect(calls).toEqual(['capture', 'layout', 'focused']);
    root.dispatchEvent(new Event('system-scene:framing-complete'));
    await promise;
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('隐藏窗口不永久等待动画，返回时支持反向镜头', async () => {
    const listener = vi.fn();
    root.addEventListener('system-scene:framing-transition', listener);
    const promise = transitionSceneFraming(root, vi.fn(), undefined, 'preview');
    await vi.advanceTimersByTimeAsync(1500);
    await promise;
    expect(listener.mock.calls[0][0].detail.framing).toBe('preview');
  });
  it('取消后清理动画等待，已取消操作不改变布局', async () => {
    const controller = new AbortController();
    const update = vi.fn();
    const promise = transitionSceneFraming(root, update, controller.signal);
    controller.abort();
    await promise;
    await transitionSceneFraming(root, update, controller.signal);
    expect(update).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('减少动画或无预览时仍完成布局而不等待 WebGL', async () => {
    window.matchMedia = () => ({ matches: true });
    const update = vi.fn();
    await transitionSceneFraming(root, update);
    await transitionSceneFraming(null, update);
    expect(update).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
