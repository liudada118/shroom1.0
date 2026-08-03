/**
 * index.test.js - 内置渲染器注册验证
 *
 * 除了检查描述符本身，这里还会真正 await loadRenderer()，
 * 用来抓出渲染器模块内部的导入错误与语法错误——描述符校验通过
 * 不代表 load 出来的东西能用。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RENDERER_CAPABILITIES } from './contract';
import {
  getRendererDescriptor,
  listRegistrationFailures,
  listRenderers,
  loadRenderer,
  registerRenderer,
  resetRendererRegistry,
  resolveRendererFromDefinition,
} from './registry';
import { registerBuiltinRenderers } from './index';
import { auditRendererContract, resetContractAudit } from './RendererHost.jsx';
import { LEGACY_PRESETS } from './pointGrid/params';

describe('内置渲染器注册', () => {
  beforeEach(() => {
    resetRendererRegistry();
    registerBuiltinRenderers();
  });

  it('全部内置渲染器注册成功，无失败项', () => {
    expect(listRenderers().length).toBeGreaterThan(0);
    expect(listRegistrationFailures()).toEqual([]);
  });

  it('重复注册是幂等的', () => {
    const before = listRenderers().length;
    registerBuiltinRenderers();
    expect(listRenderers()).toHaveLength(before);
  });

  it('pointGrid 声明了框选与旋转能力', () => {
    const descriptor = getRendererDescriptor('pointGrid');
    expect(descriptor.capabilities).toContain(RENDERER_CAPABILITIES.BOX_SELECT);
    expect(descriptor.capabilities).toContain(RENDERER_CAPABILITIES.ROTATE);
  });

  it('pointGrid 的 normalizeParams 能吃下 matCol / carCol 预设', () => {
    const descriptor = getRendererDescriptor('pointGrid');

    const matCol = descriptor.normalizeParams(LEGACY_PRESETS.matCol);
    expect(matCol.sit).toEqual({ num1: 16, num2: 10, interp: 2, order: 2 });

    const carCol = descriptor.normalizeParams(LEGACY_PRESETS.carCol);
    expect(carCol.sit).toEqual({ num1: 9, num2: 10, interp: 2, order: 4 });
  });

  it('渲染器模块可以真正加载出一个组件', async () => {
    const component = await loadRenderer('pointGrid');
    expect(component).toBeTruthy();
    // forwardRef 组件是对象而非函数，两者都接受
    expect(['function', 'object']).toContain(typeof component);
  });

  it('manifest 声明 pointGrid 时能解析出渲染器与参数', () => {
    const resolved = resolveRendererFromDefinition({
      page: {
        defaultProfile: 'default',
        profiles: [{ id: 'default', renderer: 'main' }],
        renderers: [{ id: 'main', type: 'pointGrid', params: LEGACY_PRESETS.carCol }],
      },
    });

    expect(resolved.rendererId).toBe('pointGrid');
    expect(resolved.params.sit.num1).toBe(9);
    expect(resolved.params.sit.order).toBe(4);
  });

  it('manifest 引用未注册渲染器时回落 null，不影响旧场景分支', () => {
    const resolved = resolveRendererFromDefinition({
      page: { renderers: [{ id: 'main', type: 'wholeChair' }] },
    });
    expect(resolved).toBeNull();
  });

  it('matCol / carCol 两条 legacy 预设挂在描述符上', () => {
    // 这两个不是两个渲染器，是同一个渲染器的两条预设 —— 原文件逐行 diff
    // 只差 sit.num1（16 / 9）与 sit.order（2 / 4）。
    const { presets } = getRendererDescriptor('pointGrid');
    expect(presets.matCol.sit.num1).toBe(16);
    expect(presets.matCol.sit.order).toBe(2);
    expect(presets.carCol.sit.num1).toBe(9);
    expect(presets.carCol.sit.order).toBe(4);
  });
});

describe('descriptor.methods 是真契约', () => {
  const fullInstance = () => Object.fromEntries(
    getRendererDescriptor('pointGrid').methods.map((name) => [name, () => {}]),
  );

  beforeEach(() => {
    resetRendererRegistry();
    registerBuiltinRenderers();
    resetContractAudit();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('声明齐、实现齐时不报任何东西', () => {
    const result = auditRendererContract('pointGrid', fullInstance());
    expect(result).toEqual({ missing: [], undeclared: [] });
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('声明了却没实现 → error。这是最难查的一类 bug', () => {
    // 宿主侧全是 `this.com.current?.xxx()`，方法名对不上只会静默 no-op，
    // 现象是"这个展示形式没数据"。
    const instance = fullInstance();
    delete instance.sitData;
    delete instance.reset;

    const result = auditRendererContract('pointGrid', instance);
    expect(result.missing).toEqual(['sitData', 'reset']);
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error.mock.calls[0][0]).toContain('sitData、reset');
  });

  it('实现了却没声明 → warn，说明契约在漂移', () => {
    const result = auditRendererContract('pointGrid', {
      ...fullInstance(),
      changeWsData147: () => {},
    });
    expect(result.undeclared).toEqual(['changeWsData147']);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('未声明的方法**不会被挡掉** —— 只报不挡是有意的', () => {
    // 挡掉会引入一个新的静默失败模式：descriptor 漏写一行，功能就没了。
    const instance = { ...fullInstance(), changeWsData147: () => 'still here' };
    auditRendererContract('pointGrid', instance);
    expect(instance.changeWsData147()).toBe('still here');
  });

  it('同一个渲染器只报一次，不刷屏', () => {
    const instance = fullInstance();
    delete instance.sitData;
    auditRendererContract('pointGrid', instance);
    expect(auditRendererContract('pointGrid', instance)).toBeNull();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('没声明 methods 的渲染器不审计 —— 不强迫所有插件立刻补声明', () => {
    registerRenderer({ id: 'noContract', load: () => Promise.resolve({ default: () => null }) });
    expect(auditRendererContract('noContract', { whatever: () => {} })).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('实例为 null 时不抛错（懒加载那一瞬 ref 还是空的）', () => {
    expect(() => auditRendererContract('pointGrid', null)).not.toThrow();
    expect(auditRendererContract('pointGrid', null)).toBeNull();
  });
});
