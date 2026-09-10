import { FORMULA_CHART_TEMPLATES } from '../../components/aside/formulaChartTemplates';
import { createFormulaChartFunctionSource } from '../../components/aside/formulaChartRuntime';

export const PORTAL_ALGORITHM_DRAG_TYPE = 'application/x-shroom-portal-algorithm';

// 旧渲染器只向 Aside 提供统计，不把缺失的原始矩阵当成全零矩阵来计算。
const STATISTIC_TEMPLATES = [
  { id: 'metrics-total', name: '压力总和', expression: 'total', description: '当前监测视图的压力总和' },
  { id: 'metrics-average', name: '平均压力', expression: 'avg', description: '沿用当前视图的平均压力口径' },
  { id: 'metrics-peak', name: '峰值压力', expression: 'max', description: '当前监测视图的峰值压力' },
  { id: 'metrics-points', name: '有效点数', expression: 'points', description: '当前监测视图的有效点数', unit: '点', decimals: 0 },
].map(({ expression, ...template }) => ({ ...template, group: '实时统计', formula: createFormulaChartFunctionSource(expression), unit: template.unit || '', decimals: template.decimals ?? 2, color: '#63D5FF', preview: [] }));

/** 超市只列出现有计算模板和当前系统声明的算法输出，不引入参考项目的演示算法。 */
export function buildPortalAlgorithmTemplates(metricDefinitions = [], inputKind = 'matrix') {
  const metrics = new Map();
  for (const metric of Array.isArray(metricDefinitions) ? metricDefinitions : []) {
    const id = String(metric?.id || '').replace(/[^A-Za-z0-9_]/g, '_');
    if (!id || metrics.has(id)) continue;
    metrics.set(id, {
      id: `algorithm-output:${id}`, name: metric.label || metric.id,
      description: '当前系统算法输出，按实际结果形成趋势', group: '算法输出',
      formula: createFormulaChartFunctionSource(`algorithm_${id}`), unit: metric.unit || '',
      decimals: metric.decimals ?? 2, color: '#63D5FF', preview: [],
    });
  }
  const base = inputKind === 'statistics' ? STATISTIC_TEMPLATES
    : FORMULA_CHART_TEMPLATES.map((template) => ({ ...template, group: '矩阵计算' }));
  return [...base, ...metrics.values()];
}

/** 拖放只接受当前系统目录中的模板 ID，跨系统或外部拖入的数据不能生成公式。 */
export function readPortalAlgorithmDrop(dataTransfer, matrixName, templates) {
  try {
    const payload = JSON.parse(dataTransfer.getData(PORTAL_ALGORITHM_DRAG_TYPE));
    if (payload.matrixName !== matrixName) return null;
    return templates.find((template) => template.id === payload.templateId) || null;
  } catch { return null; }
}
