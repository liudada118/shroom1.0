import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORMULA_CHART_LIMIT,
  addFormulaChartFromTemplate,
  clampFormulaChartDecimals,
  findChartByTemplate,
  formulaChartStorageKey,
  formulasMatch,
  hasFormulaCharts,
  listFormulaChartTemplateIds,
  loadFormulaCharts,
  removeFormulaChart,
  resetFormulaCharts,
  saveFormulaCharts,
  subscribeFormulaCharts,
} from './formulaChartStore';
import { createFormulaChartFunctionSource } from './formulaChartRuntime';

const TOTAL = Object.freeze({
  id: 'raw-total',
  name: '原始数据总和',
  formula: createFormulaChartFunctionSource('sum()'),
  unit: '',
  decimals: 2,
  color: '#7C5CFC',
});

const PEAK = Object.freeze({
  id: 'raw-peak',
  name: '峰值压力',
  formula: createFormulaChartFunctionSource('rawMax()'),
  unit: '',
  decimals: 2,
  color: '#E0565B',
});

/** 造一个能占满上限的模板清单。 */
function filler(index) {
  return {
    id: `filler-${index}`,
    name: `占位 ${index}`,
    formula: createFormulaChartFunctionSource(`sum() + ${index}`),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('图表清单读写', () => {
  it('空存储返回空数组', () => {
    expect(loadFormulaCharts('m32')).toEqual([]);
  });

  it('坏 JSON 和非数组都返回空数组，不抛错', () => {
    // 一个过期或被别的版本写坏的键值，不该让整个侧栏渲染不出来。
    localStorage.setItem(formulaChartStorageKey('m32'), '{ 不是 JSON');
    expect(loadFormulaCharts('m32')).toEqual([]);
    localStorage.setItem(formulaChartStorageKey('m32'), '{"id":"x"}');
    expect(loadFormulaCharts('m32')).toEqual([]);
  });

  it('缺 id 或缺公式的条目直接丢掉', () => {
    saveFormulaCharts('m32', [
      { id: 'a', formula: 'sum()' },
      { id: 'b' },
      { formula: 'sum()' },
      null,
    ]);
    expect(loadFormulaCharts('m32').map((item) => item.id)).toEqual(['a']);
  });

  it('不同 matrixName 各存各的', () => {
    addFormulaChartFromTemplate('m32', TOTAL);
    expect(loadFormulaCharts('m32')).toHaveLength(1);
    expect(loadFormulaCharts('m64')).toEqual([]);
    // 键名要能容纳中文和斜杠这类展示系统名。
    expect(formulaChartStorageKey('压力/垫')).not.toBe(formulaChartStorageKey('压力垫'));
  });
});

describe('按模板添加', () => {
  it('成功时带上 templateId 和模板的全部外观字段', () => {
    const result = addFormulaChartFromTemplate('m32', TOTAL);
    expect(result.ok).toBe(true);
    expect(result.definition).toMatchObject({
      templateId: 'raw-total',
      name: '原始数据总和',
      formula: TOTAL.formula,
      decimals: 2,
      color: '#7C5CFC',
    });
    expect(result.definition.id).toBeTruthy();
    expect(loadFormulaCharts('m32')).toEqual([result.definition]);
  });

  it('重复添加同一模板什么都不做', () => {
    // 幂等而不是开关：用户可能已经改过这张图的公式，再拖一次删掉等于静默毁掉编辑。
    addFormulaChartFromTemplate('m32', TOTAL);
    const before = loadFormulaCharts('m32');
    const again = addFormulaChartFromTemplate('m32', TOTAL);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('exists');
    expect(loadFormulaCharts('m32')).toEqual(before);
  });

  it('满 6 张后拒绝第 7 张', () => {
    for (let index = 0; index < FORMULA_CHART_LIMIT; index += 1) {
      expect(addFormulaChartFromTemplate('m32', filler(index)).ok).toBe(true);
    }
    const overflow = addFormulaChartFromTemplate('m32', PEAK);
    expect(overflow).toEqual({ ok: false, reason: 'limit' });
    expect(loadFormulaCharts('m32')).toHaveLength(FORMULA_CHART_LIMIT);
  });

  it('坏模板返回 invalid，不写任何东西', () => {
    expect(addFormulaChartFromTemplate('m32', null).reason).toBe('invalid');
    expect(addFormulaChartFromTemplate('m32', { id: 'x' }).reason).toBe('invalid');
    expect(addFormulaChartFromTemplate('m32', { formula: 'sum()' }).reason).toBe('invalid');
    expect(loadFormulaCharts('m32')).toEqual([]);
  });
});

describe('删除', () => {
  it('只删指定 id', () => {
    const first = addFormulaChartFromTemplate('m32', TOTAL).definition;
    const second = addFormulaChartFromTemplate('m32', PEAK).definition;
    expect(removeFormulaChart('m32', first.id)).toBe(true);
    expect(loadFormulaCharts('m32').map((item) => item.id)).toEqual([second.id]);
  });

  it('id 不存在时返回 false，不通知订阅者', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFormulaCharts(listener);
    expect(removeFormulaChart('m32', 'ghost')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('订阅', () => {
  it('写入后收到通知，退订后收不到', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFormulaCharts(listener);
    const added = addFormulaChartFromTemplate('m32', TOTAL).definition;
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('m32', [added]);

    unsubscribe();
    addFormulaChartFromTemplate('m32', PEAK);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('一个订阅者抛错不影响别的订阅者', () => {
    // Home 和 Aside 都订阅同一份清单，其中一个渲染出错不能让另一个收不到通知。
    const broken = vi.fn(() => { throw new Error('boom'); });
    const healthy = vi.fn();
    const offBroken = subscribeFormulaCharts(broken);
    const offHealthy = subscribeFormulaCharts(healthy);
    expect(() => saveFormulaCharts('m32', [])).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
    offBroken();
    offHealthy();
  });

  it('传非函数时返回一个可以安全调用的退订函数', () => {
    expect(() => subscribeFormulaCharts(null)()).not.toThrow();
  });
});

describe('模板匹配', () => {
  it('老定义没有 templateId，靠公式等价也能命中', () => {
    // 这条是防重复添加的关键：早先用 + 号弹窗建的同款图表必须被认出来，
    // 否则拖零件会造出第二张一模一样的卡片，方块也不会高亮。
    saveFormulaCharts('m32', [{ id: 'legacy', name: '我自己建的', formula: 'sum()' }]);
    const hit = findChartByTemplate(loadFormulaCharts('m32'), TOTAL);
    expect(hit?.id).toBe('legacy');
    expect(addFormulaChartFromTemplate('m32', TOTAL).reason).toBe('exists');
    expect(loadFormulaCharts('m32')).toHaveLength(1);
  });

  it('带 templateId 的定义只按 id 命中，改过公式也还认得', () => {
    // 用户进弹窗把公式改成别的之后，这张卡片仍然属于那个模板。
    const added = addFormulaChartFromTemplate('m32', TOTAL).definition;
    saveFormulaCharts('m32', [{ ...added, formula: createFormulaChartFunctionSource('average()') }]);
    expect(findChartByTemplate(loadFormulaCharts('m32'), TOTAL)?.id).toBe(added.id);
    expect(findChartByTemplate(loadFormulaCharts('m32'), PEAK)).toBeNull();
  });

  it('公式比较看归一后的表达式，坏公式返回 false 而不是抛错', () => {
    expect(formulasMatch('sum()', createFormulaChartFunctionSource('sum()'))).toBe(true);
    expect(formulasMatch('sum()', 'average()')).toBe(false);
    expect(formulasMatch('', 'sum()')).toBe(false);
    expect(formulasMatch(null, undefined)).toBe(false);
  });

  it('坏入参返回 null', () => {
    expect(findChartByTemplate(null, TOTAL)).toBeNull();
    expect(findChartByTemplate([], null)).toBeNull();
  });

  it('高亮清单只列已经在侧栏的模板', () => {
    addFormulaChartFromTemplate('m32', PEAK);
    expect(listFormulaChartTemplateIds('m32', [TOTAL, PEAK])).toEqual(['raw-peak']);
    // 传入已知清单时不读盘，省掉零件栏高亮时的一次 JSON.parse。
    expect(listFormulaChartTemplateIds('m32', [TOTAL, PEAK], [])).toEqual([]);
    expect(listFormulaChartTemplateIds('m32', null)).toEqual([]);
  });
});

describe('基线播种与重置', () => {
  it('分得清"键不存在"和"键是空数组"', () => {
    // loadFormulaCharts 对这两种情况都返回 []，但意义完全不同：前者该用
    // manifest 声明的默认卡片播种，后者是用户主动删空了，就该保持空的。
    expect(hasFormulaCharts('m32')).toBe(false);
    saveFormulaCharts('m32', []);
    expect(hasFormulaCharts('m32')).toBe(true);
    expect(loadFormulaCharts('m32')).toEqual([]);
  });

  it('重置按基线重写清单，并给每条 stamp 新 id', () => {
    const added = addFormulaChartFromTemplate('m32', PEAK).definition;
    const next = resetFormulaCharts('m32', [
      { templateId: 'raw-total', name: '原始数据总和', formula: TOTAL.formula },
    ]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ templateId: 'raw-total', name: '原始数据总和', decimals: 2 });
    expect(next[0].id).toBeTruthy();
    expect(next[0].id).not.toBe(added.id);
    expect(next[0].color).toBeTruthy();
    expect(loadFormulaCharts('m32')).toEqual(next);
  });

  it('基线为空就清空，并通知订阅者', () => {
    addFormulaChartFromTemplate('m32', PEAK);
    const listener = vi.fn();
    const unsubscribe = subscribeFormulaCharts(listener);
    expect(resetFormulaCharts('m32')).toEqual([]);
    expect(loadFormulaCharts('m32')).toEqual([]);
    expect(listener).toHaveBeenCalledWith('m32', []);
    unsubscribe();
  });

  it('基线里缺公式的条目被丢掉，超上限被截断', () => {
    const baseline = [
      { templateId: 'no-formula', name: '缺公式' },
      ...Array.from({ length: 8 }, (_, index) => filler(index)),
    ];
    expect(resetFormulaCharts('m32', baseline)).toHaveLength(FORMULA_CHART_LIMIT);
  });
});

describe('小数位归一', () => {
  it('压到 0-6，坏值当 0', () => {
    expect(clampFormulaChartDecimals(3)).toBe(3);
    expect(clampFormulaChartDecimals(-1)).toBe(0);
    expect(clampFormulaChartDecimals(99)).toBe(6);
    expect(clampFormulaChartDecimals('abc')).toBe(0);
    expect(clampFormulaChartDecimals(undefined)).toBe(0);
  });
});
