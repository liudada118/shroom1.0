import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ManifestDisplayRenderer from './ManifestDisplayRenderer.jsx';

/** 构造只包含运行页外观测试所需字段的展示定义。 */
const buildDefinition = (runtimeChrome, presentation = 'standard') => ({
  displaySystemId: 'runtime-presentation-test',
  type: 'runtime-presentation-test',
  label: '运行展示测试',
  matrix: { rows: 1, cols: 1 },
  sensors: [],
  page: {
    layout: { columns: 12, presentation },
    controls: runtimeChrome == null ? {} : { runtimeChrome },
    widgets: [],
    canvas: { widgets: [] },
    renderers: [{ id: 'heatmap', type: 'heatmap', label: '热力图' }],
    visualizationAlgorithms: [{ id: 'identity', type: 'identity', label: '原始数据' }],
    profiles: [{
      id: 'default',
      label: '默认方案',
      renderer: 'heatmap',
      visualizationAlgorithm: 'identity',
      widgets: [],
    }],
    defaultProfile: 'default',
  },
});

/** 把运行页渲染成静态标记，只检查宿主界面层级，不启动串口或实时订阅。 */
function renderRuntime(runtimeChrome, presentation) {
  return renderToStaticMarkup(
    <ManifestDisplayRenderer
      definition={buildDefinition(runtimeChrome, presentation)}
      enabled={false}
    />,
  );
}

describe('ManifestDisplayRenderer 运行页外观', () => {
  it('默认只呈现展示画布，不显示重复的运行元数据和方案选择条', () => {
    const html = renderRuntime();

    expect(html).toContain('class="manifest-display is-workspace"');
    expect(html).toContain('data-layout-presentation="workspace"');
    expect(html).toContain('渲染设置');
    expect(html).not.toContain('manifest-display-header');
    expect(html).not.toContain('manifest-profile-menu');
    expect(html).not.toContain('runtime-presentation-test</span>');
  });

  it('显式开启 runtimeChrome 时保留诊断和方案选择能力', () => {
    const html = renderRuntime(true);

    expect(html).toContain('manifest-display-header');
    expect(html).toContain('manifest-profile-menu');
    expect(html).toContain('运行展示测试');
  });

  it('正式沉浸布局字段会落成全宽运行页样式', () => {
    const html = renderRuntime(false, 'immersive');

    expect(html).toContain('class="manifest-display is-immersive"');
    expect(html).toContain('data-layout-presentation="immersive"');
  });

  it('保留图表的铺满布局使用独立 workspace 模式', () => {
    const html = renderRuntime(false, 'workspace');
    expect(html).toContain('class="manifest-display is-workspace"');
    expect(html).toContain('data-layout-presentation="workspace"');
    expect(html).not.toContain('is-immersive');
  });
});
