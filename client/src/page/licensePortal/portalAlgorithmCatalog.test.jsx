import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { compileFormulaChartExpression } from '../../components/aside/formulaChartRuntime';
import { FORMULA_CHART_TEMPLATES } from '../../components/aside/formulaChartTemplates';
import { addFormulaChartFromTemplate, loadFormulaCharts, removeFormulaChart } from '../../components/aside/formulaChartStore';
import PortalAlgorithmMarket from './PortalAlgorithmMarket';
import { buildPortalAlgorithmTemplates, PORTAL_ALGORITHM_DRAG_TYPE, readPortalAlgorithmDrop } from './portalAlgorithmCatalog';

beforeEach(() => localStorage.clear());

describe('参考式算法超市接入真实宿主能力', () => {
  it('复用平台的六个计算模板，不移入参考稿的模拟指标', () => {
    const templates = buildPortalAlgorithmTemplates();
    expect(templates.map(({ id, formula }) => ({ id, formula }))).toEqual(FORMULA_CHART_TEMPLATES.map(({ id, formula }) => ({ id, formula })));
    const frame = { rawData: [0, 10, 20, 30], matrix: { rows: 2, cols: 2 } };
    expect(compileFormulaChartExpression(templates.find((item) => item.id === 'raw-peak').formula)(frame)).toBe(30);
    expect(compileFormulaChartExpression(templates.find((item) => item.id === 'active-points').formula)(frame)).toBe(3);
  });

  it('当前系统声明的算法指标只读取对应输出，不用压力趋势代替呼吸', () => {
    const metric = buildPortalAlgorithmTemplates([{ id: 'breath-rate', label: '呼吸频率', unit: '次/分', decimals: 1 }]).at(-1);
    expect(metric).toMatchObject({ id: 'algorithm-output:breath_rate', name: '呼吸频率', unit: '次/分', group: '算法输出' });
    const evaluate = compileFormulaChartExpression(metric.formula);
    expect(evaluate({ rawData: [800, 1000], algorithmMetrics: { 'breath-rate': 17 } })).toBe(17);
    expect(evaluate({ rawData: [0, 0], algorithmMetrics: { 'breath-rate': 17 } })).toBe(17);
  });

  it('旧视图只接统计时使用实际指标，不拿空矩阵套用 rawMax/countAbove', () => {
    const templates = buildPortalAlgorithmTemplates([], 'statistics');
    const input = { values: [], rawData: [], metrics: { totalPressure: 131072, averagePressure: 128, maxPressure: 128, activePoints: 1024 } };
    expect(templates).toHaveLength(4);
    expect(templates.map((template) => compileFormulaChartExpression(template.formula)(input))).toEqual([131072, 128, 128, 1024]);
    expect(templates.every((template) => template.group === '实时统计')).toBe(true);
    expect(templates.some((template) => template.id === 'center-region')).toBe(false);
  });

  it('无声明不臆造算法，重复 ID 和损坏目录不重复生成', () => {
    expect(buildPortalAlgorithmTemplates(null)).toHaveLength(6);
    expect(buildPortalAlgorithmTemplates([null, {}, { id: 'a-b' }, { id: 'a_b' }])).toHaveLength(7);
  });

  it('拖入只能选择当前目录 ID，拒绝跨系统、未知模板和外部公式', () => {
    const templates = buildPortalAlgorithmTemplates();
    const transfer = { getData: (type) => type === PORTAL_ALGORITHM_DRAG_TYPE ? JSON.stringify({ matrixName: 'hand', templateId: 'raw-peak', formula: 'malicious()' }) : '' };
    expect(readPortalAlgorithmDrop(transfer, 'hand', templates)).toBe(templates[2]);
    expect(readPortalAlgorithmDrop(transfer, 'bed', templates)).toBeNull();
    expect(readPortalAlgorithmDrop(transfer, 'hand', [])).toBeNull();
    expect(readPortalAlgorithmDrop({ getData: () => '{' }, 'hand', templates)).toBeNull();
    expect(readPortalAlgorithmDrop({ getData: () => 'null' }, 'hand', templates)).toBeNull();
  });

  it('超市和宿主图表共用清单，重复点击不新增，删除后可再添加', () => {
    const peak = buildPortalAlgorithmTemplates()[2];
    const first = addFormulaChartFromTemplate('hand', peak);
    expect(first.ok).toBe(true);
    expect(addFormulaChartFromTemplate('hand', peak).reason).toBe('exists');
    expect(loadFormulaCharts('hand')).toHaveLength(1);
    expect(loadFormulaCharts('bed')).toHaveLength(0);
    removeFormulaChart('hand', first.definition.id);
    expect(loadFormulaCharts('hand')).toHaveLength(0);
    expect(addFormulaChartFromTemplate('hand', peak).ok).toBe(true);
  });

  it('关闭后不可聚焦，已添加状态可被辅助技术识别', () => {
    addFormulaChartFromTemplate('hand', buildPortalAlgorithmTemplates()[2]);
    const html = renderToStaticMarkup(<PortalAlgorithmMarket open={false} matrixName="hand" dropTargetRef={{ current: null }} />);
    expect(html).toContain('aria-label="算法超市" aria-hidden="true" inert=""');
    expect(html).toContain('aria-label="已添加峰值压力" aria-pressed="true"');
    expect(html).toContain('算法包设置');
    expect(html).not.toContain('稳态指数');
  });
});
