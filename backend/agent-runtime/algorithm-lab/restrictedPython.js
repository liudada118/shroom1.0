const FEATURES = Object.freeze(['duration', 'frameCount', 'pointCount', 'totalMean', 'totalStd', 'totalMin', 'totalMax', 'maxRiseRate', 'maxFallRate', 'meanChange', 'activeMean', 'peak']);
const FUNCTIONS = Object.freeze({ abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt });
const EXAMPLE = 'def predict(f):\n    if f["maxRiseRate"] > 100:\n        return 1\n    return 0';

/** 拒绝不属于数值语言的 Python 语法；源码从不交给 eval、vm 或 Python 执行。 */
function invalid(message) { throw Object.assign(new Error(message), { code: 'ALGORITHM_SOURCE_INVALID' }); }

/** 解析有长度和深度上限的 Python 数值表达式。 */
function expression(source) {
  const tokens = []; let cursor = 0;
  const pattern = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)|([A-Za-z][A-Za-z0-9_]*)|("(?:[^"\\]|\\["\\])*?")|(==|!=|<=|>=|[+*/%<>()\[\],-]))/y;
  while (cursor < source.length) {
    pattern.lastIndex = cursor; const match = pattern.exec(source);
    if (!match) invalid('表达式只支持数值、f["特征名"]、算术、比较、and/or/not 及 abs/min/max/sqrt。');
    tokens.push(match[1] ? { number: Number(match[1]) } : match[3] ? { string: JSON.parse(match[3]) } : match[2] || match[4]); cursor = pattern.lastIndex;
  }
  let index = 0;
  const precedence = { or: 1, and: 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5 };
  /** 消费固定分隔符，禁止忽略尾部代码。 */
  function take(expected) { if (tokens[index++] !== expected) invalid(`表达式缺少 ${expected}。`); }
  /** Pratt 解析器只创建自有 AST，不产生宿主语言源码。 */
  function parse(minimum = 0, depth = 0) {
    if (depth > 24) invalid('表达式嵌套过深。');
    const token = tokens[index++]; let left;
    if (typeof token === 'object' && token && 'number' in token) left = { type: 'number', value: token.number };
    else if (['-', '+', 'not'].includes(token)) left = { type: 'unary', op: token, value: parse(token === 'not' ? 3 : 6, depth + 1) };
    else if (token === '(') { left = parse(0, depth + 1); take(')'); }
    else if (token === 'f') {
      take('['); const key = tokens[index++]?.string; take(']');
      if (!FEATURES.includes(key)) invalid(`未知输入特征：${key || ''}`);
      left = { type: 'feature', key };
    } else if (typeof token === 'string' && Object.hasOwn(FUNCTIONS, token)) {
      take('('); const args = [parse(0, depth + 1)];
      while (tokens[index] === ',') { index++; args.push(parse(0, depth + 1)); if (args.length > 8) invalid('函数参数过多。'); }
      take(')');
      if (['abs', 'sqrt'].includes(token) && args.length !== 1) invalid('abs/sqrt 需要一个参数。');
      left = { type: 'call', name: token, args };
    } else if (typeof token === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(token) && !['import', 'exec', 'eval', 'open', 'lambda', 'while', 'for', 'class', 'def'].includes(token)) left = { type: 'variable', name: token };
    else invalid('表达式含不支持的语法。');
    while (typeof tokens[index] === 'string' && Object.hasOwn(precedence, tokens[index]) && precedence[tokens[index]] >= minimum) {
      const op = tokens[index++];
      if (precedence[op] === 3 && left.type === 'binary' && precedence[left.op] === 3) invalid('连续比较请用 and 分开书写。');
      const right = parse(precedence[op] + 1, depth + 1); left = { type: 'binary', op, left, right };
    }
    return left;
  }
  const node = parse(); if (index !== tokens.length) invalid('表达式含未处理的内容。'); return node;
}

/** 编译 predict(f) 的赋值、if/elif/else 和数字分类返回值。 */
function compile(source) {
  if (typeof source !== 'string' || source.length > 16000 || /\t|\r(?!\n)/.test(source)) invalid('源码最多 16000 字符，缩进使用四个空格。');
  const lines = source.replace(/\r\n/g, '\n').split('\n').map((line) => line.trimEnd()).filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (lines.length > 200 || lines.shift() !== 'def predict(f):') invalid('入口必须是 def predict(f):，最多 200 行。');
  let index = 0;
  /** 按严格四空格层级编译语句，所有分支都必须是可验证的数值语法。 */
  function block(indent) {
    if (indent > 32) invalid('条件嵌套最多 8 层。');
    const nodes = [];
    while (index < lines.length) {
      const line = lines[index], spaces = line.length - line.trimStart().length;
      if (spaces < indent) break;
      if (spaces !== indent) invalid('缩进必须为四个空格，且不能跳过层级。');
      const text = line.slice(indent);
      if (/^(elif |else:)/.test(text)) break;
      index++;
      if (text.startsWith('if ') && text.endsWith(':')) {
        const branches = [{ condition: expression(text.slice(3, -1)), body: block(indent + 4) }];
        let otherwise = [];
        while (index < lines.length && lines[index].startsWith(' '.repeat(indent)) && lines[index].trimStart() === lines[index].slice(indent)) {
          const next = lines[index].slice(indent);
          if (next.startsWith('elif ') && next.endsWith(':')) { index++; branches.push({ condition: expression(next.slice(5, -1)), body: block(indent + 4) }); }
          else if (next === 'else:') { index++; otherwise = block(indent + 4); break; }
          else break;
        }
        nodes.push({ type: 'if', branches, otherwise });
      } else if (text.startsWith('return ')) nodes.push({ type: 'return', value: expression(text.slice(7)) });
      else {
        const match = /^([a-z][a-z0-9_]{0,31}) = (.+)$/.exec(text);
        if (!match || ['f', 'if', 'elif', 'else', 'return', 'and', 'or', 'not', 'for', 'while', 'def', 'class', 'import', 'from', 'in', 'is', 'lambda', 'try', 'except', 'raise', 'yield', 'with', 'as', 'global', 'nonlocal', 'del', 'pass', 'break', 'continue', 'assert', 'async', 'await'].includes(match[1]) || Object.hasOwn(FUNCTIONS, match[1])) invalid('只支持局部赋值、if/elif/else 和 return；不支持导入、循环或系统调用。');
        nodes.push({ type: 'assign', name: match[1], value: expression(match[2]) });
      }
    }
    if (!nodes.length) invalid('代码块不能为空。'); return nodes;
  }
  const result = block(4); if (index !== lines.length) invalid('源码包含无法识别的语句。'); return result;
}

/** 执行自有数值 AST，每个窗口的变量独立且步数有硬上限。 */
function predict(program, features, classCount) {
  const variables = Object.create(null); let remaining = 4000;
  /** 校验计算结果，除零和溢出不会变成可用分类结果。 */
  function number(value) { if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e15) invalid('计算产生非有限数值或数值溢出。'); return value; }
  /** 解释一项数值表达式，不访问对象原型或宿主函数以外的能力。 */
  function value(node) {
    if (--remaining < 0) invalid('算法超过单窗口计算步数限制。');
    if (node.type === 'number') return number(node.value);
    if (node.type === 'feature') return number(features[node.key]);
    if (node.type === 'variable') return number(variables[node.name]);
    if (node.type === 'call') return number(FUNCTIONS[node.name](...node.args.map(value)));
    if (node.type === 'unary') { const item = value(node.value); return node.op === 'not' ? Number(!item) : node.op === '-' ? -item : item; }
    const a = value(node.left);
    if (node.op === 'and') return a ? value(node.right) : a;
    if (node.op === 'or') return a || value(node.right);
    const b = value(node.right);
    switch (node.op) {
      case '+': return number(a + b); case '-': return number(a - b); case '*': return number(a * b); case '/': return number(a / b); case '%': return number(((a % b) + b) % b);
      case '<': return Number(a < b); case '<=': return Number(a <= b); case '>': return Number(a > b); case '>=': return Number(a >= b); case '==': return Number(a === b); case '!=': return Number(a !== b);
      default: invalid('未知数值操作。');
    }
  }
  /** 顺序执行语句直到 return，条件分支不会形成循环。 */
  function run(nodes) {
    for (const node of nodes) {
      if (--remaining < 0) invalid('算法超过单窗口计算步数限制。');
      if (node.type === 'return') return { result: value(node.value) };
      if (node.type === 'assign') variables[node.name] = value(node.value);
      else if (node.type === 'if') { const branch = node.branches.find((item) => value(item.condition)); const returned = run(branch?.body || node.otherwise); if (returned) return returned; }
    }
    return null;
  }
  const result = run(program)?.result;
  if (!Number.isInteger(result) || result < -1 || result >= classCount) invalid('predict 必须返回类别下标，无法判断时返回 -1。');
  return result;
}

module.exports = { FEATURES, EXAMPLE, compile, predict };
