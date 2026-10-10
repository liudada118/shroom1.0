/**
 * display.renderers 的解析白名单；新建目录使用 SELECTABLE_DISPLAY_RENDERERS。
 *
 * 绘制实现全在前端，后端只登记 id 和中文名，理由与 `displaySystemCanvasCatalog.js`
 * 一样：Builder 的零件栏按这份目录渲染，生成出来的 manifest 也只能引用这份目录里的 id，
 * 两边不会各写一套而漂移。
 *
 * ⚠️ **这份目录横跨两套互不相识的前端实现，改之前必须知道自己在动哪一半**：
 * 内置那三条由 `ManifestDisplayRenderer.jsx` 的 `['heatmap','matrix','raw2d']` 分支
 * 直接接管（走 `MatrixWidget` / `CoordinatePointWidget`）；插件那五条一条都不在那个
 * 分支里，是落到同文件末尾的 `RendererHost` 兜底、再由 `sdk/frontend/renderers/builtins.js`
 * 的 `registerRenderer` 认领的。**给任一半加 id，都要先确认对面那一半接得住** ——
 * 接不住的现象不是报错，是画面空白加一行 console.warn。
 */

/**
 * 主应用直接实现的视图类型。
 *
 * ⚠️ 三个 id 与 `displaySystemPage.js` 的 `DEFAULT_RENDERER_TYPES`、前端
 * `displayProfileRuntime.js` 的 `DATA_RENDERER_TYPES` 是同一组常量的三份拷贝，
 * 且都参与「manifest 没写 renderers 时兜底生成」的链路 —— 删任何一条都会让
 * 已装机的老 manifest 失去它当前正在用的渲染方式，**属于历史数据兼容性问题**。
 * 只增不删。
 */
const BUILTIN_DISPLAY_RENDERERS = Object.freeze([
  Object.freeze({ id: 'heatmap', type: 'heatmap', label: '热力图', group: 'builtin' }),
  Object.freeze({ id: 'matrix', type: 'matrix', label: '数值矩阵', group: 'builtin' }),
  Object.freeze({ id: 'raw2d', type: 'raw2d', label: '原始二维数据', group: 'builtin' }),
]);

/**
 * `@shroom/frontend` 注册表里能吃**任意规则矩阵**的渲染器。
 *
 * id 和 label **逐字抄自 `sdk/frontend/renderers/builtins.js` 的 `registerRenderer`
 * 调用**，不是另起的命名。抄而不是共享是因为后端吃不进那个 ESM 包；代价是这里要盯着
 * 它改，收益是 Builder/Agent 生成的 `rendererId` 一定能被 `RendererHost` 解析到。
 *
 * ⚠️ 注册表里还有第五个 `handPoints`，**故意不登记**：它的点表和掩码写死成 32×32 手套，
 * 与 SDK 自己的 `BUILTIN_MATRIX_RENDERER_OPTIONS` 一样把它排除在通用目录外。登记进来
 * Agent 就会照策略「从目录里挑一个精确 id」把它配给 16×16 座椅，画出来是一只手。
 *
 * ⚠️ 对不上的现象很安静：`RendererHost` 查不到 id 只会渲染一句「未注册渲染器」，
 * 不抛异常、不影响别的 widget，所以**它不会在测试里红，只会在真机上白**。
 */
const SDK_DISPLAY_RENDERERS = Object.freeze([
  Object.freeze({ id: 'numMatrix', type: 'numMatrix', label: '3D 数字', group: 'sdk' }),
  Object.freeze({ id: 'pointGrid', type: 'pointGrid', label: '点阵热力（3D）', group: 'sdk' }),
  Object.freeze({ id: 'webglHeatmap', type: 'webglHeatmap', label: '热力图', group: 'sdk',
    params: { canvasWidth: 512, canvasHeight: 512, radius: 18, max: 200, filter: 0,
      valueScale: 1, edgeClear: null, mirrorX: false } }),
  Object.freeze({ id: 'blobHeatmap', type: 'blobHeatmap', label: '斑点热力（Canvas 2D）', group: 'sdk' }),
]);

/**
 * 当前与历史 manifest 能解析的全部渲染方式。
 *
 * 保留旧二维类型以兼容已安装包；不把它们重新开放给 Builder 或 Agent。
 */
const DISPLAY_RENDERERS = Object.freeze([
  ...BUILTIN_DISPLAY_RENDERERS,
  ...SDK_DISPLAY_RENDERERS,
]);

const DISPLAY_RENDERER_IDS = new Set(DISPLAY_RENDERERS.map((item) => item.id));

/** 新系统只提供 SDK 原生矩阵渲染器；旧类型仍可解析，避免已安装包失效。 */
const SELECTABLE_DISPLAY_RENDERERS = Object.freeze([
  ...SDK_DISPLAY_RENDERERS,
  // 模式 ID 不作 widget 类型；注册表实际挂载 numMatrix 的原生二维后端。
  Object.freeze({ id: 'numMatrix2d', type: 'numMatrix', label: '2D 数字', group: 'sdk',
    params: { backend: 'webgl', frameInput: 'raw', manageSidebar: false,
      webgl: { variant: 'original', rawTranspose: false, indexRow: false, overlayPad: 0 } } }),
]);

module.exports = {
  BUILTIN_DISPLAY_RENDERERS,
  DISPLAY_RENDERERS,
  DISPLAY_RENDERER_IDS,
  SDK_DISPLAY_RENDERERS,
  SELECTABLE_DISPLAY_RENDERERS,
};
