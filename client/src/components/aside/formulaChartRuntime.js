const BASE_VARIABLES = new Set([
  'total',
  'avg',
  'max',
  'points',
  'area',
  'frame',
  'rawLength',
  'rows',
  'cols',
  'PI',
  'E',
]);

const FUNCTION_NAMES = new Set([
  'abs',
  'ceil',
  'floor',
  'round',
  'sqrt',
  'pow',
  'min',
  'max',
  'clamp',
  'if',
  'point',
  'raw',
  'sum',
  'rawSum',
  'average',
  'rawAverage',
  'countAbove',
  'rawCountAbove',
  'rawMax',
  'rawMin',
  'stddev',
  'percentile',
  'rowSum',
  'columnSum',
  'regionSum',
  'regionAverage',
]);

const BINARY_PRECEDENCE = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
  '^': 6,
};

const VARIABLE_DESCRIPTIONS = Object.freeze({
  total: '基础统计中的总压力',
  avg: '基础统计中的平均压力',
  max: '基础统计中的最大压力',
  points: '有效受压点数量',
  area: '受压面积',
  frame: '当前帧序号',
  rawLength: '原始数据点数',
  rows: '矩阵行数',
  cols: '矩阵列数',
  PI: '圆周率 π',
  E: '自然常数 e',
});

const OPERATOR_DESCRIPTIONS = Object.freeze({
  '||': '或者',
  '&&': '并且',
  '==': '等于',
  '!=': '不等于',
  '<': '小于',
  '<=': '小于或等于',
  '>': '大于',
  '>=': '大于或等于',
  '+': '加上',
  '-': '减去',
  '*': '乘以',
  '/': '除以',
  '%': '取余',
  '^': '乘方',
});

const FORMULA_FUNCTION_NAME = 'calculate';
const FORMULA_FUNCTION_PATTERN = new RegExp(
  `^function\\s+${FORMULA_FUNCTION_NAME}\\s*\\(\\s*(?:rawData\\s*)?\\)\\s*`
  + '\\{\\s*return\\s+([\\s\\S]*?)\\s*;?\\s*\\}$'
);

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeAlgorithmMetricId(id) {
  return String(id || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_');
}

/**
 * 提取固定 calculate 函数中的 return 表达式；旧版纯表达式继续兼容。
 */
export function extractFormulaChartExpression(source) {
  const text = String(source || '').trim();
  if (!text) throw new Error('请输入计算函数');
  if (!/^function\b/.test(text)) return text;

  const match = text.match(FORMULA_FUNCTION_PATTERN);
  if (!match?.[1]?.trim()) {
    throw new Error('计算函数必须使用 function calculate(rawData) { return 公式; } 格式');
  }
  return match[1].trim();
}

/**
 * 将旧版表达式或已有函数统一格式化为编辑器使用的安全函数。
 */
export function createFormulaChartFunctionSource(source) {
  const expression = extractFormulaChartExpression(source);
  return `function ${FORMULA_FUNCTION_NAME}(rawData) {\n  return ${expression};\n}`;
}

function tokenize(source) {
  const expression = String(source || '').trim();
  if (!expression) throw new Error('请输入公式');
  if (expression.length > 240) throw new Error('公式不能超过 240 个字符');

  const tokens = [];
  let offset = 0;
  while (offset < expression.length) {
    const rest = expression.slice(offset);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }

    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) });
      offset += number[0].length;
      continue;
    }

    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      offset += identifier[0].length;
      continue;
    }

    const twoCharacterOperator = rest.slice(0, 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(twoCharacterOperator)) {
      tokens.push({ type: 'operator', value: twoCharacterOperator });
      offset += 2;
      continue;
    }

    const character = rest[0];
    if ('+-*/%^<>!(),[]'.includes(character)) {
      const type = '(),[]'.includes(character) ? character : 'operator';
      tokens.push({ type, value: character });
      offset += 1;
      continue;
    }

    throw new Error(`公式包含不支持的字符：${character}`);
  }

  if (tokens.length > 160) throw new Error('公式过于复杂');
  tokens.push({ type: 'end', value: '' });
  return tokens;
}

function createParser(tokens) {
  let offset = 0;
  const current = () => tokens[offset];
  const consume = () => tokens[offset++];

  function parsePrimary() {
    const token = consume();
    if (token.type === 'number') return { type: 'number', value: token.value };

    if (token.type === 'identifier') {
      if (token.value === 'rawData') {
        if (current().type !== '[') {
          throw new Error('rawData 必须使用 rawData[索引] 读取单个原始点');
        }
        consume();
        const index = parseExpression(0);
        if (current().type !== ']') throw new Error('rawData 索引缺少右中括号');
        consume();
        return { type: 'rawIndex', index };
      }
      if (current().type === '(') {
        consume();
        if (!FUNCTION_NAMES.has(token.value)) {
          throw new Error(`不支持函数 ${token.value}`);
        }
        const args = [];
        if (current().type !== ')') {
          do {
            args.push(parseExpression(0));
            if (current().type !== ',') break;
            consume();
          } while (current().type !== 'end');
        }
        if (current().type !== ')') throw new Error(`函数 ${token.value} 缺少右括号`);
        consume();
        return { type: 'call', name: token.value, args };
      }

      if (!BASE_VARIABLES.has(token.value) && !token.value.startsWith('algorithm_')) {
        throw new Error(`不支持变量 ${token.value}`);
      }
      return { type: 'variable', name: token.value };
    }

    if (token.type === '(') {
      const expression = parseExpression(0);
      if (current().type !== ')') throw new Error('公式缺少右括号');
      consume();
      return expression;
    }

    throw new Error('公式结构不完整');
  }

  function parseUnary() {
    const token = current();
    if (token.type === 'operator' && ['+', '-', '!'].includes(token.value)) {
      consume();
      return { type: 'unary', operator: token.value, argument: parseUnary() };
    }
    return parsePrimary();
  }

  function parseExpression(minPrecedence) {
    let left = parseUnary();
    while (current().type === 'operator') {
      const operator = current().value;
      const precedence = BINARY_PRECEDENCE[operator];
      if (!precedence || precedence < minPrecedence) break;
      consume();
      const nextPrecedence = operator === '^' ? precedence : precedence + 1;
      const right = parseExpression(nextPrecedence);
      left = { type: 'binary', operator, left, right };
    }
    return left;
  }

  const ast = parseExpression(0);
  if (current().type !== 'end') throw new Error(`公式在 ${current().value} 附近无法解析`);
  return ast;
}

function normalizeRange(values, startValue, endValue) {
  const lastIndex = Math.max(values.length - 1, 0);
  const start = Math.max(0, Math.min(lastIndex, Math.trunc(toFiniteNumber(startValue, 0))));
  const end = Math.max(start, Math.min(lastIndex, Math.trunc(toFiniteNumber(endValue, lastIndex))));
  return values.slice(start, end + 1);
}

function normalizeMatrixShape(matrix, valueCount) {
  const requestedRows = Math.trunc(toFiniteNumber(matrix?.rows ?? matrix?.height, 0));
  const requestedCols = Math.trunc(toFiniteNumber(matrix?.cols ?? matrix?.width, 0));
  if (requestedRows > 0 && requestedCols > 0) {
    return { rows: requestedRows, cols: requestedCols };
  }
  return {
    rows: valueCount ? 1 : 0,
    cols: valueCount,
  };
}

function normalizeMatrixIndex(value, maximum) {
  return Math.max(0, Math.min(Math.max(maximum - 1, 0), Math.trunc(toFiniteNumber(value, 0))));
}

function getRegionValues(context, rowStart, columnStart, rowEnd, columnEnd) {
  const { values, rows, cols } = context;
  if (!values.length || rows <= 0 || cols <= 0) return [];
  const firstRow = normalizeMatrixIndex(rowStart, rows);
  const lastRow = Math.max(firstRow, normalizeMatrixIndex(rowEnd, rows));
  const firstColumn = normalizeMatrixIndex(columnStart, cols);
  const lastColumn = Math.max(firstColumn, normalizeMatrixIndex(columnEnd, cols));
  const region = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const value = values[(row * cols) + column];
      region.push(toFiniteNumber(value, 0));
    }
  }
  return region;
}

function sumValues(values) {
  return values.reduce((total, value) => total + value, 0);
}

function averageValues(values) {
  return values.length ? sumValues(values) / values.length : 0;
}

function evaluateCall(name, args, context) {
  const { values, rows, cols } = context;
  switch (name) {
    case 'abs': return Math.abs(args[0] || 0);
    case 'ceil': return Math.ceil(args[0] || 0);
    case 'floor': return Math.floor(args[0] || 0);
    case 'round': return Math.round(args[0] || 0);
    case 'sqrt': return Math.sqrt(Math.max(0, args[0] || 0));
    case 'pow': return Math.pow(args[0] || 0, args[1] || 0);
    case 'min': return args.length ? Math.min(...args) : 0;
    case 'max': return args.length ? Math.max(...args) : 0;
    case 'clamp': return Math.max(args[1] || 0, Math.min(args[2] || 0, args[0] || 0));
    case 'if': return args[0] ? (args[1] || 0) : (args[2] || 0);
    case 'point':
    case 'raw': {
      const index = Math.trunc(toFiniteNumber(args[0], -1));
      return index >= 0 && index < values.length ? values[index] : 0;
    }
    case 'sum':
    case 'rawSum': {
      const range = normalizeRange(values, args[0], args[1]);
      return sumValues(range);
    }
    case 'average':
    case 'rawAverage': {
      const range = normalizeRange(values, args[0], args[1]);
      return averageValues(range);
    }
    case 'countAbove':
    case 'rawCountAbove': {
      const threshold = toFiniteNumber(args[0], 0);
      return values.filter((value) => value > threshold).length;
    }
    case 'rawMax': {
      const range = normalizeRange(values, args[0], args[1]);
      return range.length ? Math.max(...range) : 0;
    }
    case 'rawMin': {
      const range = normalizeRange(values, args[0], args[1]);
      return range.length ? Math.min(...range) : 0;
    }
    case 'stddev': {
      const range = normalizeRange(values, args[0], args[1]);
      if (!range.length) return 0;
      const mean = averageValues(range);
      return Math.sqrt(averageValues(range.map((value) => Math.pow(value - mean, 2))));
    }
    case 'percentile': {
      const range = normalizeRange(values, args[1], args[2]).sort((a, b) => a - b);
      if (!range.length) return 0;
      const percentile = Math.max(0, Math.min(100, toFiniteNumber(args[0], 50)));
      const position = (percentile / 100) * (range.length - 1);
      const lower = Math.floor(position);
      const upper = Math.ceil(position);
      if (lower === upper) return range[lower];
      return range[lower] + ((range[upper] - range[lower]) * (position - lower));
    }
    case 'rowSum': {
      const row = normalizeMatrixIndex(args[0], rows);
      return sumValues(getRegionValues(context, row, 0, row, cols - 1));
    }
    case 'columnSum': {
      const column = normalizeMatrixIndex(args[0], cols);
      return sumValues(getRegionValues(context, 0, column, rows - 1, column));
    }
    case 'regionSum':
      return sumValues(getRegionValues(context, args[0], args[1], args[2], args[3]));
    case 'regionAverage':
      return averageValues(getRegionValues(context, args[0], args[1], args[2], args[3]));
    default:
      return 0;
  }
}

function evaluateNode(node, context) {
  if (node.type === 'number') return node.value;
  if (node.type === 'rawIndex') {
    const index = Math.trunc(toFiniteNumber(evaluateNode(node.index, context), -1));
    return index >= 0 && index < context.values.length ? context.values[index] : 0;
  }
  if (node.type === 'variable') return toFiniteNumber(context[node.name], 0);
  if (node.type === 'unary') {
    const value = evaluateNode(node.argument, context);
    if (node.operator === '-') return -value;
    if (node.operator === '!') return value ? 0 : 1;
    return value;
  }
  if (node.type === 'call') {
    return evaluateCall(
      node.name,
      node.args.map((argument) => evaluateNode(argument, context)),
      context
    );
  }

  const left = evaluateNode(node.left, context);
  if (node.operator === '&&' && !left) return 0;
  if (node.operator === '||' && left) return 1;
  const right = evaluateNode(node.right, context);
  switch (node.operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right === 0 ? 0 : left / right;
    case '%': return right === 0 ? 0 : left % right;
    case '^': return Math.pow(left, right);
    case '<': return left < right ? 1 : 0;
    case '<=': return left <= right ? 1 : 0;
    case '>': return left > right ? 1 : 0;
    case '>=': return left >= right ? 1 : 0;
    case '==': return left === right ? 1 : 0;
    case '!=': return left !== right ? 1 : 0;
    case '&&': return right ? 1 : 0;
    case '||': return right ? 1 : 0;
    default: return 0;
  }
}

function describeIndex(node, noun) {
  if (node?.type === 'number' && Number.isInteger(node.value) && node.value >= 0) {
    return `第 ${node.value + 1} ${noun}（索引 ${node.value}）`;
  }
  return `${noun}索引 ${describeNode(node)}`;
}

function describeRawRange(args) {
  if (!args.length) return '全部原始点';
  if (args.length === 1) {
    return `从${describeIndex(args[0], '个原始点')}到最后一个原始点`;
  }
  return `从${describeIndex(args[0], '个原始点')}到${describeIndex(args[1], '个原始点')}`;
}

function describeMatrixPosition(rowNode, columnNode) {
  return `${describeIndex(rowNode, '行')}、${describeIndex(columnNode, '列')}`;
}

function describeCall(node, algorithmLabels) {
  const args = node.args || [];
  const describe = (argument) => describeNode(argument, algorithmLabels);
  const describedArgs = args.map(describe);
  const first = describedArgs[0] || '0';
  const second = describedArgs[1] || '0';
  const third = describedArgs[2] || '0';

  switch (node.name) {
    case 'abs': return `${first}的绝对值`;
    case 'ceil': return `${first}向上取整`;
    case 'floor': return `${first}向下取整`;
    case 'round': return `${first}四舍五入取整`;
    case 'sqrt': return `${first}的平方根`;
    case 'pow': return `${first}的 ${second} 次方`;
    case 'min':
      return describedArgs.length === 2
        ? `${first}和${second}中的较小值`
        : `${describedArgs.join('、')}中的最小值`;
    case 'max':
      return describedArgs.length === 2
        ? `${first}和${second}中的较大值`
        : `${describedArgs.join('、')}中的最大值`;
    case 'clamp': return `把${first}限制在 ${second} 到 ${third} 之间`;
    case 'if':
      return `如果${first}，取${second}；否则取${third}`;
    case 'point':
    case 'raw':
      return `${describeIndex(args[0], '个原始点')}的数值`;
    case 'sum':
    case 'rawSum':
      return `${describeRawRange(args)}的总和`;
    case 'average':
    case 'rawAverage':
      return `${describeRawRange(args)}的平均值`;
    case 'countAbove':
    case 'rawCountAbove':
      return `数值大于 ${first} 的原始点数量`;
    case 'rawMax':
      return `${describeRawRange(args)}中的最大值`;
    case 'rawMin':
      return `${describeRawRange(args)}中的最小值`;
    case 'stddev':
      return `${describeRawRange(args)}的标准差`;
    case 'percentile':
      return `${describeRawRange(args.slice(1))}的第 ${first} 百分位值`;
    case 'rowSum':
      return `${describeIndex(args[0], '行')}所有点的总和`;
    case 'columnSum':
      return `${describeIndex(args[0], '列')}所有点的总和`;
    case 'regionSum':
      return `矩阵从${describeMatrixPosition(args[0], args[1])}到`
        + `${describeMatrixPosition(args[2], args[3])}区域内所有点的总和`;
    case 'regionAverage':
      return `矩阵从${describeMatrixPosition(args[0], args[1])}到`
        + `${describeMatrixPosition(args[2], args[3])}区域内所有点的平均值`;
    default:
      return `${node.name}（${describedArgs.join('、')}）`;
  }
}

function describeNode(node, algorithmLabels = new Map(), isRoot = false) {
  if (!node) return '未指定';
  if (node.type === 'number') return String(node.value);
  if (node.type === 'rawIndex') {
    return `${describeIndex(node.index, '个原始点')}的数值`;
  }
  if (node.type === 'variable') {
    if (VARIABLE_DESCRIPTIONS[node.name]) return VARIABLE_DESCRIPTIONS[node.name];
    if (node.name.startsWith('algorithm_')) {
      const label = algorithmLabels.get(node.name) || node.name.slice('algorithm_'.length);
      return `算法指标“${label}”`;
    }
    return node.name;
  }
  if (node.type === 'unary') {
    const argument = describeNode(node.argument, algorithmLabels);
    if (node.operator === '-') return `负的${argument}`;
    if (node.operator === '!') return `不满足“${argument}”`;
    return argument;
  }
  if (node.type === 'call') return describeCall(node, algorithmLabels);

  const left = describeNode(node.left, algorithmLabels);
  const right = describeNode(node.right, algorithmLabels);
  const operator = OPERATOR_DESCRIPTIONS[node.operator] || node.operator;
  const description = node.operator === '^'
    ? `${left}的 ${right} 次方`
    : `${left} ${operator} ${right}`;
  return isRoot ? description : `（${description}）`;
}

/**
 * 将标准矩阵、基础统计和算法指标整理为公式作用域。
 */
export function buildFormulaChartContext({
  values = [],
  rawData,
  metrics = {},
  algorithmMetrics = {},
  matrix = {},
  frame = 0,
} = {}) {
  const inputValues = Array.isArray(rawData) ? rawData : values;
  const normalizedValues = Array.isArray(inputValues)
    ? inputValues.map((value) => toFiniteNumber(value, 0))
    : [];
  const positiveValues = normalizedValues.filter((value) => value > 0);
  const fallbackTotal = normalizedValues.reduce((total, value) => total + value, 0);
  const fallbackMax = normalizedValues.length ? Math.max(...normalizedValues) : 0;
  const matrixShape = normalizeMatrixShape(matrix, normalizedValues.length);
  const context = {
    values: normalizedValues,
    total: toFiniteNumber(metrics.totalPressure ?? metrics.totalPres, fallbackTotal),
    avg: toFiniteNumber(
      metrics.averagePressure ?? metrics.meanPres,
      positiveValues.length ? fallbackTotal / positiveValues.length : 0
    ),
    max: toFiniteNumber(metrics.maxPressure ?? metrics.maxPres, fallbackMax),
    points: toFiniteNumber(metrics.activePoints ?? metrics.point, positiveValues.length),
    area: toFiniteNumber(metrics.area, 0),
    frame: toFiniteNumber(frame, 0),
    rawLength: normalizedValues.length,
    rows: matrixShape.rows,
    cols: matrixShape.cols,
    PI: Math.PI,
    E: Math.E,
  };

  Object.entries(algorithmMetrics || {}).forEach(([id, value]) => {
    const safeId = sanitizeAlgorithmMetricId(id);
    if (safeId) context[`algorithm_${safeId}`] = toFiniteNumber(value, 0);
  });
  return context;
}

/**
 * 编译安全公式。返回函数只解释白名单运算符、变量和聚合函数，不执行动态代码。
 */
export function compileFormulaChartExpression(source) {
  const ast = createParser(tokenize(extractFormulaChartExpression(source)));
  return (input = {}) => {
    const context = buildFormulaChartContext(input);
    const result = Number(evaluateNode(ast, context));
    return Number.isFinite(result) ? result : 0;
  };
}

/**
 * 将公式 AST 转换为面向业务用户的中文说明，解释结果与实际计算共用同一套解析规则。
 */
export function describeFormulaChartExpression(
  source,
  { algorithmMetricDefinitions = [] } = {}
) {
  const algorithmLabels = new Map(
    (algorithmMetricDefinitions || []).map((metric) => [
      `algorithm_${sanitizeAlgorithmMetricId(metric?.id)}`,
      metric?.label || metric?.id,
    ])
  );
  const expression = extractFormulaChartExpression(source);
  return describeNode(createParser(tokenize(expression)), algorithmLabels, true);
}
