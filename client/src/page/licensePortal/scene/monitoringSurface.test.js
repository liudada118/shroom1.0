import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForMonitoringSurface } from './monitoringSurface';

describe('入口自动交接压力画布', () => {
  let root;
  let surface;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    surface = { getBoundingClientRect: () => ({ width: 1280, height: 720 }) };
    root = { querySelector: vi.fn(() => surface) };
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('等待有尺寸的同一主画布跨两帧，不取侧栏图表', async () => {
    const done = vi.fn();
    const promise = waitForMonitoringSurface(root).then(done);
    await vi.advanceTimersByTimeAsync(16);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(16);
    await promise;
    expect(done).toHaveBeenCalledOnce();
    expect(root.querySelector).toHaveBeenCalledWith('.portal-data-renderer canvas, .portal-data-renderer svg, .portal-data-renderer iframe');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('异步加载和零尺寸都不提前交接，替换画布重新累计', async () => {
    root.querySelector.mockReturnValue(null);
    const done = vi.fn();
    const promise = waitForMonitoringSurface(root).then(done);
    await vi.advanceTimersByTimeAsync(64);
    root.querySelector.mockReturnValue({ getBoundingClientRect: () => ({ width: 0, height: 720 }) });
    await vi.advanceTimersByTimeAsync(32);
    expect(done).not.toHaveBeenCalled();
    root.querySelector.mockReturnValue(surface);
    await vi.advanceTimersByTimeAsync(16);
    root.querySelector.mockReturnValue({ ...surface });
    await vi.advanceTimersByTimeAsync(16);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(16);
    await promise;
    expect(done).toHaveBeenCalledOnce();
  });
  it('没有主画布时有界降级，显示原生加载或错误状态', async () => {
    root.querySelector.mockReturnValue(null);
    const promise = waitForMonitoringSurface(root);
    await vi.advanceTimersByTimeAsync(4000);
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('手模型必须完成加载后才交接，模型失败也保留有界出口', async () => {
    surface.dataset = { modelState: 'loading' };
    const done = vi.fn();
    const promise = waitForMonitoringSurface(root).then(done);
    await vi.advanceTimersByTimeAsync(80);
    expect(done).not.toHaveBeenCalled();
    surface.dataset.modelState = 'ready';
    await vi.advanceTimersByTimeAsync(32); await promise;
    expect(done).toHaveBeenCalledOnce();
    surface.dataset.modelState = 'loading';
    const timeout = waitForMonitoringSurface(root);
    await vi.advanceTimersByTimeAsync(4000); await timeout;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('取消或卸载清理轮询，已取消操作不再开始等待', async () => {
    const controller = new AbortController();
    const promise = waitForMonitoringSurface(root, controller.signal);
    controller.abort();
    await promise;
    await waitForMonitoringSurface(root, controller.signal);
    expect(vi.getTimerCount()).toBe(0);
    expect(root.querySelector).not.toHaveBeenCalled();
  });
  it('原生大模型超过旧等待上限仍衔接实际模型，超时则显示错误并清理', async () => {
    surface.dataset = { modelState: 'loading' };
    surface.shroomSceneLoading = { fail: vi.fn() };
    const done = vi.fn();
    const promise = waitForMonitoringSurface(root).then(done);
    await vi.advanceTimersByTimeAsync(5000);
    expect(done).not.toHaveBeenCalled();
    surface.dataset.modelState = 'ready';
    await vi.advanceTimersByTimeAsync(32); await promise;
    expect(surface.shroomSceneLoading.fail).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    surface.dataset.modelState = 'loading';
    const timeout = waitForMonitoringSurface(root);
    await vi.advanceTimersByTimeAsync(30000); await timeout;
    expect(surface.shroomSceneLoading.fail).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
