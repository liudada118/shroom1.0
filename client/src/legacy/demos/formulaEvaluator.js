const MATH_SCOPE = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sqrt: Math.sqrt,
  trunc: Math.trunc,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  PI: Math.PI,
  E: Math.E,
};

const ALLOWED_IDENTIFIERS = new Set(['y', 'Math', ...Object.keys(MATH_SCOPE)]);
const FORBIDDEN_CHARACTERS = /[;{}\[\]'"]/;
const UNSAFE_ASSIGNMENT = /(^|[^<>=!])=([^=>]|$)/;

function extractExpression(source) {
  let expression = String(source ?? '').trim();
  if (!expression) return '';

  const arrowMatch = expression.match(
    /^changeValue\s*=\s*\(?\s*y\s*\)?\s*=>\s*(?:\{([\s\S]*)\}|([\s\S]*))$/
  );
  if (arrowMatch) {
    expression = (arrowMatch[1] ?? arrowMatch[2] ?? '').trim();
  }

  const functionMatch = expression.match(
    /^changeValue\s*=\s*function\s*\(\s*y\s*\)\s*\{([\s\S]*)\}$/
  );
  if (functionMatch) {
    expression = functionMatch[1].trim();
  }

  const returnMatch = expression.match(/(?:^|\n)\s*return\s+([\s\S]*?)\s*;?\s*$/);
  if (returnMatch) {
    expression = returnMatch[1].trim();
  }

  return expression.replace(/;$/, '').trim();
}

function validateExpression(expression) {
  if (!expression) return;
  if (FORBIDDEN_CHARACTERS.test(expression) || UNSAFE_ASSIGNMENT.test(expression)) {
    throw new Error('公式只支持表达式，不支持语句、赋值或字符串');
  }

  const identifiers = expression.match(/[A-Za-z_$][\w$]*/g) ?? [];
  const invalidIdentifier = identifiers.find((identifier) => !ALLOWED_IDENTIFIERS.has(identifier));
  if (invalidIdentifier) {
    throw new Error(`公式中不允许使用 ${invalidIdentifier}`);
  }
}

export function compileValueFormula(source) {
  const expression = extractExpression(source);
  validateExpression(expression);

  if (!expression) {
    return (value) => value;
  }

  const scopeNames = Object.keys(MATH_SCOPE);
  const scopeValues = Object.values(MATH_SCOPE);
  const evaluate = new Function(
    'y',
    'Math',
    ...scopeNames,
    `"use strict"; return (${expression});`
  );

  return (value) => {
    const result = evaluate(value, Math, ...scopeValues);
    const numericResult = Number(result);
    return Number.isFinite(numericResult) ? numericResult : value;
  };
}
