import { describe, expect, it } from 'vitest';
import {
  CHART_OVERLAY_IDS,
  buildSparklinePath,
  drawChartDecorations,
  drawChartGrid,
  findPeakIndex,
  formatTick,
  hasOverlay,
  resolveChartStroke,
} from './chartAppearance';
import { sampleColormapRgb } from '../../extensions/display-system/colormaps';

/**
 * 记录调用的假 2D 上下文。测试环境是 node，没有真的 canvas；
 * 这里只需要证明"该画的画了、不该画的一笔没动"。
 */
function createStubContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  const context = {
    calls,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillText: record('fillText'),
    setLineDash: record('setLineDash'),
    createLinearGradient: (...args) => {
      const stops = [];
      calls.push(['createLinearGradient', ...args]);
      return { stops, addColorStop: (offset, color) => stops.push([offset, color]) };
    },
  };
  return context;
}

const names = (context) => context.calls.map(([name]) => name);

describe('图表曲线描边', () => {
  it('classic 继续用原来那个纯色', () => {
    // 老界面的曲线是 2px 纯色，观感一个像素都不能变，所以 classic
    // 必须原样返回传入的颜色、连 createLinearGradient 都不调。
    const context = createStubContext();
    ['classic', undefined, null, ''].forEach((id) => {
      expect(resolveChartStroke(context, {
        height: 150,
        colormap: id == null ? id : { id },
        fallbackColor: '#991BFA',
      })).toBe('#991BFA');
    });
    expect(names(context)).not.toContain('createLinearGradient');
  });

  it('别的配色换成纵向渐变，低在下高在上', () => {
    const context = createStubContext();
    const gradient = resolveChartStroke(context, {
      height: 150,
      colormap: { id: 'viridis' },
      fallbackColor: '#991BFA',
    });
    // 起点在底边、终点在顶边：曲线的高度就是压力大小，方向必须和压力图的色带一致。
    expect(context.calls[0]).toEqual(['createLinearGradient', 0, 150, 0, 0]);
    expect(gradient.stops[0][0]).toBe(0);
    expect(gradient.stops.at(-1)[0]).toBe(1);
    const [red, green, blue] = sampleColormapRgb('viridis', 0);
    expect(gradient.stops[0][1]).toBe(`rgb(${red} ${green} ${blue})`);
  });

  it('拿不到 createLinearGradient 时退回纯色而不是抛错', () => {
    expect(resolveChartStroke({}, {
      height: 150,
      colormap: { id: 'viridis' },
      fallbackColor: '#991BFA',
    })).toBe('#991BFA');
  });
});

describe('图表叠加层', () => {
  it('没开网格就一笔不画', () => {
    const context = createStubContext();
    drawChartGrid(context, { width: 300, height: 150, overlays: [] });
    expect(context.calls).toEqual([]);
  });

  it('开了网格才画横竖线', () => {
    const context = createStubContext();
    drawChartGrid(context, { width: 300, height: 150, overlays: ['gridLines'] });
    expect(names(context)).toContain('stroke');
    expect(context.calls.filter(([name]) => name === 'moveTo').length).toBeGreaterThan(1);
  });

  it('一个叠加层都没开时装饰层直接返回', () => {
    const context = createStubContext();
    drawChartDecorations(context, {
      width: 300,
      height: 150,
      overlays: [],
      data: [10, 40, 20],
      gap: 75,
      values: [1, 4, 2],
      color: '#991BFA',
    });
    expect(context.calls).toEqual([]);
  });

  it('峰值标记落在曲线最高点上', () => {
    const context = createStubContext();
    drawChartDecorations(context, {
      width: 300,
      height: 150,
      overlays: ['peakMarker'],
      data: [10, 40, 20],
      gap: 75,
      values: [1, 4, 2],
      color: '#991BFA',
    });
    // 横坐标沿用 drawChart 的 gap * (i + 1)：峰值在下标 1，所以 x = 150；
    // 纵坐标是 height - data[1] = 110。算错就等于标记飘在曲线外面。
    const arcs = context.calls.filter(([name]) => name === 'arc');
    expect(arcs[0].slice(1, 3)).toEqual([150, 110]);
    expect(arcs).toHaveLength(2);
  });

  it('坐标刻度标最大最小值，数值标签标末值', () => {
    const context = createStubContext();
    drawChartDecorations(context, {
      width: 300,
      height: 150,
      overlays: ['axes', 'valueLabels'],
      data: [10, 40, 20],
      gap: 75,
      values: [1.25, 4, 2],
      color: '#991BFA',
    });
    const texts = context.calls.filter(([name]) => name === 'fillText').map(([, text]) => text);
    expect(texts).toEqual(['4', '1.3', '2']);
  });

  it('save/restore 配对，不把样式泄给后面的绘制', () => {
    // drawChart 在装饰层之后还要画那条虚线游标，样式泄漏会让它变色变虚实。
    const context = createStubContext();
    drawChartDecorations(context, {
      width: 300,
      height: 150,
      overlays: ['axes'],
      data: [10, 40],
      gap: 100,
      values: [1, 4],
      color: '#991BFA',
    });
    expect(names(context).filter((name) => name === 'save')).toHaveLength(1);
    expect(names(context).at(-1)).toBe('restore');
  });

  it('数据为空时不画', () => {
    const context = createStubContext();
    drawChartDecorations(context, {
      width: 300, height: 150, overlays: ['axes', 'peakMarker'], data: [], gap: 1, values: [], color: '#fff',
    });
    expect(context.calls).toEqual([]);
  });
});

describe('图表叠加层清单', () => {
  it('不列图例 —— 300x150 的小画布放不下色带，画上去只会盖住曲线', () => {
    expect(CHART_OVERLAY_IDS).not.toContain('legend');
    expect(CHART_OVERLAY_IDS).toEqual(['gridLines', 'axes', 'peakMarker', 'valueLabels']);
  });

  it('Set 和数组两种写法都认', () => {
    expect(hasOverlay(new Set(['axes']), 'axes')).toBe(true);
    expect(hasOverlay(['axes'], 'axes')).toBe(true);
    expect(hasOverlay(null, 'axes')).toBe(false);
    expect(hasOverlay(undefined, 'axes')).toBe(false);
  });
});

describe('峰值与刻度文本', () => {
  it('峰值取绘制高度的最大项，同高取靠前那个', () => {
    expect(findPeakIndex([1, 9, 3])).toBe(1);
    expect(findPeakIndex([9, 9])).toBe(0);
    expect(findPeakIndex([])).toBe(-1);
    expect(findPeakIndex(null)).toBe(-1);
  });

  it('刻度文本压到画布放得下的长度', () => {
    expect(formatTick(1234.5)).toBe('1235');
    expect(formatTick(12)).toBe('12');
    expect(formatTick(1.234)).toBe('1.2');
    expect(formatTick(Number.NaN)).toBe('--');
    expect(formatTick(undefined)).toBe('--');
  });
});

describe('缩略曲线', () => {
  it('首点是 M、后续是 L，横向铺满整个画框', () => {
    const path = buildSparklinePath([1, 2, 3], 100, 32);
    const commands = path.split(' L ');
    expect(commands[0].startsWith('M ')).toBe(true);
    expect(commands).toHaveLength(3);
    expect(path.startsWith('M 0.00 ')).toBe(true);
    expect(path).toContain('100.00');
  });

  it('值全相同也画得出一条线，不会除零', () => {
    const path = buildSparklinePath([5, 5, 5], 100, 32);
    expect(path.split(' L ')).toHaveLength(3);
    expect(path).not.toContain('NaN');
  });

  it('单点和空序列都不抛错', () => {
    expect(buildSparklinePath([7], 100, 32)).toBe('M 0.00 28.00');
    expect(buildSparklinePath([])).toBe('');
    expect(buildSparklinePath(null)).toBe('');
    expect(buildSparklinePath(undefined)).toBe('');
  });
});
