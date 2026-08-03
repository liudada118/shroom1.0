import { describe, expect, it } from 'vitest';
import {
  buildFormulaChartContext,
  compileFormulaChartExpression,
  createFormulaChartFunctionSource,
  describeFormulaChartExpression,
  extractFormulaChartExpression,
} from './formulaChartRuntime';

const input = {
  values: [0, 10, 20, 30],
  metrics: {
    totalPressure: 60,
    averagePressure: 20,
    maxPressure: 30,
    activePoints: 3,
    area: 6.3,
  },
  algorithmMetrics: {
    supportRate: 88.5,
  },
  matrix: {
    rows: 2,
    cols: 2,
  },
  frame: 12,
};

describe('formulaChartRuntime', () => {
  it('构建标准变量和算法指标作用域', () => {
    expect(buildFormulaChartContext(input)).toMatchObject({
      total: 60,
      avg: 20,
      max: 30,
      points: 3,
      area: 6.3,
      frame: 12,
      rawLength: 4,
      rows: 2,
      cols: 2,
      algorithm_supportRate: 88.5,
    });
  });

  it('计算基础统计公式', () => {
    const evaluate = compileFormulaChartExpression('total / max(points, 1)');
    expect(evaluate(input)).toBe(20);
  });

  it('使用固定 calculate 函数并兼容旧版表达式', () => {
    const source = createFormulaChartFunctionSource('sum()');
    expect(source).toBe('function calculate(rawData) {\n  return sum();\n}');
    expect(extractFormulaChartExpression(source)).toBe('sum()');
    expect(compileFormulaChartExpression(source)(input)).toBe(60);
    expect(describeFormulaChartExpression(source)).toBe('全部原始点的总和');
  });

  it('将串口原始数据作为 calculate 的 rawData 入参', () => {
    const evaluate = compileFormulaChartExpression(
      'function calculate(rawData) { return rawData[2] + sum(); }'
    );
    expect(evaluate({ ...input, rawData: [1, 2, 3] })).toBe(9);
    expect(describeFormulaChartExpression('rawData[1]')).toContain('原始点');
  });

  it('支持单点、区间和阈值函数', () => {
    expect(compileFormulaChartExpression('point(2) + sum(1, 3)')(input)).toBe(80);
    expect(compileFormulaChartExpression('average(1, 3)')(input)).toBe(20);
    expect(compileFormulaChartExpression('countAbove(15)')(input)).toBe(2);
  });

  it('直接聚合原始矩阵、行列和矩形区域', () => {
    expect(compileFormulaChartExpression('sum()')(input)).toBe(60);
    expect(compileFormulaChartExpression('raw(2) + rawMax()')(input)).toBe(50);
    expect(compileFormulaChartExpression('rowSum(1)')(input)).toBe(50);
    expect(compileFormulaChartExpression('columnSum(1)')(input)).toBe(40);
    expect(compileFormulaChartExpression('regionSum(0, 1, 1, 1)')(input)).toBe(40);
    expect(compileFormulaChartExpression('regionAverage(0, 0, 1, 1)')(input)).toBe(15);
  });

  it('支持原始矩阵分布统计', () => {
    expect(compileFormulaChartExpression('stddev()')(input)).toBeCloseTo(11.1803, 4);
    expect(compileFormulaChartExpression('percentile(50)')(input)).toBe(15);
    expect(compileFormulaChartExpression('countAbove(0) / rawLength * 100')(input)).toBe(75);
  });

  it('支持条件和算法指标', () => {
    const evaluate = compileFormulaChartExpression(
      'if(countAbove(15) == 2, algorithm_supportRate, 0)'
    );
    expect(evaluate(input)).toBe(88.5);
  });

  it('将常用矩阵公式解释成中文', () => {
    expect(describeFormulaChartExpression('sum()')).toBe('全部原始点的总和');
    expect(
      describeFormulaChartExpression('countAbove(0) / max(rawLength, 1) * 100')
    ).toContain('数值大于 0 的原始点数量');
    expect(
      describeFormulaChartExpression('countAbove(0) / max(rawLength, 1) * 100')
    ).toContain('原始数据点数和1中的较大值');
  });

  it('解释点位、区域和命名算法指标', () => {
    expect(describeFormulaChartExpression('raw(2)')).toContain('第 3 个原始点');
    expect(describeFormulaChartExpression('regionAverage(0, 0, 1, 1)'))
      .toContain('区域内所有点的平均值');
    expect(describeFormulaChartExpression('algorithm_supportRate', {
      algorithmMetricDefinitions: [{ id: 'supportRate', label: '支撑率' }],
    })).toBe('算法指标“支撑率”');
  });

  it('拒绝属性访问和动态语句', () => {
    expect(() => compileFormulaChartExpression('Math.max(total, 1)')).toThrow();
    expect(() => compileFormulaChartExpression('total; alert(1)')).toThrow();
    expect(() => compileFormulaChartExpression(
      'function calculate() { const value = sum(); return value; }'
    )).toThrow('计算函数必须使用');
    expect(() => compileFormulaChartExpression(
      'function custom() { return sum(); }'
    )).toThrow('计算函数必须使用');
  });
});
