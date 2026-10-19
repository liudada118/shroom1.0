const { createHash } = require('node:crypto');
const { ALL_FEATURES } = require('./spatialFeatures');

const CPU_RUNTIME = 'cpu-classifier-v1';
const MAX_MODEL_BYTES = 2 * 1024 * 1024;
const verifiedModels = new WeakSet();

/** 拒绝非便携或资源超限的模型，不执行模型内任何源码。 */
function invalid(message) { throw Object.assign(new Error(message), { code: 'ALGORITHM_MODEL_INVALID' }); }

/** 递归检查纯 JSON 并冻结副本，阻断验证后修改和非有限数值。 */
function copyJson(value, seen = new Set(), depth = 0) {
  if (depth > 20) invalid('模型结构嵌套过深。');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) invalid('模型包含非有限数值。'); return value; }
  if (!value || typeof value !== 'object' || seen.has(value)) invalid('模型必须为无循环、无共享引用的 JSON。');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid('模型必须使用普通 JSON 对象。');
  seen.add(value);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || Object.keys(value).some((key) => !/^(0|[1-9][0-9]*)$/.test(key)))) invalid('模型数组必须完整且连续。');
  const result = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) invalid('模型包含不支持的字段。');
    result[key] = copyJson(value[key], seen, depth + 1);
  }
  return Object.freeze(result);
}

/** 校验定长的有限数值向量。 */
function vector(value, size, positive = false) {
  return Array.isArray(value) && value.length === size && value.every((entry) => Number.isFinite(entry) && (!positive || entry > 0));
}

/** 校验有界树的唯一父节点和可达性，循环或共享子树均不接纳。 */
function validateTree(tree, featureCount, classCount) {
  if (!Array.isArray(tree?.nodes) || !tree.nodes.length || tree.nodes.length > 511) invalid('单棵分类树最多 511 个节点。');
  const parents = Array(tree.nodes.length).fill(0);
  for (const node of tree.nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) invalid('分类树节点无效。');
    if (Object.hasOwn(node, 'probabilities')) {
      if (Object.keys(node).length !== 1 || !vector(node.probabilities, classCount)
        || node.probabilities.some((value) => value < 0 || value > 1)
        || Math.abs(node.probabilities.reduce((sum, value) => sum + value, 0) - 1) > 1e-8) invalid('分类树叶节点的类别概率无效。');
    } else {
      if (Object.keys(node).length !== 4 || !Number.isInteger(node.feature) || node.feature < 0 || node.feature >= featureCount
        || !Number.isFinite(node.threshold) || ![node.left, node.right].every((index) => Number.isInteger(index) && index >= 0 && index < tree.nodes.length)) invalid('分类树分支索引或阈值无效。');
      for (const child of [node.left, node.right]) if (++parents[child] > 1) invalid('分类树含共享子树。');
    }
  }
  if (parents[0] || parents.slice(1).some((count) => count !== 1)) invalid('分类树根节点或父节点无效。');
  const visited = new Set(), stack = [0];
  while (stack.length) {
    const index = stack.pop();
    if (visited.has(index)) invalid('分类树含循环。');
    visited.add(index);
    const node = tree.nodes[index];
    if (!Object.hasOwn(node, 'probabilities')) stack.push(node.left, node.right);
  }
  if (visited.size !== tree.nodes.length) invalid('分类树含不可达节点或循环。');
}

/** 验证线性、单树或森林模型并返回冻结的可预测副本。 */
function validateCpuModel(raw) {
  if (raw && verifiedModels.has(raw)) return raw;
  const model = copyJson(raw);
  if (Buffer.byteLength(JSON.stringify(model)) > MAX_MODEL_BYTES) invalid('分类模型不得超过 2 MiB。');
  if (model?.schemaVersion !== 1 || model.runtime !== CPU_RUNTIME || !['linear', 'tree', 'forest'].includes(model.kind)) invalid('分类模型格式或运行时不受支持。');
  const names = model.featureNames, labels = model.classLabels;
  if (!Array.isArray(names) || !names.length || names.length > 64 || new Set(names).size !== names.length || names.some((name) => !ALL_FEATURES.includes(name))) invalid('分类模型特征清单无效。');
  if (!Array.isArray(labels) || labels.length < 2 || labels.length > 8 || new Set(labels).size !== labels.length
    || labels.some((label) => typeof label !== 'string' || !label.trim() || label.length > 40 || label === '未知')) invalid('分类模型类别清单无效。');
  if (model.minConfidence !== .55) invalid('分类模型必须保留宿主设置的 0.55 置信度阈值。');
  if (model.kind === 'linear') {
    if (!Array.isArray(model.weights) || model.weights.length !== labels.length || model.weights.some((row) => !vector(row, names.length))
      || !vector(model.intercepts, labels.length) || !vector(model.scaler?.mean, names.length) || !vector(model.scaler?.scale, names.length, true)) invalid('线性分类模型系数或标准化参数无效。');
  } else {
    if (!Array.isArray(model.trees) || !model.trees.length || model.trees.length > 32 || (model.kind === 'tree' && model.trees.length !== 1)) invalid('分类森林最多 32 棵树。');
    model.trees.forEach((tree) => validateTree(tree, names.length, labels.length));
  }
  verifiedModels.add(model);
  return model;
}

/** 用固定 JSON 序列化摘要绑定模型内容和本地评价报告。 */
function modelDigest(model) { return createHash('sha256').update(JSON.stringify(model)).digest('hex'); }

/** 以 sklearn 一致的树 float32 输入或线性双精度计算类别概率。 */
function predictCpuModel(raw, features) {
  const model = validateCpuModel(raw);
  const values = model.featureNames.map((name) => features[name]);
  if (values.some((value) => !Number.isFinite(value))) invalid('分类输入缺少有效的模型特征。');
  let probabilities;
  if (model.kind === 'linear') {
    const scaled = values.map((value, index) => (value - model.scaler.mean[index]) / model.scaler.scale[index]);
    const scores = model.weights.map((weights, index) => weights.reduce((sum, value, feature) => sum + value * scaled[feature], model.intercepts[index]));
    if (scores.some((value) => !Number.isFinite(value))) invalid('线性分类计算溢出。');
    const maximum = Math.max(...scores), exponents = scores.map((value) => Math.exp(value - maximum)), sum = exponents.reduce((total, value) => total + value, 0);
    probabilities = exponents.map((value) => value / sum);
  } else {
    const rounded = values.map(Math.fround);
    if (rounded.some((value) => !Number.isFinite(value))) invalid('分类树输入超出 float32 范围。');
    probabilities = Array(model.classLabels.length).fill(0);
    for (const tree of model.trees) {
      let node = tree.nodes[0];
      while (!Object.hasOwn(node, 'probabilities')) node = tree.nodes[rounded[node.feature] <= node.threshold ? node.left : node.right];
      node.probabilities.forEach((value, index) => { probabilities[index] += value / model.trees.length; });
    }
  }
  const maximum = Math.max(...probabilities);
  return maximum < model.minConfidence ? -1 : probabilities.indexOf(maximum);
}

module.exports = { CPU_RUNTIME, MAX_MODEL_BYTES, validateCpuModel, modelDigest, predictCpuModel };
