import { createFormulaChartFunctionSource } from './formulaChartRuntime';

export const FORMULA_CHART_TEMPLATES = Object.freeze([
  {
    id: 'raw-total',
    name: '原始数据总和',
    description: '全部矩阵点求和',
    meaning: '把当前矩阵中的每个原始点相加，得到这一帧的原始数据总和。',
    formula: createFormulaChartFunctionSource('sum()'),
    unit: '',
    decimals: 2,
    color: '#7C5CFC',
    preview: [18, 28, 24, 42, 38, 54, 49, 66],
  },
  {
    id: 'raw-average',
    name: '原始数据平均值',
    description: '全部矩阵点平均',
    meaning: '把全部原始点相加后除以原始点总数，得到当前矩阵的平均值。',
    formula: createFormulaChartFunctionSource('average()'),
    unit: '',
    decimals: 2,
    color: '#1F9D8A',
    preview: [25, 30, 27, 34, 36, 40, 38, 44],
  },
  {
    id: 'raw-peak',
    name: '峰值压力',
    description: '当前矩阵最大点值',
    meaning: '比较当前矩阵中的全部原始点，取数值最大的点作为峰值压力。',
    formula: createFormulaChartFunctionSource('rawMax()'),
    unit: '',
    decimals: 2,
    color: '#E0565B',
    preview: [22, 30, 27, 58, 36, 72, 45, 60],
  },
  {
    id: 'active-points',
    name: '有效点数',
    description: '大于零的矩阵点',
    meaning: '统计当前矩阵中数值大于 0 的原始点数量。',
    formula: createFormulaChartFunctionSource('countAbove(0)'),
    unit: '点',
    decimals: 0,
    color: '#E39A32',
    preview: [12, 16, 15, 23, 27, 29, 25, 31],
  },
  {
    id: 'active-ratio',
    name: '有效点占比',
    description: '有效点占总点数比例',
    meaning: '用数值大于 0 的点数除以原始点总数，再乘以 100 得到百分比。',
    formula: createFormulaChartFunctionSource(
      'countAbove(0) / max(rawLength, 1) * 100'
    ),
    unit: '%',
    decimals: 1,
    color: '#2F86EB',
    preview: [20, 26, 34, 42, 48, 44, 52, 58],
  },
  {
    id: 'center-region',
    name: '中心区域压力',
    description: '矩阵中心区域求和',
    meaning: '取矩阵中间 50% 的矩形区域，并把区域内的全部原始点相加。',
    formula: createFormulaChartFunctionSource(
      'regionSum(floor(rows / 4), floor(cols / 4), '
      + 'ceil(rows * 3 / 4) - 1, ceil(cols * 3 / 4) - 1)'
    ),
    unit: '',
    decimals: 2,
    color: '#C65CAD',
    preview: [14, 20, 34, 56, 62, 48, 39, 31],
  },
]);
