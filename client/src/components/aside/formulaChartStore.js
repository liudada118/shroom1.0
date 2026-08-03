import { extractFormulaChartExpression } from './formulaChartRuntime';

/**
 * 用户自定义公式图表清单的唯一主人。
 *
 * 这份清单原先藏在 `FormulaChartPanel` 内部，但零件栏在 `Home` 里、卡片画在
 * `Aside` 上、编辑弹窗在 `FormulaChartPanel` 里，三处都要看同一份数据，中间还隔着
 * `CanvasCom.shouldComponentUpdate` 那道闸。所以把读写下沉到这里，加一个极小的
 * `subscribe`：一个 localStorage 键只有一个主人，谁改了谁通知。
 */

export const FORMULA_CHART_LIMIT = 6;

const DEFAULT_COLOR = '#20B486';

const listeners = new Set();

/**
 * 生成不会重复的图表 id。
 *
 * @returns {string} 新 id。
 */
export function createFormulaChartId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `formula-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 把小数位压到 0-6。
 *
 * @param {unknown} value 输入值。
 * @returns {number} 归一后的小数位。
 */
export function clampFormulaChartDecimals(value) {
  return Math.max(0, Math.min(6, Number(value) || 0));
}

/**
 * 该展示系统的存储键。图表清单按 `matrixName` 各存各的，
 * 换传感器不会把上一个系统的卡片带过来。
 *
 * @param {string} matrixName 展示系统标识。
 * @returns {string} localStorage 键名。
 */
export function formulaChartStorageKey(matrixName) {
  return `shroom.formulaCharts.v1.${encodeURIComponent(matrixName || 'default')}`;
}

/**
 * 读取图表清单。
 *
 * 容错沿用 `displayProfileStorage.js` 的纪律：读坏了返回空数组，
 * 一个过期的键值不该让侧栏渲染不出来。
 *
 * @param {string} matrixName 展示系统标识。
 * @returns {object[]} 图表定义数组。
 */
export function loadFormulaCharts(matrixName) {
  try {
    const parsed = JSON.parse(localStorage.getItem(formulaChartStorageKey(matrixName)) || '[]');
    return Array.isArray(parsed)
      ? parsed
        .filter((definition) => definition?.id && definition?.formula)
        .slice(0, FORMULA_CHART_LIMIT)
      : [];
  } catch {
    return [];
  }
}

/**
 * 这个展示系统有没有写过自己的图表清单。
 *
 * `loadFormulaCharts` 对「键不存在」和「键是空数组」都返回 `[]`，但这两件事
 * 意义完全不同：前者是"用户还没动过，该用 manifest 声明的默认卡片播种"，
 * 后者是"用户把卡片都删了，就该是空的"。播种逻辑靠这个函数分辨。
 *
 * @param {string} matrixName 展示系统标识。
 * @returns {boolean} 键是否存在。
 */
export function hasFormulaCharts(matrixName) {
  try {
    return localStorage.getItem(formulaChartStorageKey(matrixName)) !== null;
  } catch {
    return false;
  }
}

/**
 * 把清单重置回基线。
 *
 * 撤销用的是"重置到基线"而不是"全部删除"：manifest 可以用
 * `display.chartCards` 声明默认卡片，撤销必须回到那几张，不是清空。
 * 基线卡片每次都 stamp 新 id，所以不会和用户删掉的旧卡片撞上。
 *
 * @param {string} matrixName 展示系统标识。
 * @param {object[]} [baselineDefinitions] 基线卡片声明，缺省即清空。
 * @returns {object[]} 重置后的清单。
 */
export function resetFormulaCharts(matrixName, baselineDefinitions = []) {
  const next = (Array.isArray(baselineDefinitions) ? baselineDefinitions : [])
    .filter((definition) => definition?.formula)
    .slice(0, FORMULA_CHART_LIMIT)
    .map((definition) => ({
      ...definition,
      id: createFormulaChartId(),
      decimals: clampFormulaChartDecimals(definition.decimals ?? 2),
      color: definition.color || DEFAULT_COLOR,
    }));
  saveFormulaCharts(matrixName, next);
  return next;
}

/**
 * 写入图表清单并通知全部订阅者。
 *
 * @param {string} matrixName 展示系统标识。
 * @param {object[]} definitions 图表定义数组。
 * @returns {void}
 */
export function saveFormulaCharts(matrixName, definitions) {
  const next = Array.isArray(definitions) ? definitions : [];
  try {
    localStorage.setItem(formulaChartStorageKey(matrixName), JSON.stringify(next));
  } catch {
    // 写失败只丢持久化，本次会话的清单照样能用。
  }
  notify(matrixName, next);
}

/**
 * 订阅清单变化。
 *
 * @param {(matrixName: string, definitions: object[]) => void} listener 变化回调。
 * @returns {() => void} 退订函数。
 */
export function subscribeFormulaCharts(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(matrixName, definitions) {
  listeners.forEach((listener) => {
    try {
      listener(matrixName, definitions);
    } catch {
      // 一个订阅者出错不该阻断其它订阅者。
    }
  });
}

/**
 * 判断两条公式是不是同一件事。
 *
 * 比较归一后的表达式而不是函数源码，这样"用弹窗建的"和"从模板拖的"
 * 只要算的是同一个东西就认作同一张图。
 *
 * @param {string} left 公式一。
 * @param {string} right 公式二。
 * @returns {boolean} 是否等价。
 */
export function formulasMatch(left, right) {
  try {
    return extractFormulaChartExpression(left) === extractFormulaChartExpression(right);
  } catch {
    return false;
  }
}

/**
 * 在清单里找出某个模板对应的图表。
 *
 * 新加的定义带 `templateId`，直接按 id 命中；早先用弹窗建的没有这个字段，
 * 回退到公式比较 —— 少了这一步，同一张图会被重复添加、零件方块也不会高亮。
 *
 * @param {object[]} definitions 图表定义数组。
 * @param {{id: string, formula: string}} template 模板。
 * @returns {object | null} 命中的定义。
 */
export function findChartByTemplate(definitions, template) {
  if (!Array.isArray(definitions) || !template?.id) return null;
  return definitions.find((definition) => (
    definition.templateId === template.id
    || (!definition.templateId && formulasMatch(definition.formula, template.formula))
  )) || null;
}

/**
 * 列出已经在侧栏里的模板 id，给零件方块的高亮用。
 *
 * @param {string} matrixName 展示系统标识。
 * @param {object[]} templates 模板清单。
 * @param {object[]} [definitions] 已知的定义清单，省掉一次读盘。
 * @returns {string[]} 模板 id 数组。
 */
export function listFormulaChartTemplateIds(matrixName, templates, definitions = null) {
  const list = Array.isArray(definitions) ? definitions : loadFormulaCharts(matrixName);
  return (Array.isArray(templates) ? templates : [])
    .filter((template) => findChartByTemplate(list, template))
    .map((template) => template.id);
}

/**
 * 按模板添加一张图表。
 *
 * 幂等：已经在侧栏就什么都不做，而不是当成开关删掉 —— 用户可能已经改过这张图的
 * 公式和名字，"再拖一次"删掉等于静默毁掉他的编辑。
 *
 * @param {string} matrixName 展示系统标识。
 * @param {object} template 模板。
 * @returns {{ok: boolean, reason?: 'exists' | 'limit' | 'invalid', definition?: object}} 结果。
 */
export function addFormulaChartFromTemplate(matrixName, template) {
  if (!template?.id || !template?.formula) return { ok: false, reason: 'invalid' };
  const definitions = loadFormulaCharts(matrixName);
  const existing = findChartByTemplate(definitions, template);
  if (existing) return { ok: false, reason: 'exists', definition: existing };
  if (definitions.length >= FORMULA_CHART_LIMIT) return { ok: false, reason: 'limit' };
  const definition = {
    id: createFormulaChartId(),
    templateId: template.id,
    name: String(template.name || template.id),
    formula: String(template.formula),
    unit: String(template.unit || ''),
    decimals: clampFormulaChartDecimals(template.decimals ?? 2),
    color: template.color || DEFAULT_COLOR,
  };
  saveFormulaCharts(matrixName, [...definitions, definition]);
  return { ok: true, definition };
}

/**
 * 删除一张图表。
 *
 * @param {string} matrixName 展示系统标识。
 * @param {string} id 图表 id。
 * @returns {boolean} 是否真的删掉了。
 */
export function removeFormulaChart(matrixName, id) {
  const definitions = loadFormulaCharts(matrixName);
  const next = definitions.filter((definition) => definition.id !== id);
  if (next.length === definitions.length) return false;
  saveFormulaCharts(matrixName, next);
  return true;
}
