/**
 * builtins.test.js - 本包 ships 的两个渲染器描述符能不能注册上
 *
 * ## 为什么这条值得单独测
 *
 * `registerRenderer` 对不合法的描述符是**静默失败**：`validateRendererDescriptor`
 * 收集错误 → 返回 `false` → 记进 `listRegistrationFailures()`，**不抛**。这是
 * 有意的（坏插件不该让应用起不来），代价是描述符里写错一个方法名，现象只是
 * "这个展示形式一片空白" + 控制台一行 —— 上一轮补 10 个契约方法名就是踩在
 * 这上面。这里把它变成一条会红的断言。
 *
 * ## 为什么这个测试能在 node 环境里跑
 *
 * `builtins.js` 只 import `core/`（contract / registry / 两份 params），渲染器
 * 本体在 `load: () => import(...)` 里，本测试从不调用它。`backends/canvas2d.js`
 * 同理 —— 它整个文件只依赖 `core/`，DOM 的部分都在工厂函数体内。所以这里不需要
 * jsdom，也不需要装 react 这个 peer 依赖。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { RENDERER_METHODS } from '../core/contract.js';
import {
  getRendererDescriptor,
  listRegistrationFailures,
  resetRendererRegistry,
} from '../core/registry.js';
import createCanvas2dMatrixBackend from './numMatrix/backends/canvas2d.js';
import { registerBuiltinRenderers } from './builtins.js';

/** 所有后端都有的那四个，由 `NumMatrixRenderer` 自己实现，不随后端变。 */
const SHELL_METHODS = ['sitData', 'sitValue', 'changeWsData', 'changeWsDataRaw'];

describe('内置渲染器注册', () => {
  beforeEach(() => {
    resetRendererRegistry();
  });

  it('两个渲染器都能注册上，没有一条校验失败', () => {
    expect(registerBuiltinRenderers()).toBe(2);
    // 失败清单要空 —— 只看返回值会漏掉"注册了 2 个但第 3 个悄悄挂了"的情况。
    expect(listRegistrationFailures()).toEqual([]);
    expect(getRendererDescriptor('numMatrix')).not.toBeNull();
    expect(getRendererDescriptor('pointGrid')).not.toBeNull();
  });

  it('声明的方法名全部在契约里（漏一个就是静默拒绝注册）', () => {
    registerBuiltinRenderers();
    ['numMatrix', 'pointGrid'].forEach((id) => {
      const stray = getRendererDescriptor(id).methods
        .filter((method) => !(method in RENDERER_METHODS));
      expect(stray, `${id} 有契约外的方法名`).toEqual([]);
    });
  });

  it('幂等：重复注册不产生失败记录', () => {
    expect(registerBuiltinRenderers()).toBe(2);
    expect(registerBuiltinRenderers()).toBe(2);
    expect(listRegistrationFailures()).toEqual([]);
  });
});

describe('numMatrix 的 optionalMethods 与 canvas2d 后端对账', () => {
  beforeEach(() => {
    resetRendererRegistry();
    registerBuiltinRenderers();
  });

  /**
   * 这一条是那份"刻意的重复"的对账。
   *
   * `builtins.js` 没有从 `backends/canvas2d.js` import `commandNames`，因为
   * 一旦静态 import 任何后端，`load: () => import(...)` 的懒加载 chunk 就会塌回
   * 主包（Rollup 只发 warning 不报错）。两处各写一遍是选定的方案，代价是会漂 ——
   * 所以由测试来盯。
   */
  it('optionalMethods 与后端的 commandNames 逐字相同', () => {
    const { optionalMethods } = getRendererDescriptor('numMatrix');
    expect(optionalMethods).toEqual(createCanvas2dMatrixBackend.commandNames);
  });

  it('methods 恰好是「壳的四个 + 后端命令」的并集', () => {
    const { methods } = getRendererDescriptor('numMatrix');
    expect([...methods].sort()).toEqual(
      [...SHELL_METHODS, ...createCanvas2dMatrixBackend.commandNames].sort(),
    );
  });

  it('壳的四个方法不在 optionalMethods 里 —— 它们任何后端都必须有', () => {
    const optional = new Set(getRendererDescriptor('numMatrix').optionalMethods);
    SHELL_METHODS.forEach((name) => {
      expect(optional.has(name), `${name} 不该是可选的`).toBe(false);
    });
  });

  it('pointGrid 不声明 optionalMethods —— 它只有一套实现', () => {
    expect(getRendererDescriptor('pointGrid').optionalMethods).toBeUndefined();
  });
});
