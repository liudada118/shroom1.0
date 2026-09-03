// 显式带上 .js 后缀：这个模块和 displayProfileRuntime 一样会被原生 Node ESM 直接加载。
import { OVERLAY_OPTIONS, resolveChartAppearance, resolveDisplayProfile } from './displayProfileRuntime.js';
import { getColormap } from './colormaps.js';

/**
 * 草稿层的状态判定。
 *
 * 用户在零件栏上拖出来的东西写的是 localStorage，展示系统目录里的
 * `display-system.json` 一个字节都没动 —— 这一层叫「草稿」，目录里那份叫「基线」。
 * 有了这个区分，「随机操作」才是安全的：撤销就是丢掉草稿层。
 *
 * 这里只做判定和文案，不碰 localStorage、不碰 DOM。写盘由
 * `displayProfileStorage.js` 和 `formulaChartStore.js` 各自负责。
 */

const OVERLAY_LABELS = new Map(OVERLAY_OPTIONS.map((item) => [item.id, item.label]));

/**
 * 叠加层 id 转中文名。未知 id 原样返回，确认框里宁可显示一个生 id
 * 也不要显示 undefined。
 *
 * @param {string} id 叠加层 id。
 * @returns {string} 中文名。
 */
function overlayLabel(id) {
  return OVERLAY_LABELS.get(id) || String(id);
}

/**
 * 配色转中文名，带上翻转后缀。
 *
 * @param {{id: string, reverse: boolean}} colormap 归一后的配色。
 * @returns {string} 中文名。
 */
function colormapLabel(colormap) {
  const label = getColormap(colormap?.id)?.label || String(colormap?.id || '');
  return colormap?.reverse ? `${label}（翻转）` : label;
}

/**
 * 卡片的身份键。
 *
 * 基线卡片来自 manifest、每次播种都会 stamp 新 id，所以不能按 id 比。
 * 用 `templateId`（新卡片都有）回退到公式（早先用弹窗建的没有 templateId）。
 *
 * @param {object} card 卡片定义。
 * @returns {string} 身份键。
 */
function cardKey(card) {
  return String(card?.templateId || card?.agentChartId || card?.formula || '');
}

function cardName(card) {
  return String(card?.name || card?.templateId || '未命名图表');
}

function toCardList(cards) {
  return (Array.isArray(cards) ? cards : []).filter(Boolean);
}

/**
 * 比较两个配色是否等价。
 *
 * @param {object} left 配色一。
 * @param {object} right 配色二。
 * @returns {boolean} 是否等价。
 */
function sameColormap(left, right) {
  return left?.id === right?.id && Boolean(left?.reverse) === Boolean(right?.reverse);
}

/**
 * 比较两组叠加层是否等价。顺序无关 —— 先开网格再开图例和反过来是同一个结果。
 *
 * @param {string[]} left 叠加层一。
 * @param {string[]} right 叠加层二。
 * @returns {boolean} 是否等价。
 */
function sameOverlays(left, right) {
  const a = [...(left || [])].sort();
  const b = [...(right || [])].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * 造一条外观差异的说明，没差异返回 null。
 *
 * @param {string} kind 差异类别前缀（`canvas` / `chart`）。
 * @param {string} scope 中文前缀（"" / "图表"）。
 * @param {object} baseline 基线外观。
 * @param {object} current 当前外观。
 * @returns {object[]} 差异条目数组。
 */
function describeAppearance(kind, scope, baseline, current) {
  const changes = [];
  if (!sameColormap(baseline.colormap, current.colormap)) {
    changes.push({
      kind: `${kind}Colormap`,
      label: `${scope}配色：${colormapLabel(current.colormap)} → ${colormapLabel(baseline.colormap)}`,
    });
  }
  if (!sameOverlays(baseline.overlays, current.overlays)) {
    const baselineSet = new Set(baseline.overlays || []);
    const currentSet = new Set(current.overlays || []);
    const added = (current.overlays || []).filter((id) => !baselineSet.has(id));
    const removed = (baseline.overlays || []).filter((id) => !currentSet.has(id));
    if (added.length) {
      changes.push({
        kind: `${kind}OverlayRemove`,
        label: `移除${scope}叠加层：${added.map(overlayLabel).join('、')}`,
      });
    }
    if (removed.length) {
      changes.push({
        kind: `${kind}OverlayRestore`,
        label: `恢复${scope}叠加层：${removed.map(overlayLabel).join('、')}`,
      });
    }
  }
  return changes;
}

/**
 * 判断草稿层有没有改动，并把「撤销会丢什么」列成人话。
 *
 * 判定方式是**对比解析结果**，不是看 localStorage 键在不在：用户可能拖走一个配色
 * 又拖回原值，键在但语义没变，那就不该报"有未保存的改动"。
 * 基线用同一个 `resolveDisplayProfile`、传空 selection 得到，所以这里不需要
 * 再写一套解析逻辑，也不会和真正的渲染通路漂移。
 *
 * @param {object} params 入参。
 * @param {object} params.model `buildDisplayProfileModel` 的结果。
 * @param {object} [params.selection] 当前用户偏好。
 * @param {object[]} [params.cards] 当前图表卡片清单。
 * @param {object[]} [params.baselineCards] manifest 声明的默认卡片清单。
 * @returns {{dirty: boolean, changes: Array<{kind: string, label: string}>}} 判定结果。
 */
export function describeDisplayDraft({ model, selection = {}, cards = [], baselineCards = [] } = {}) {
  if (!model) return { dirty: false, changes: [] };

  // 只保留会影响外观的字段：profileId / rendererId / algorithmId 是"我在看哪个模式"，
  // 不属于草稿层，撤销不该把它们一起撤掉，脏判定也不该把它们算进去。
  const viewOnly = {
    profileId: selection.profileId,
    rendererId: selection.rendererId,
    algorithmId: selection.algorithmId,
  };

  const changes = [
    ...describeAppearance(
      'canvas',
      '',
      resolveDisplayProfile(model, viewOnly).canvas,
      resolveDisplayProfile(model, selection).canvas,
    ),
    ...describeAppearance(
      'chart',
      '图表',
      resolveChartAppearance(model, viewOnly),
      resolveChartAppearance(model, selection),
    ),
  ];

  const currentCards = toCardList(cards);
  const baselineList = toCardList(baselineCards);
  const baselineKeys = new Set(baselineList.map(cardKey));
  const currentKeys = new Set(currentCards.map(cardKey));
  const addedCards = currentCards.filter((card) => !baselineKeys.has(cardKey(card)));
  const removedCards = baselineList.filter((card) => !currentKeys.has(cardKey(card)));
  if (addedCards.length) {
    changes.push({
      kind: 'chartCardsRemove',
      label: `删除图表卡片：${addedCards.map(cardName).join('、')}`,
    });
  }
  if (removedCards.length) {
    changes.push({
      kind: 'chartCardsRestore',
      label: `恢复图表卡片：${removedCards.map(cardName).join('、')}`,
    });
  }

  return { dirty: changes.length > 0, changes };
}

/**
 * 把当前草稿层打包成后端 `display` 段的三个字段（保存 / 另存为的请求体）。
 *
 * 写的是**解析后的最终值**而不是 selection 原文：selection 里可能只有
 * `{ colormap }` 一个字段，直接写进 manifest 会把 manifest 原来声明的叠加层
 * 悄悄抹掉 —— 用户看到的是"配色 + 叠加层"，保存下来就该是这两样。
 *
 * @param {object} params 入参。
 * @param {object} params.model `buildDisplayProfileModel` 的结果。
 * @param {object} [params.selection] 当前用户偏好。
 * @param {object[]} [params.cards] 当前图表卡片清单。
 * @returns {{canvas: object, chartAppearance: object, chartCards: object[]}} 请求体。
 */
export function buildDisplaySectionPayload({ model, selection = {}, cards = [] } = {}) {
  const canvas = resolveDisplayProfile(model, selection).canvas;
  const chart = resolveChartAppearance(model, selection);
  return {
    // **刻意丢掉 `canvas.widgets`。** 它缺省的含义是"跟随 display.widgets"，
    // 解析时被填成了当时那份清单；照原样写回去就变成一份写死的显式清单，
    // 以后改 display.widgets 画布反而跟不上了。
    canvas: { colormap: { ...canvas.colormap }, overlays: [...canvas.overlays] },
    chartAppearance: { colormap: { ...chart.colormap }, overlays: [...chart.overlays] },
    chartCards: toCardList(cards).map((card) => ({
      templateId: card.templateId || '',
      name: card.name || '',
      ...(card.agentChartId ? {
        agentChartId: card.agentChartId,
        source: card.source || '',
        options: card.options || {},
      } : {
        formula: card.formula || '',
        unit: card.unit || '',
        decimals: card.decimals,
        color: card.color || '',
      }),
    })),
  };
}

/**
 * 去掉 selection 里属于草稿层的字段。
 *
 * **只删 `canvas` 和 `charts`。** 同一个键里还有 `profileId` / `rendererId` /
 * `algorithmId`，那是用户正在看哪个方案、哪个渲染方式、哪个可视算法 ——
 * 整键删掉会把他的视图也切走，撤销一个配色不该有这种副作用。
 *
 * @param {object} [selection] 当前用户偏好。
 * @returns {object} 去掉草稿字段后的新 selection。
 */
export function clearDisplayDraftSelection(selection = {}) {
  const next = { ...(selection || {}) };
  delete next.canvas;
  delete next.charts;
  return next;
}
