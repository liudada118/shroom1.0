import { describe, expect, it } from 'vitest';
import { buildWorkspaceDisplayProfileModel, resolveWorkspaceRendererId } from './manifestWorkspaceRenderers.js';
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
    expect(model.renderers.map((item) => item.id)).toEqual(['pointGrid', 'numMatrix', 'numMatrix2d', 'webglHeatmap', 'blobHeatmap']);
    expect(JSON.stringify(page)).toBe(before);
  });

  it('保留原生自定义参数、Agent 渲染器与坐标，不混淆二维数字和原生三维数字', () => {
    const page = { renderers: [{ id: 'pointGrid', type: 'pointGrid', params: { size: 4 } }] };
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 1, cols: 2 }, coordinateMap: [[[0, 0], [2, 0]]] },
      [{ rendererId: 'agent-renderer:seat:main', label: '座椅' }]);
    expect(model.renderers[0].params).toMatchObject({ size: 4 });
    expect(model.renderers.at(-1).id).toBe('agent-renderer:seat:main');
    expect(resolveWorkspaceRendererId('matrix')).toBe('pointGrid');
    expect(resolveWorkspaceRendererId('numMatrix')).toBe('numMatrix');
  });

  it('同一热力图系统可切换真正的二维数字，保留数据源和图表', () => {
    const page = { renderers: [{ id: 'webglHeatmap', type: 'webglHeatmap' }, { id: 'numMatrix2d', type: 'numMatrix' }],
      widgets: [{ id: 'main', type: 'webglHeatmap', source: 'sit' }],
      profiles: [{ id: 'default', renderer: 'webglHeatmap', widgets: ['main'] }], chartCards: [{ metric: 'maxPressure' }] };
    const model = buildWorkspaceDisplayProfileModel(page, { matrix: { rows: 23, cols: 23 } });
    const active = resolveDisplayProfile(model, { rendererId: 'numMatrix2d' });
    expect(active.renderer).toMatchObject({ type: 'numMatrix', params: {
      backend: 'webgl', frameInput: 'raw', manageSidebar: false, gridWidth: 23, gridHeight: 23,
    } });
    expect(active.canvasWidgets).toEqual(page.widgets);
    expect(page.chartCards).toEqual([{ metric: 'maxPressure' }]);
    expect(model.renderers.find((item) => item.id === 'webglHeatmap').label).toBe('热力图');
  });
});
