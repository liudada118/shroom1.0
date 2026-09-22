import React from 'react';
import gsap from 'gsap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortalMonitoringLayer from './PortalMonitoringLayer';

const hooks = vi.hoisted(() => ({ effects: [] }));
vi.mock('react', async (original) => {
  const actual = await original();
  return { ...actual, useRef: (current) => ({ current }), useState: (value) => [value, vi.fn()],
    useLayoutEffect: (effect) => hooks.effects.push(effect) };
});
vi.mock('./scene/monitoringSurface', () => ({ waitForMonitoringSurface: () => Promise.resolve() }));

let reducedMotion = true;
const browser = { matchMedia: (query) => ({ matches: query.includes('no-preference') ? !reducedMotion : reducedMotion,
  addListener: vi.fn() }) };
const cleanups = [];

/** 提供查询与样式边界；GSAP context、timeline、Promise 完成和清理均使用真实库。 */
function node(extra = {}) {
  return { dataset: {}, style: {}, opacity: 1, x: 0, y: 0, inert: false,
    querySelector: vi.fn(() => null), querySelectorAll: vi.fn(() => []), ...extra };
}

/** 让粒子返回停在异步边界，以检查动画结束与卸载的竞态。 */
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

/** 注入 React 挂载后的 refs，再执行实际布局 effect，保留组件暴露的全部返回入口。 */
function mount({ directEntry = false, canvas = null, capturePreview = vi.fn(), panelPresent = true } = {}) {
  const preview = node();
  const panel = panelPresent ? node({ querySelector: vi.fn(() => preview) }) : null;
  const backdrop = node({ querySelector: vi.fn(() => panel), '--portal-return-opacity': 0 });
  const navigation = node({ focus: vi.fn() });
  const root = node({ closest: () => backdrop, '--portal-return-background': 1,
    querySelector: vi.fn((selector) => selector.includes('navigation') ? navigation
      : selector === '.portal-data-renderer canvas' ? fixture.canvas : null),
    querySelectorAll: vi.fn(() => [navigation]) });
  const content = node({ opacity: 0, inert: true });
  const onBack = vi.fn();
  const onPreviewChange = vi.fn();
  const fixture = { canvas, root, content, panel, backdrop, preview, onBack, onPreviewChange };
  const tree = PortalMonitoringLayer({ component: () => null, system: { label: '测试传感器' },
    directEntry, capturePreview, onBack, onPreviewChange });
  tree.props.ref.current = root;
  const [nav, body] = tree.props.children;
  body.props.ref.current = content;
  fixture.buttons = [nav.props.children[0].props.children[0].props.onClick,
    nav.props.children[1].props.onClick, body.props.children[1].props.onPortalBack];
  const cleanup = hooks.effects.pop()();
  let mounted = true;
  /** 模拟一次真实卸载，不让 afterEach 重复清理已卸载的实例。 */
  fixture.unmount = () => { if (mounted) { mounted = false; cleanup(); } };
  cleanups.push(fixture.unmount);
  return fixture;
}

/** 手动推进真实 GSAP timeline，不依赖 Node 的墙钟或逐帧定时。 */
async function finishAnimations() {
  gsap.globalTimeline.getChildren(false, true, true).forEach((animation) => animation.totalProgress(1));
  await Promise.resolve();
  await Promise.resolve();
}

describe('监测页面返回系统列表', () => {
  beforeEach(() => {
    reducedMotion = true;
    hooks.effects.length = 0;
    vi.stubGlobal('window', browser);
    vi.stubGlobal('getComputedStyle', (target) => ({ opacity: String(target.opacity) }));
    gsap.ticker.wake();
    gsap.ticker.sleep();
  });
  afterEach(() => {
    cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    vi.unstubAllGlobals();
  });

  it.each([[0, true], [1, true], [2, true], [0, false], [1, false], [2, false]])('非直达页面返回入口 %s、减少动画=%s 时重复点击只返回一次', async (entry, reduced) => {
    reducedMotion = reduced;
    const fixture = mount();
    await Promise.resolve();
    await finishAnimations();
    expect(fixture.root.dataset.handoff).toBe('complete');
    expect(() => fixture.buttons[entry]()).not.toThrow();
    fixture.buttons[entry]();
    await finishAnimations();
    expect(fixture.onBack).toHaveBeenCalledOnce();
    expect(fixture.onPreviewChange).toHaveBeenLastCalledWith(true);
    expect(fixture.backdrop.querySelector).not.toHaveBeenCalled();
  });

  it.each([true, false])('直达页面存在列表面板=%s 时都能完成降级返回并清理标记', async (panelPresent) => {
    const fixture = mount({ directEntry: true, panelPresent });
    await Promise.resolve();
    await finishAnimations();
    fixture.buttons[0]();
    expect(fixture.backdrop.dataset.monitorReturn).toBe(panelPresent ? 'true' : undefined);
    await finishAnimations();
    expect(fixture.onBack).toHaveBeenCalledOnce();
    fixture.unmount();
    expect(fixture.backdrop.dataset.monitorReturn).toBeUndefined();
  });

  it('粒子入口重建画布后使用新渲染器，并等待实际反向播放结束再返回', async () => {
    const source = { points: [] };
    const entranceApi = { play: vi.fn(() => Promise.resolve()) };
    const fixture = mount({ canvas: node({ shroomParticleEntrance: entranceApi }), capturePreview: () => source });
    await Promise.resolve();
    await Promise.resolve();
    const reverse = deferred();
    const returnApi = { play: vi.fn(() => reverse.promise) };
    fixture.canvas = node({ shroomParticleEntrance: returnApi });
    fixture.buttons[2]();
    await finishAnimations();
    expect(entranceApi.play).toHaveBeenCalledOnce();
    expect(returnApi.play).toHaveBeenCalledWith(source, expect.objectContaining({ reverse: true }));
    expect(fixture.onBack).not.toHaveBeenCalled();
    reverse.resolve();
    await finishAnimations();
    expect(fixture.onBack).toHaveBeenCalledOnce();
  });

  it('渲染器不接收粒子交接时仍通过淡出返回', async () => {
    const api = { play: vi.fn(() => null) };
    const fixture = mount({ directEntry: true, canvas: node({ shroomParticleEntrance: api }), capturePreview: () => ({}) });
    await Promise.resolve();
    await finishAnimations();
    fixture.buttons[0]();
    await finishAnimations();
    expect(api.play).toHaveBeenCalledTimes(2);
    expect(fixture.onBack).toHaveBeenCalledOnce();
  });

  it('粒子退场中卸载会取消旧回调，重新进入仍能返回', async () => {
    const reverse = deferred();
    const api = { play: vi.fn((_source, options) => options.reverse ? reverse.promise : Promise.resolve()) };
    const fixture = mount({ canvas: node({ shroomParticleEntrance: api }), capturePreview: () => ({}) });
    await Promise.resolve();
    await Promise.resolve();
    fixture.buttons[0]();
    await finishAnimations();
    const signal = api.play.mock.lastCall[1].signal;
    fixture.unmount();
    expect(signal.aborted).toBe(true);
    reverse.resolve();
    await finishAnimations();
    expect(fixture.onBack).not.toHaveBeenCalled();
    const next = mount();
    await Promise.resolve();
    await finishAnimations();
    next.buttons[0]();
    await finishAnimations();
    expect(next.onBack).toHaveBeenCalledOnce();
  });
});
