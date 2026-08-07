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

  // 逐个 await 每一个注册项而不是只测 pointGrid：这一条抓的是渲染器模块
  // 内部的导入错误（路径写错、拿了个不存在的导出），而描述符校验看不到那些。
  it.each(['pointGrid', 'numMatrix'])('%s 模块可以真正加载出一个组件', async (id) => {
    const component = await loadRenderer(id);
    expect(component).toBeTruthy();
    // forwardRef 组件是对象而非函数，两者都接受
    expect(['function', 'object']).toContain(typeof component);
  });

  it('注册表里每一项都能加载 —— 加了新渲染器忘了补测试也拦得住', async () => {
    const loaded = await Promise.all(listRenderers().map((item) => loadRenderer(item.id)));
    expect(loaded.every(Boolean)).toBe(true);
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

  it('numMatrix 声明 sit 与旋转，不声明框选', () => {
    const descriptor = getRendererDescriptor('numMatrix');
    // ROTATE 是接 canvas2d 后端时加的：`num3D` 那条通路有
    // `changePointRotation` / `changeGroupRotate` / `reset` / `setFrontView`
    // 四个视角命令。走 sprite3d 时没有 —— 能力标记是按渲染器 id 声明的，
    // 这里取的是并集，与 `optionalMethods` 同一个道理。
    expect(descriptor.capabilities).toEqual([
      RENDERER_CAPABILITIES.SIT,
      RENDERER_CAPABILITIES.ROTATE,
    ]);
    expect(descriptor.capabilities).not.toContain(RENDERER_CAPABILITIES.BOX_SELECT);
  });

  it('numMatrix 的 24 条 legacy 预设挂在描述符上，按三个后端分组', () => {
    // 三份 NumThreeColor 的布局公式代数等价（逐点验算见
    // numMatrix/pipeline.test.js），所以它们是同一个渲染器的三条预设；
    // smallBed12B 是第四条，原来靠 `matrixName === 'smallBed12B'` 的字符串分支。
    // 接着两条走 canvas2d 后端，来自 `num/NumWs.jsx`（`carCol` 那支是它的
    // `props.matrixName == 'carCol'` 分支）。
    // 最后 18 条走 webgl 后端：`webglNum*` 五条来自 `num/Num2D.jsx`，
    // `webglRaw*` 十三条来自 `num/Num2Doriginal.jsx` —— 两份原实现的着色器只差
    // 18 行，合成了一个后端 + 四个开关，所以它们的差别全落在预设数据里。
    const { presets, normalizeParams } = getRendererDescriptor('numMatrix');
    expect(Object.keys(presets)).toEqual([
      'fast256', 'fast1024', 'fast1024sit', 'smallBed12B',
      'num3dDefault', 'num3dCarCol',
      'webglNumDefault', 'webglNumCarCol', 'webglNumGlove',
      'webglNumGloveFullPacket', 'webglNumFoot',
      'webglRawDefault', 'webglRawTransposed', 'webglRawCarCol', 'webglRawDaliegu',
      'webglRawSmallSample', 'webglRawTempFullBed', 'webglRawBed4096num',
      'webglRawGlove', 'webglRawGloveFullPacket', 'webglRawFoot',
      'webglRawRobotSY', 'webglRawRobotLCF', 'webglRawRobot1',
    ]);

    // 每条预设归一化后落在哪个后端 —— 这一条比名单更要紧：预设名写错顶多是
    // 找不到，`backend` 写错是画面静默走了另一套实现。
    const byBackend = Object.entries(presets).reduce((acc, [id, preset]) => {
      const backend = normalizeParams(preset).backend;
      (acc[backend] = acc[backend] || []).push(id);
      return acc;
    }, {});
    expect(byBackend.sprite3d.length).toBe(4);
    expect(byBackend.canvas2d.length).toBe(2);
    expect(byBackend.webgl.length).toBe(18);

    expect(normalizeParams(presets.fast256).size).toBe(4);
    expect(normalizeParams(presets.fast1024sit).cameraControls).toBe(false);
    expect(normalizeParams(presets.smallBed12B).decimalScale).toBe(10);
    expect(normalizeParams(presets.num3dDefault).backend).toBe('canvas2d');
    // `original` 变体是 Num2Doriginal 的那一半：掩码 / POT / 零值显白三个开关。
    expect(normalizeParams(presets.webglRawRobotSY).webgl.robot.name).toBe('robotSY');
    expect(normalizeParams(presets.webglNumFoot).webgl.variant).toBe('plain');
  });

  it('manifest 声明 numMatrix 时能解析出渲染器与参数', () => {
    const resolved = resolveRendererFromDefinition({
      page: {
        defaultProfile: 'default',
        profiles: [{ id: 'default', renderer: 'main' }],
        renderers: [{ id: 'main', type: 'numMatrix', params: { gridWidth: 23, gridHeight: 23 } }],
      },
    });

    expect(resolved.rendererId).toBe('numMatrix');
    expect(resolved.params.gridWidth).toBe(23);
    // 用户没填的项由 normalizeParams 补全，manifest 因此可以只写关心的几项。
    expect(resolved.params.backend).toBe('sprite3d');
    expect(resolved.params.chartWindow).toBe(20);
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
