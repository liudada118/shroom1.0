const assert = require('assert');
const {
  CHART_OVERLAYS,
  DISPLAY_CHART_CARD_LIMIT,
  normalizeChartAppearanceConfig,
  normalizeChartCardsConfig,
  normalizeDisplayConfig,
  validateDisplayConfig,
} = require('../../displaySystems');
const {
  buildDisplayMetadataFromDisplaySystem,
} = require('../../displaySystems/displaySystemDefinitionBuilder');

/** 只留下和这一段有关的错误，别的字段的报错不该影响断言。 */
function errorsMatching(display, keyword) {
  return validateDisplayConfig(display).filter((message) => message.includes(keyword));
}

// ── 图表叠加层白名单：画布那份的子集，不含 legend ──

assert.deepStrictEqual(
  CHART_OVERLAYS.map((item) => item.id),
  ['valueLabels', 'gridLines', 'axes', 'peakMarker'],
);

// ── normalizeChartAppearanceConfig ──

// 没声明就是内置默认，和引入这个字段之前的运行时行为一致。
assert.deepStrictEqual(normalizeChartAppearanceConfig(), {
  colormap: { id: 'classic', reverse: false },
  overlays: [],
});
// 坏入参一律退回默认，不抛错 —— 坏配置只该退回默认外观。
assert.deepStrictEqual(normalizeChartAppearanceConfig([1, 2]).colormap.id, 'classic');
assert.deepStrictEqual(normalizeChartAppearanceConfig('nope').overlays, []);

// legend 在这块表面上归一时就被丢掉，不会漏到运行时：曲线画布放不下色带。
const declaredAppearance = normalizeChartAppearanceConfig({
  colormap: { id: 'viridis', reverse: true },
  overlays: ['gridLines', 'legend', 'gridLines', 'bogus', 'axes'],
});
assert.deepStrictEqual(declaredAppearance.colormap, { id: 'viridis', reverse: true });
assert.deepStrictEqual(declaredAppearance.overlays, ['gridLines', 'axes']);
// 字符串写法和对象写法等价，reverse 缺省为 false。
assert.deepStrictEqual(
  normalizeChartAppearanceConfig({ colormap: 'inferno' }).colormap,
  { id: 'inferno', reverse: false },
);
// 未知配色 id 退回 classic 而不是报错。
assert.strictEqual(normalizeChartAppearanceConfig({ colormap: 'no-such' }).colormap.id, 'classic');

// ── normalizeChartCardsConfig ──

assert.deepStrictEqual(normalizeChartCardsConfig(), []);
assert.deepStrictEqual(normalizeChartCardsConfig('nope'), []);

// 缺公式的条目直接丢掉：没有公式的卡片画不出任何东西。
assert.deepStrictEqual(
  normalizeChartCardsConfig([
    { templateId: 'a', formula: 'sum()' },
    { templateId: 'b' },
    { templateId: 'c', formula: '   ' },
    null,
  ]).map((card) => card.templateId),
  ['a'],
);

// 超上限截断，与前端 FORMULA_CHART_LIMIT 同值。
assert.strictEqual(
  normalizeChartCardsConfig(
    Array.from({ length: 10 }, (_, index) => ({ templateId: `c${index}`, formula: 'sum()' })),
  ).length,
  DISPLAY_CHART_CARD_LIMIT,
);

const normalizedCards = normalizeChartCardsConfig([
  { templateId: 'raw-total', name: '原始数据总和', formula: 'sum()', unit: 'kPa', decimals: 3 },
  { formula: 'rawMax()' },
  { templateId: 'over', formula: 'sum()', decimals: 99 },
]);
assert.deepStrictEqual(normalizedCards[0], {
  templateId: 'raw-total',
  name: '原始数据总和',
  formula: 'sum()',
  unit: 'kPa',
  decimals: 3,
  color: '',
});
// 没写 templateId / name 时按位置兜一个，运行时不会拿到 undefined 当键。
assert.strictEqual(normalizedCards[1].templateId, 'chart-2');
assert.strictEqual(normalizedCards[1].name, '图表 2');
// 缺省 2 位小数，和前端模板的 `template.decimals ?? 2` 对齐。
assert.strictEqual(normalizedCards[1].decimals, 2);
// 越界的小数位压到 0-6 而不是原样带出去。
assert.strictEqual(normalizedCards[2].decimals, 6);
// **公式本身不校验**：解析器在前端，后端复制一份会立刻漂移。
assert.strictEqual(
  normalizeChartCardsConfig([{ templateId: 'x', formula: 'definitely(not) a formula' }])[0].formula,
  'definitely(not) a formula',
);

// ── 老 manifest 的归一结果不受影响 ──

const legacyDisplay = { widgets: [{ id: 'main', type: 'heatmap', source: 'sitData' }] };
const legacyNormalized = normalizeDisplayConfig(legacyDisplay);
// 没有这两个字段的 manifest 拿到的是"什么都没声明"的等价值，
// 前端 buildDisplayProfileModel 对它和 undefined 的处理完全一致。
assert.deepStrictEqual(legacyNormalized.chartAppearance, {
  colormap: { id: 'classic', reverse: false },
  overlays: [],
});
assert.deepStrictEqual(legacyNormalized.chartCards, []);
assert.deepStrictEqual(validateDisplayConfig(legacyDisplay), []);

// ── 校验：归一丢弃 vs 显式报错 ──

// 显式写错的配色 id 要在保存时就报出来，而不是保存成功却静默变回 classic。
assert.strictEqual(
  errorsMatching({ chartAppearance: { colormap: 'no-such' } }, 'chartAppearance.colormap').length,
  1,
);
// legend 在这块表面上就是非法的 —— 归一会丢，显式声明则报错。
assert.strictEqual(
  errorsMatching({ chartAppearance: { overlays: ['legend'] } }, 'unknown overlay legend').length,
  1,
);
// 但它在画布那块表面上完全合法，两份白名单不能互相污染。
assert.deepStrictEqual(errorsMatching({ canvas: { overlays: ['legend'] } }, 'unknown overlay'), []);
assert.strictEqual(
  errorsMatching({ chartAppearance: [] }, 'chartAppearance must be an object').length,
  1,
);
assert.strictEqual(
  errorsMatching({ chartAppearance: { overlays: 'gridLines' } }, 'overlays must be an array').length,
  1,
);

assert.strictEqual(
  errorsMatching({ chartCards: { formula: 'sum()' } }, 'chartCards must be an array').length,
  1,
);
assert.strictEqual(
  errorsMatching({ chartCards: [{ templateId: 'a' }] }, 'chartCards[0].formula is required').length,
  1,
);
assert.strictEqual(
  errorsMatching({ chartCards: [null] }, 'chartCards[0] must be an object').length,
  1,
);
assert.strictEqual(
  errorsMatching(
    { chartCards: [{ templateId: 'a', formula: 'sum()', decimals: 7 }] },
    'decimals must be an integer between 0 and 6',
  ).length,
  1,
);
assert.strictEqual(
  errorsMatching(
    { chartCards: [{ templateId: 'a', formula: 'sum()', decimals: 1.5 }] },
    'decimals must be an integer',
  ).length,
  1,
);
// 重复 templateId 会让前端的"这张卡片属于哪个模板"判断出现两个答案。
assert.strictEqual(
  errorsMatching(
    { chartCards: [{ templateId: 'a', formula: 'sum()' }, { templateId: 'a', formula: 'rawMax()' }] },
    'duplicate display chart card templateId a',
  ).length,
  1,
);
// 两条都不写 templateId 不算重复 —— 归一时会按位置各兜一个。
assert.deepStrictEqual(
  errorsMatching({ chartCards: [{ formula: 'sum()' }, { formula: 'rawMax()' }] }, 'duplicate'),
  [],
);
// 超上限归一时会截断，但显式写超了要报出来，否则用户不知道后面几张被吃了。
assert.strictEqual(
  errorsMatching(
    { chartCards: Array.from({ length: 7 }, (_, i) => ({ templateId: `c${i}`, formula: 'sum()' })) },
    'at most',
  ).length,
  1,
);

// ── 穿线到前端：displayMetadata 必须带上这三段 ──

// canvas 出过这个问题：README 写着已经穿线，实际上 displayMetadata 里一直没有
// 这个字段，manifest 声明的画布默认值到不了前端。这条断言就是防它再犯。
const metadata = buildDisplayMetadataFromDisplaySystem({
  id: 'demo',
  name: 'Demo',
  sensor: { type: 'demo', matrix: { rows: 2, cols: 2 } },
  display: normalizeDisplayConfig({
    widgets: [{ id: 'main', type: 'heatmap', source: 'sitData' }],
    canvas: { colormap: 'thermal', overlays: ['legend'] },
    chartAppearance: { colormap: 'viridis', overlays: ['gridLines'] },
    chartCards: [{ templateId: 'raw-total', name: '总和', formula: 'sum()' }],
  }),
});
assert.strictEqual(metadata.canvas.colormap.id, 'thermal');
assert.deepStrictEqual(metadata.canvas.overlays, ['legend']);
assert.strictEqual(metadata.chartAppearance.colormap.id, 'viridis');
assert.deepStrictEqual(metadata.chartAppearance.overlays, ['gridLines']);
assert.deepStrictEqual(metadata.chartCards.map((card) => card.templateId), ['raw-total']);

// 没声明时给出 null / 空数组，前端的 `metadata.canvas || null` 拿到的是同一件事。
const bareMetadata = buildDisplayMetadataFromDisplaySystem({
  id: 'bare',
  name: 'Bare',
  sensor: { type: 'bare', matrix: { rows: 2, cols: 2 } },
  display: { widgets: [{ id: 'main', type: 'heatmap' }] },
});
assert.strictEqual(bareMetadata.canvas, null);
assert.strictEqual(bareMetadata.chartAppearance, null);
assert.deepStrictEqual(bareMetadata.chartCards, []);

console.log('displayChartConfig.test.js passed');
