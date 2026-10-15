const COLOR_FIELD = Object.freeze({ key: 'colorMax', label: '色带上限', min: 1, max: 255, step: 1, initial: 255,
  help: '达到此读数时使用色带最高颜色，数值越小越容易显示高压颜色。' });

const FIELD_SETS = Object.freeze({
  points: Object.freeze([
    COLOR_FIELD,
    Object.freeze({ key: 'height', label: '高度倍率', min: 0.02, max: 1, step: 0.02, initial: 0.1,
      help: '调整三维起伏高度，保持当前相机视角。' }),
    Object.freeze({ key: 'spatialSmooth', label: '空间平滑', min: 0.1, max: 8, step: 0.1, initial: 2,
      help: '数值越大，相邻点之间的起伏越平滑。' }),
    Object.freeze({ key: 'temporalSmooth', label: '时间平滑', min: 1, max: 20, step: 1, initial: 2,
      help: '数值越大，画面变化越柔和；1 为最快响应。' }),
    Object.freeze({ key: 'pointFilter', label: '单点过滤', min: 0, max: 255, step: 1, initial: 0,
      help: '仅在画面中过滤低于此值的点；0 表示关闭。' }),
    Object.freeze({ key: 'totalFilter', label: '总值门槛', min: 0, max: 5000, step: 1, initial: 0,
      help: '过滤后各点总值低于此门槛时显示平面；0 表示关闭。' }),
  ]),
  heatmap: Object.freeze([
    COLOR_FIELD,
    Object.freeze({ key: 'radius', label: '热力点半径', min: 1, max: 50, step: 1, initial: 18,
      help: '调整热力点扩散范围，单位为绘制画布像素。' }),
    Object.freeze({ key: 'pointFilter', label: '单点过滤', min: 0, max: 255, step: 1, initial: 0,
      help: '仅在画面中过滤低于此值的点；0 表示关闭。' }),
  ]),
  numbers: Object.freeze([COLOR_FIELD]),
});

/** 返回当前视图实际支持的参数，不提供渲染方式切换。 */
export function getMobileViewFields(mode) {
  return FIELD_SETS[mode] || [];
}

/** 为三个视图创建独立默认值，不读写浏览器存储。 */
export function createMobileViewParameters() {
  return Object.fromEntries(Object.keys(FIELD_SETS).map((mode) => [mode, normalizeMobileViewParameters(mode)]));
}

/** 把参数限制在界面范围与步长；无效输入回到该参数默认值。 */
export function normalizeMobileViewParameters(mode, values = {}) {
  return Object.fromEntries(getMobileViewFields(mode).map((field) => {
    const raw = values?.[field.key];
    const present = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '');
    const parsed = present ? Number(raw) : NaN;
    const bounded = Number.isFinite(parsed) ? Math.min(field.max, Math.max(field.min, parsed)) : field.initial;
    const rounded = field.min + Math.round((bounded - field.min) / field.step) * field.step;
    return [field.key, Number(Math.min(field.max, Math.max(field.min, rounded)).toFixed(4))];
  }));
}

/** 从已应用的参数生成输入文本，用于切换视图和恢复默认。 */
export function createMobileViewDrafts(mode, values) {
  return Object.fromEntries(Object.entries(normalizeMobileViewParameters(mode, values))
    .map(([key, value]) => [key, String(value)]));
}

/** 完成文本编辑后提交一个参数；空白和非法输入保留原值。 */
export function commitMobileViewParameter(mode, values, key, raw) {
  const current = normalizeMobileViewParameters(mode, values);
  const text = String(raw ?? '').trim();
  if (!Object.hasOwn(current, key) || text === '' || !Number.isFinite(Number(text))) return current;
  return normalizeMobileViewParameters(mode, { ...current, [key]: text });
}

/** 将用户读数转换为既有渲染器命令，不修改帧或采集统计。
 * ⚠️ 原三维点图内部放大两次，色带须乘100；零阈值须用极小正数覆盖其真值判断。
 * @returns {object} points/numbers 传给 sitValue；heatmap 传给 changeColor。
 */
export function mobileRendererParameters(mode, values) {
  const current = normalizeMobileViewParameters(mode, values);
  if (mode === 'points') return {
    valuej: current.colorMax * 100,
    value: current.height,
    valueg: current.spatialSmooth,
    valuel: current.temporalSmooth,
    valuef: current.pointFilter || Number.EPSILON,
    valuelInit: current.totalFilter || Number.EPSILON,
  };
  if (mode === 'heatmap') return { max: current.colorMax, size: current.radius, filter: current.pointFilter };
  if (mode === 'numbers') return { valuej: current.colorMax };
  return {};
}
