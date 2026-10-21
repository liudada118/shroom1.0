import { describe, expect, it } from 'vitest';
import { buildWorkspaceDisplayProfileModel, buildWorkspaceViewOptions, resolveWorkspaceRendererId } from './manifestWorkspaceRenderers.js';
import { resolveDisplayProfile } from './displayProfileRuntime.js';

describe('统一矩阵工作区渲染', () => {
  it.each(['heatmap', 'matrix', 'raw2d'])('旧 %s 配置和已保存偏好都回落到原生点图，保留输入与算法', (type) => {
    const page = {
      renderers: [{ id: 'old-renderer', type }],
      widgets: [{ id: 'main', type, source: 'seat', columnSpan: 12 }],
      profiles: [{ id: 'default', renderer: 'old-renderer', visualizationAlgorithm: 'threshold', widgets: ['main'] }],
      visualizationAlgorithms: [{ id: 'threshold', type: 'threshold', options: { threshold: 10 } }],
      sidebar: { source: 'seat' },
    };
    const before = JSON.stringify(page);
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } });
    const active = resolveDisplayProfile(model, { rendererId: type });
    expect(active.rendererId).toBe('pointGrid');
    expect(active.renderer.params.sit).toMatchObject({ num1: 23, num2: 23 });
    expect(active.algorithmId).toBe('threshold');
    expect(active.canvasWidgets).toEqual(page.widgets);
    expect(model.renderers.map((item) => item.id)).toEqual(['pointGrid', 'numMatrix', 'webglHeatmap', 'blobHeatmap']);
    expect(JSON.stringify(page)).toBe(before);
  });

  it('保留原生自定义参数、Agent 渲染器与坐标，旧数字别名对应原生二维数字', () => {
    const page = { renderers: [{ id: 'pointGrid', type: 'pointGrid', params: { size: 4 } }] };
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 1, cols: 2 }, coordinateMap: [[[0, 0], [2, 0]]] },
      [{ rendererId: 'agent-renderer:seat:main', label: '座椅' }]);
    expect(model.renderers[0].params).toMatchObject({ size: 4 });
    expect(model.renderers.at(-1).id).toBe('agent-renderer:seat:main');
    expect(resolveWorkspaceRendererId('matrix')).toBe('pointGrid');
    expect(resolveWorkspaceRendererId('numMatrix')).toBe('numMatrix');
    expect(resolveWorkspaceRendererId('numMatrix2d')).toBe('numMatrix');
  });

  it('同一热力图系统可切换真正的二维数字，保留数据源和图表', () => {
    const page = { renderers: [{ id: 'webglHeatmap', type: 'webglHeatmap' }, { id: 'numMatrix2d', type: 'numMatrix' }],
      widgets: [{ id: 'main', type: 'webglHeatmap', source: 'sit' }],
      profiles: [{ id: 'default', renderer: 'webglHeatmap', widgets: ['main'] }], chartCards: [{ metric: 'maxPressure' }] };
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } });
    const active = resolveDisplayProfile(model, { rendererId: resolveWorkspaceRendererId('numMatrix2d') });
    expect(active.renderer).toMatchObject({ type: 'numMatrix', params: {
      backend: 'webgl', frameInput: 'raw', manageSidebar: false, gridWidth: 23, gridHeight: 23,
      webgl: { whiteOnZero: false, indexRow: true, indexColumn: true },
    } });
    expect(active.canvasWidgets).toEqual(page.widgets);
    expect(page.chartCards).toEqual([{ metric: 'maxPressure' }]);
    expect(model.renderers.find((item) => item.id === 'webglHeatmap').label).toBe('热力图');
  });

  it('常驻入口显示声明的三种模式，一个 main 画布无需复制成三个视图', () => {
    const page = { renderers: [{ id: 'pointGrid', type: 'pointGrid' },
      { id: 'webglHeatmap', type: 'webglHeatmap' }, { id: 'numMatrix2d', type: 'numMatrix' }],
    widgets: [{ id: 'main', type: 'pointGrid', source: 'sit' }],
    profiles: [{ id: 'default', renderer: 'pointGrid', widgets: ['main'] }] };
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 32, cols: 32 } });
    expect(buildWorkspaceViewOptions(page, model.renderers, 'pointGrid')).toEqual([
      { value: 'pointGrid', label: '3D 点图' }, { value: 'webglHeatmap', label: '热力图' },
      { value: 'numMatrix', label: '2D 数字' },
    ]);
    expect(buildWorkspaceViewOptions(page, model.renderers, 'numMatrix').filter((item) => item.value === 'numMatrix'))
      .toEqual([{ value: 'numMatrix', label: '2D 数字' }]);
    expect(page.widgets).toHaveLength(1);
  });

  it('旧重复数字方案、profile 和参数适配原生平面矩阵，不改落盘配置', () => {
    const page = { renderers: [{ id: 'numMatrix2d', type: 'numMatrix', params: {
      backend: 'webgl', frameInput: 'raw', webgl: { variant: 'original',
        rawTranspose: false, indexRow: false, overlayPad: 0, widthRatio: 0.6 },
    } }], profiles: [{ id: 'default', renderer: 'numMatrix2d', widgets: ['main'] }],
    widgets: [{ id: 'main', type: 'numMatrix', source: 'seat' }] };
    const before = JSON.stringify(page);
    const renderer = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } }).renderers[0];
    expect(renderer).toMatchObject({ id: 'numMatrix', label: '2D 数字', params: {
      backend: 'webgl', frameInput: 'raw', gridWidth: 23, gridHeight: 23,
      webgl: { whiteOnZero: false, indexRow: true, indexColumn: true },
    } });
    expect(JSON.stringify(page)).toBe(before);
    expect(resolveDisplayProfile(buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } }), {}).rendererId)
      .toBe('numMatrix');
    page.renderers.push({ id: 'numMatrix', type: 'numMatrix', label: '3D 数字', params: { size: 3 } });
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } });
    expect(model.renderers.filter((item) => item.type === 'numMatrix')).toHaveLength(1);
    expect(model.renderers.find((item) => item.id === 'numMatrix')).toMatchObject({ label: '2D 数字', params: { size: 3 } });
  });

  it('单模式旧配置仍有通用视图入口，旧二维类型不重新出现', () => {
    const page = { renderers: [{ id: 'old', type: 'heatmap' }] };
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } });
    expect(buildWorkspaceViewOptions(page, model.renderers, 'pointGrid').map((item) => item.value))
      .toEqual(['pointGrid', 'numMatrix', 'webglHeatmap', 'blobHeatmap']);
  });
});
