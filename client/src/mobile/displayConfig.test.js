import { describe, expect, it } from 'vitest';
import { createDemoPressureFrame, mobileDisplayConfig } from './displayConfig.js';
import { validatePressureMessage } from './pressureBridge.js';

describe('移动矩阵展示配置', () => {
  it('热力图复用已有渲染器，1024 点不清边、不镜像、不缩放读数', () => {
    expect(mobileDisplayConfig('heatmap')).toMatchObject({ rendererId: 'webglHeatmap',
      params: { dataWidth: 32, dataHeight: 32, minFrameLength: 1024,
        valueScale: 1, mirrorX: false, edgeClear: null, max: 255 } });
  });

  it('切换数字后走原始矩阵通路，返回热力图保持原配置', () => {
    const heatmap = mobileDisplayConfig('heatmap');
    expect(mobileDisplayConfig('numbers')).toMatchObject({ rendererId: 'numMatrix',
      params: { backend: 'webgl', frameInput: 'raw', gridWidth: 32, gridHeight: 32,
        manageSidebar: false, webgl: { variant: 'original', rawTranspose: false } } });
    expect(mobileDisplayConfig('heatmap')).toEqual(heatmap);
  });

  it('手动演示生成合法完整帧，始终标记 demo 而不是 USB', () => {
    const initial = createDemoPressureFrame(0, 1000);
    const next = createDemoPressureFrame(20, 2000);
    expect(validatePressureMessage(initial)).toMatchObject({ source: 'demo', sequence: 0, timestamp: 1000 });
    expect(initial.values).toHaveLength(1024);
    expect(next.values).not.toEqual(initial.values);
    expect(initial.values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
  });
});
