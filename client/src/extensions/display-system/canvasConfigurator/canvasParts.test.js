import { describe, expect, it } from 'vitest';
import {
  PART_CATEGORIES,
  applyCanvasPart,
  buildCanvasParts,
  createWidgetFromPart,
  createWidgetId,
  isCanvasPartActive,
  isSurfacePartActive,
  moveCanvasWidget,
  partSurface,
  removeCanvasWidget,
  updateCanvasWidgetSource,
  applySurfacePart,
} from './canvasParts';

const BASE_CANVAS = Object.freeze({
  colormap: { id: 'classic' },
  overlays: [],
  widgets: [
    { id: 'main', type: 'heatmap', label: '压力数据', source: 'backData', columnSpan: 8 },
    { id: 'stats', type: 'pressureStats', label: '压力统计', source: 'backData', columnSpan: 4 },
  ],
});

describe('零件清单', () => {
  it('画布的三个类别缺省就有零件', () => {
    const parts = buildCanvasParts();
    ['colormap', 'overlay', 'widget'].forEach((id) => {
      expect(parts[id].length).toBeGreaterThan(0);
    });
  });

  it('每个类别都有对应的零件分组，零件栏不会去读到 undefined', () => {
    const parts = buildCanvasParts({ chartOverlayIds: ['gridLines'] });
    PART_CATEGORIES.forEach((category) => {
      expect(Array.isArray(parts[category.id])).toBe(true);
    });
  });

  it('没接图表表面时不列图表零件，接了才列', () => {
    // 摆一排拖上去没反应的方块比少一类零件更糟，所以调用方不传
    // chartOverlayIds 就一个都不出。
    const without = buildCanvasParts();
    expect(without.chartColormap).toEqual([]);
    expect(without.chartOverlay).toEqual([]);

    const withChart = buildCanvasParts({ chartOverlayIds: ['gridLines', 'peakMarker'] });
    expect(withChart.chartOverlay.map((item) => item.id)).toEqual(['gridLines', 'peakMarker']);
    // 图表配色和画布配色是同一份清单，只换 kind —— 用户不必学两遍。
    expect(withChart.chartColormap.map((item) => item.id))
      .toEqual(withChart.colormap.map((item) => item.id));
    expect(withChart.chartColormap.every((item) => item.kind === 'chartColormap')).toBe(true);
  });

  it('图表卡片零件由调用方注入模板，不传就一个都不列', () => {
    // canvasParts 不反向依赖 components/aside/，模板和 renderers 一个套路。
    expect(buildCanvasParts().chartWidget).toEqual([]);
    expect(buildCanvasParts({ chartTemplates: [] }).chartWidget).toEqual([]);

    const parts = buildCanvasParts({
      chartTemplates: [
        { id: 'raw-total', name: '原始数据总和', description: '全部点求和', preview: [1, 4, 2] },
        { id: 'no-name', preview: null },
        { name: '没有 id 的模板' },
      ],
    });
    expect(parts.chartWidget).toEqual([
      {
        kind: 'chartWidget',
        id: 'raw-total',
        label: '原始数据总和',
        description: '全部点求和',
        previewPoints: [1, 4, 2],
      },
      {
        kind: 'chartWidget',
        id: 'no-name',
        label: 'no-name',
        description: undefined,
        previewPoints: null,
      },
    ]);
  });

  it('colormapIds 收窄可选配色，给空数组时不至于把零件栏清空', () => {
    expect(buildCanvasParts({ colormapIds: ['viridis'] }).colormap.map((item) => item.id))
      .toEqual(['viridis']);
    expect(buildCanvasParts({ colormapIds: [] }).colormap.length).toBeGreaterThan(1);
  });

  it('overlayIds 收窄可选叠加层，主界面只列 3D 场景真能画的那些', () => {
    expect(buildCanvasParts({ overlayIds: ['legend'] }).overlay.map((item) => item.id))
      .toEqual(['legend']);
    // 全部过滤掉时退回完整清单，坏配置不该让这一类变成空栏。
    expect(buildCanvasParts({ overlayIds: ['nope'] }).overlay.length).toBeGreaterThan(1);
    expect(buildCanvasParts({ overlayIds: [] }).overlay.length).toBeGreaterThan(1);
  });

  it('插件渲染器排在内置类型之后，重名不会出现两块方块', () => {
    const parts = buildCanvasParts({
      renderers: [
        { id: 'heatmap', type: 'heatmap', label: '热力图' },
        { id: 'pointGrid', type: 'pointGrid', label: '点阵' },
      ],
    });
    const types = parts.widget.map((item) => item.type);
    expect(types.filter((type) => type === 'heatmap')).toHaveLength(1);
    expect(types.at(-1)).toBe('pointGrid');
  });
});

describe('widget id 生成', () => {
  it('首个同类型用类型名，之后按序号避让', () => {
    expect(createWidgetId('matrix', [])).toBe('matrix');
    expect(createWidgetId('matrix', [{ id: 'matrix' }])).toBe('matrix-2');
    expect(createWidgetId('matrix', [{ id: 'matrix' }, { id: 'matrix-2' }])).toBe('matrix-3');
  });

  it('新 widget 兼容沿用首卡片通道，但显式选择的数据源优先', () => {
    const widget = createWidgetFromPart(
      { kind: 'widget', id: 'matrix', type: 'matrix', label: '数字矩阵', columnSpan: 8 },
      BASE_CANVAS.widgets,
    );
    expect(widget).toEqual({
      id: 'matrix',
      type: 'matrix',
      label: '数字矩阵',
      source: 'backData',
      columnSpan: 8,
    });
    expect(createWidgetFromPart({ kind: 'widget', id: 'matrix' }).source).toBe('sitData');
    expect(createWidgetFromPart(
      { kind: 'widget', id: 'matrix' },
      BASE_CANVAS.widgets,
      { defaultSource: 'seatPressure' },
    ).source).toBe('seatPressure');
    expect(createWidgetFromPart(
      { kind: 'widget', id: 'matrix', source: 'rightPressure' },
      BASE_CANVAS.widgets,
      { defaultSource: 'seatPressure' },
    ).source).toBe('rightPressure');
  });
});

describe('零件落到画布上', () => {
  it('配色是替换', () => {
    const next = applyCanvasPart(BASE_CANVAS, { kind: 'colormap', id: 'viridis' });
    expect(next.colormap.id).toBe('viridis');
    expect(next.widgets).toBe(BASE_CANVAS.widgets);
  });

  it('叠加层是开关：拖两次等于加了又去掉', () => {
    const added = applyCanvasPart(BASE_CANVAS, { kind: 'overlay', id: 'legend' });
    expect(added.overlays).toEqual(['legend']);
    expect(applyCanvasPart(added, { kind: 'overlay', id: 'legend' }).overlays).toEqual([]);
  });

  it('画布组件是追加，id 自动避让', () => {
    const next = applyCanvasPart(BASE_CANVAS, {
      kind: 'widget', id: 'heatmap', type: 'heatmap', label: '热力图', columnSpan: 8,
    });
    expect(next.widgets.map((widget) => widget.id)).toEqual(['main', 'stats', 'heatmap']);
  });

  it('追加组件使用配置器当前选择的数据源，不固定继承第一路', () => {
    const next = applyCanvasPart(BASE_CANVAS, {
      kind: 'widget', id: 'matrix', type: 'matrix', label: '数字矩阵',
    }, { defaultSource: 'seatPressure' });
    expect(next.widgets.at(-1).source).toBe('seatPressure');

    const throughSurface = applySurfacePart(BASE_CANVAS, {
      kind: 'widget', id: 'raw2d', type: 'raw2d', label: '原始二维',
    }, { defaultSource: 'rightPressure' });
    expect(throughSurface.widgets.at(-1).source).toBe('rightPressure');
  });

  it('不认识的零件原样返回，坏 payload 不会破坏画布', () => {
    expect(applyCanvasPart(BASE_CANVAS, { kind: 'placedWidget', id: 'main' })).toBe(BASE_CANVAS);
    expect(applyCanvasPart(BASE_CANVAS, null)).toBe(BASE_CANVAS);
  });
});

describe('已放置组件的增删换序', () => {
  it('可单独修改某张卡片的数据源，其他卡片与画布配置不变', () => {
    const next = updateCanvasWidgetSource(BASE_CANVAS, 'stats', 'seatPressure');
    expect(next.widgets[0]).toBe(BASE_CANVAS.widgets[0]);
    expect(next.widgets[1]).toEqual({
      ...BASE_CANVAS.widgets[1],
      source: 'seatPressure',
    });
    expect(next.colormap).toBe(BASE_CANVAS.colormap);
    expect(updateCanvasWidgetSource(BASE_CANVAS, 'ghost', 'seatPressure')).toBe(BASE_CANVAS);
    expect(updateCanvasWidgetSource(BASE_CANVAS, 'stats', '')).toBe(BASE_CANVAS);
  });

  it('拖出画布即删除', () => {
    expect(removeCanvasWidget(BASE_CANVAS, 'stats').widgets.map((item) => item.id))
      .toEqual(['main']);
  });

  it('拖到另一张卡片上换序', () => {
    expect(moveCanvasWidget(BASE_CANVAS, 'stats', 'main').widgets.map((item) => item.id))
      .toEqual(['stats', 'main']);
  });

  it('id 不存在或原地不动时原样返回', () => {
    expect(moveCanvasWidget(BASE_CANVAS, 'main', 'main')).toBe(BASE_CANVAS);
    expect(moveCanvasWidget(BASE_CANVAS, 'ghost', 'main')).toBe(BASE_CANVAS);
  });
});

describe('零件高亮', () => {
  it('按类别判断是否已生效', () => {
    expect(isCanvasPartActive(BASE_CANVAS, { kind: 'colormap', id: 'classic' })).toBe(true);
    expect(isCanvasPartActive(BASE_CANVAS, { kind: 'colormap', id: 'viridis' })).toBe(false);
    expect(isCanvasPartActive(BASE_CANVAS, { kind: 'overlay', id: 'legend' })).toBe(false);
    expect(isCanvasPartActive(BASE_CANVAS, { kind: 'widget', id: 'heatmap', type: 'heatmap' })).toBe(true);
    expect(isCanvasPartActive(BASE_CANVAS, { kind: 'widget', id: 'matrix', type: 'matrix' })).toBe(false);
  });
});

describe('零件表面归属', () => {
  const CHART = Object.freeze({ colormap: { id: 'classic' }, overlays: [], widgets: [] });

  it('chart* 前缀的零件落在图表表面，其余落在画布', () => {
    expect(partSurface({ kind: 'chartColormap', id: 'viridis' })).toBe('chart');
    expect(partSurface({ kind: 'chartOverlay', id: 'gridLines' })).toBe('chart');
    expect(partSurface({ kind: 'colormap', id: 'viridis' })).toBe('canvas');
    expect(partSurface({ kind: 'widget', id: 'matrix' })).toBe('canvas');
    expect(partSurface(null)).toBe('canvas');
  });

  it('图表卡片是第三块表面，绝不写进任何配置', () => {
    // 它写的是 shroom.formulaCharts.v1.* 那个键，不是纯值变换。真被当成
    // widget 追加进 canvas.widgets，画布上就会多出一个没人渲染的卡片。
    const part = { kind: 'chartWidget', id: 'raw-total' };
    expect(partSurface(part)).toBe('chartWidget');
    expect(applySurfacePart(BASE_CANVAS, part)).toBe(BASE_CANVAS);
    expect(applySurfacePart(CHART, part)).toBe(CHART);
    // 高亮也不能落到 widget 那条分支上去比 type，那是另一套 id 空间。
    expect(isSurfacePartActive(BASE_CANVAS, part)).toBe(false);
  });

  it('图表零件复用画布的语义：配色替换、叠加层开关', () => {
    const colored = applySurfacePart(CHART, { kind: 'chartColormap', id: 'inferno' });
    expect(colored.colormap.id).toBe('inferno');
    const on = applySurfacePart(CHART, { kind: 'chartOverlay', id: 'gridLines' });
    expect(on.overlays).toEqual(['gridLines']);
    // 再拖一次移除，和画布叠加层一样是开关而不是追加。
    expect(applySurfacePart(on, { kind: 'chartOverlay', id: 'gridLines' }).overlays).toEqual([]);
  });

  it('图表零件不会写进画布配置', () => {
    // 两块表面各存各的，换曲线配色不该把压力图也换掉，反之亦然。
    const canvasValue = { colormap: { id: 'classic' }, overlays: [], widgets: [] };
    const next = applySurfacePart(canvasValue, { kind: 'colormap', id: 'viridis' });
    expect(next.colormap.id).toBe('viridis');
    expect(applySurfacePart(CHART, { kind: 'chartColormap', id: 'thermal' }).colormap.id)
      .toBe('thermal');
    expect(CHART.colormap.id).toBe('classic');
  });

  it('高亮按各自表面判断', () => {
    const chart = { colormap: { id: 'thermal' }, overlays: ['axes'], widgets: [] };
    expect(isSurfacePartActive(chart, { kind: 'chartColormap', id: 'thermal' })).toBe(true);
    expect(isSurfacePartActive(chart, { kind: 'chartColormap', id: 'viridis' })).toBe(false);
    expect(isSurfacePartActive(chart, { kind: 'chartOverlay', id: 'axes' })).toBe(true);
    expect(isSurfacePartActive(chart, { kind: 'chartOverlay', id: 'gridLines' })).toBe(false);
    // 基础 kind 的行为与原来完全一致。
    expect(isSurfacePartActive(BASE_CANVAS, { kind: 'colormap', id: 'classic' }))
      .toBe(isCanvasPartActive(BASE_CANVAS, { kind: 'colormap', id: 'classic' }));
  });
});
