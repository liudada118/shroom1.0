import { normalizeEdgeBuffer } from './edgeBuffer.js';

const FIELDS = { valuej: ['valuej', 1, 65535], valueg: ['valueg', 0, 20], value: ['value', 0, 200],
  valuel: ['valuel', 1, 1000], valuef: ['valuef', 0, 65535], valuelInit: ['valuelInit', 0, 1e12] };

/** 更新已知数值调节项，允许关闭滤波和高度，拒绝 NaN 与非数值。 */
export function updatePointGridTuning(tuning, patch = {}, channel = 1) {
  if (typeof patch?.edgeBuffer === 'number' && Number.isFinite(patch.edgeBuffer)) {
    tuning[`edgeBuffer${channel}`] = normalizeEdgeBuffer(patch.edgeBuffer);
  }
  for (const [key, [field, min, max]] of Object.entries(FIELDS)) {
    if (typeof patch?.[key] === 'number' && Number.isFinite(patch[key])) {
      tuning[`${field}${channel}`] = Math.max(min, Math.min(max, patch[key]));
    }
  }
}

/** 从未过滤的缓存重建显示副本，降低阈值可恢复点值，采集与统计原帧不变。 */
export function preparePointGridValues(values, tuning, baseline = tuning.valuelInit1) {
  const next = values.map((value) => value < tuning.valuef1 ? 0 : value);
  return next.reduce((sum, value) => sum + value, 0) < baseline ? next.fill(0) : next;
}
