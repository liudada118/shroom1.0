import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DisplayCanvasConfigurator from './DisplayCanvasConfigurator.jsx';

describe('DisplayCanvasConfigurator widget source controls', () => {
  it('同时展示新增组件默认数据源和每张已放置卡片的数据源选择', () => {
    const html = renderToStaticMarkup(
      <DisplayCanvasConfigurator
        value={{
          colormap: { id: 'classic' },
          overlays: [],
          widgets: [
            { id: 'back-map', type: 'heatmap', label: '靠背压力', source: 'backData' },
          ],
        }}
        onChange={() => {}}
        sourceOptions={[
          { value: 'seatPressure', label: '座椅 · seatPressure' },
          { value: 'backPressure', label: '靠背 · backPressure' },
        ]}
        defaultSource="seatPressure"
        resolveSourceValue={(source) => (source === 'backData' ? 'backPressure' : source)}
      >
        <div>preview</div>
      </DisplayCanvasConfigurator>,
    );

    expect(html).toContain('aria-label="新增组件数据源"');
    expect(html).toContain('aria-label="靠背压力 数据源"');
    expect(html).toContain('座椅 · seatPressure');
    expect(html).toContain('靠背 · backPressure');
    expect(html).toMatch(/value="backPressure" selected=""/);
  });

  it('空画布也先显示新增组件的数据源选择', () => {
    const html = renderToStaticMarkup(
      <DisplayCanvasConfigurator
        value={{ colormap: { id: 'classic' }, overlays: [], widgets: [] }}
        onChange={() => {}}
        sourceOptions={[{ value: 'rightPressure', label: '右手' }]}
      />,
    );

    expect(html).toContain('aria-label="新增组件数据源"');
    expect(html).toContain('右手');
  });
});
