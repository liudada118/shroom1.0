import { describe, expect, it } from 'vitest';
import {
  buildDisplaySectionPayload,
  clearDisplayDraftSelection,
  describeDisplayDraft,
} from './displayDraftState';
import { buildDisplayProfileModel } from './displayProfileRuntime';

/** 一份最小的 manifest 页面配置，基线是 classic 纯色、无叠加层。 */
const PLAIN_MODEL = buildDisplayProfileModel({
  widgets: [{ id: 'main', type: 'heatmap', label: '压力数据', source: 'sitData' }],
});

/** 一份声明了默认外观和默认卡片的 manifest。 */
const DECLARED_MODEL = buildDisplayProfileModel({
  widgets: [{ id: 'main', type: 'heatmap' }],
  canvas: { colormap: 'thermal', overlays: ['legend'] },
  chartAppearance: { colormap: 'viridis', overlays: ['gridLines'] },
});

const PEAK_CARD = Object.freeze({ templateId: 'raw-peak', name: '峰值压力', formula: 'rawMax()' });
const TOTAL_CARD = Object.freeze({ templateId: 'raw-total', name: '原始数据总和', formula: 'sum()' });

const labels = (result) => result.changes.map((change) => change.label);

describe('脏判定', () => {
  it('什么都没存过就不脏', () => {
    expect(describeDisplayDraft({ model: PLAIN_MODEL })).toEqual({ dirty: false, changes: [] });
  });

  it('没有 model 时不脏 —— 老展示系统还没解析出来也不该弹状态带', () => {
    expect(describeDisplayDraft({ selection: { canvas: { colormap: 'viridis' } } }))
      .toEqual({ dirty: false, changes: [] });
    expect(describeDisplayDraft()).toEqual({ dirty: false, changes: [] });
  });

  it('只换配色时只列一条，带上新旧配色的中文名', () => {
    const result = describeDisplayDraft({
      model: PLAIN_MODEL,
      selection: { canvas: { colormap: { id: 'thermal' } } },
    });
    expect(result.dirty).toBe(true);
    expect(labels(result)).toEqual(['配色：热成像 → 经典蓝红']);
  });

  it('翻转也算改动，文案上标出来', () => {
    const result = describeDisplayDraft({
      model: PLAIN_MODEL,
      selection: { canvas: { colormap: { id: 'viridis', reverse: true } } },
    });
    expect(labels(result)).toEqual(['配色：Viridis（翻转） → 经典蓝红']);
  });

  it('拖走又拖回原值后不脏', () => {
    // 这条是关键：判定看的是解析结果，不是"localStorage 键在不在"。
    // 否则用户把配色拖回默认值之后，状态带还会一直亮着"有未保存的改动"。
    const result = describeDisplayDraft({
      model: DECLARED_MODEL,
      selection: { canvas: { colormap: 'thermal', overlays: ['legend'] } },
    });
    expect(result).toEqual({ dirty: false, changes: [] });
  });

  it('顺序不同的同一组叠加层不算改动', () => {
    const model = buildDisplayProfileModel({
      widgets: [{ id: 'main', type: 'heatmap' }],
      canvas: { overlays: ['legend', 'gridLines'] },
    });
    expect(describeDisplayDraft({
      model,
      selection: { canvas: { overlays: ['gridLines', 'legend'] } },
    }).dirty).toBe(false);
  });

  it('只切了渲染方式/可视算法/方案不算脏', () => {
    // 那三个字段是"我在看哪个模式"，不属于草稿层。
    expect(describeDisplayDraft({
      model: PLAIN_MODEL,
      selection: { profileId: 'analysis', rendererId: 'matrix', algorithmId: 'smooth' },
    })).toEqual({ dirty: false, changes: [] });
  });
});

describe('撤销清单的文案', () => {
  it('加上去的叠加层说"移除"，manifest 声明却被关掉的说"恢复"', () => {
    const result = describeDisplayDraft({
      model: DECLARED_MODEL,
      selection: { canvas: { colormap: 'thermal', overlays: ['gridLines'] } },
    });
    expect(labels(result)).toEqual([
      '移除叠加层：网格线',
      '恢复叠加层：图例色带',
    ]);
  });

  it('图表那块表面的文案带"图表"前缀，和画布分得开', () => {
    const result = describeDisplayDraft({
      model: PLAIN_MODEL,
      selection: {
        canvas: { colormap: 'thermal' },
        charts: { colormap: 'inferno', overlays: ['peakMarker'] },
      },
    });
    expect(labels(result)).toEqual([
      '配色：热成像 → 经典蓝红',
      '图表配色：Inferno → 经典蓝红',
      '移除图表叠加层：最大值标记',
    ]);
  });

  it('用户拖出来的卡片说"删除"，manifest 声明却被删掉的说"恢复"', () => {
    const result = describeDisplayDraft({
      model: DECLARED_MODEL,
      selection: {},
      cards: [PEAK_CARD],
      baselineCards: [TOTAL_CARD],
    });
    expect(labels(result)).toEqual([
      '删除图表卡片：峰值压力',
      '恢复图表卡片：原始数据总和',
    ]);
  });

  it('卡片按 templateId 比而不是按 id —— 基线播种时 id 是新 stamp 的', () => {
    expect(describeDisplayDraft({
      model: PLAIN_MODEL,
      cards: [{ ...PEAK_CARD, id: 'runtime-1' }],
      baselineCards: [{ ...PEAK_CARD, id: 'runtime-2' }],
    }).dirty).toBe(false);
  });

  it('早先用弹窗建的卡片没有 templateId，回退按公式比', () => {
    expect(describeDisplayDraft({
      model: PLAIN_MODEL,
      cards: [{ id: 'legacy', name: '我自己建的', formula: 'sum()' }],
      baselineCards: [{ id: 'seeded', name: '原始数据总和', formula: 'sum()' }],
    }).dirty).toBe(false);
  });

  it('坏卡片项不会让判定抛错', () => {
    expect(() => describeDisplayDraft({
      model: PLAIN_MODEL,
      cards: [null, undefined, {}],
      baselineCards: null,
    })).not.toThrow();
  });
});

describe('清理草稿字段', () => {
  it('只删 canvas 和 charts，保留视图选择', () => {
    // 这条是防"撤销把用户正在看的模式也切走"的关键：整键删掉
    // display-profile:<id> 会把 profileId / rendererId / algorithmId 一起带走。
    const cleared = clearDisplayDraftSelection({
      profileId: 'analysis',
      rendererId: 'matrix',
      algorithmId: 'smooth',
      canvas: { colormap: 'viridis' },
      charts: { overlays: ['axes'] },
    });
    expect(cleared).toEqual({
      profileId: 'analysis',
      rendererId: 'matrix',
      algorithmId: 'smooth',
    });
  });

  it('不改原对象，空入参也不抛错', () => {
    const selection = { canvas: { colormap: 'viridis' } };
    clearDisplayDraftSelection(selection);
    expect(selection.canvas).toEqual({ colormap: 'viridis' });
    expect(clearDisplayDraftSelection()).toEqual({});
    expect(clearDisplayDraftSelection(null)).toEqual({});
  });
});

describe('打包保存请求体', () => {
  it('写的是解析后的最终值，不是 selection 原文', () => {
    // selection 里只有配色一个字段，但 manifest 声明过图例。直接把 selection
    // 写进 manifest 会把图例悄悄抹掉 —— 用户看到的是两样，保存下来就该是两样。
    const payload = buildDisplaySectionPayload({
      model: DECLARED_MODEL,
      selection: { canvas: { colormap: 'inferno' } },
    });
    expect(payload.canvas).toEqual({
      colormap: { id: 'inferno', reverse: false },
      overlays: ['legend'],
    });
    // 没动过的图表外观照样带上 manifest 那份，两块表面各写各的。
    expect(payload.chartAppearance).toEqual({
      colormap: { id: 'viridis', reverse: false },
      overlays: ['gridLines'],
    });
  });

  it('不带 canvas.widgets —— 那是"跟随 display.widgets"的意思', () => {
    // 解析时 widgets 被填成了当时那份清单。照原样写回去就成了一份写死的
    // 显式清单，以后改 display.widgets 画布反而跟不上了。
    const payload = buildDisplaySectionPayload({ model: DECLARED_MODEL });
    expect('widgets' in payload.canvas).toBe(false);
  });

  it('卡片只带定义字段，运行时 id 不落盘', () => {
    const payload = buildDisplaySectionPayload({
      model: PLAIN_MODEL,
      cards: [{ id: 'runtime-1', ...PEAK_CARD, unit: 'kPa', decimals: 1 }, null],
    });
    expect(payload.chartCards).toEqual([{
      templateId: 'raw-peak',
      name: '峰值压力',
      formula: 'rawMax()',
      unit: 'kPa',
      decimals: 1,
      color: '',
    }]);
  });

  it('没有卡片时是空数组而不是 undefined', () => {
    // undefined 在后端是"这次不改这一段"，空数组才是"清空"。用户把卡片全删了
    // 再保存，要的是后者。
    expect(buildDisplaySectionPayload({ model: PLAIN_MODEL }).chartCards).toEqual([]);
  });

  it('Agent 图表保存稳定 id、数据源和参数，不伪造公式', () => {
    const payload = buildDisplaySectionPayload({
      model: PLAIN_MODEL,
      cards: [{
        id: 'runtime-agent-chart',
        templateId: 'cop-track',
        name: '重心轨迹',
        agentChartId: 'agent-chart:vitals:cop',
        source: 'seat',
        options: { trail: 60 },
      }],
    });
    expect(payload.chartCards).toEqual([{
      templateId: 'cop-track',
      name: '重心轨迹',
      agentChartId: 'agent-chart:vitals:cop',
      source: 'seat',
      options: { trail: 60 },
    }]);
  });
});
