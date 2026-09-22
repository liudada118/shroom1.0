/** 校验用户填写的横纵传感点中心间距，单位毫米；不从点面积猜点距。 */
export function normalizeSensorPitch(value) {
  const x = Number(value?.x), y = Number(value?.y);
  return Number.isFinite(x) && x > 0 && Number.isFinite(y) && y > 0 ? { x, y } : null;
}

/** 按传感点行列差计算平面中心距，与屏幕缩放、压力峰高和 DPR 无关。 */
export function sensorRulerDistance(start, end, pitch) {
  const spacing = normalizeSensorPitch(pitch);
  const span = sensorRulerSpan(start, end);
  return span && spacing ? Math.hypot(span.columns * spacing.x, span.rows * spacing.y) : null;
}

/** 返回真实点位间跨越的整数格数；相邻两点算一格，禁止像素或小数点位。 */
export function sensorRulerSpan(start, end) {
  if (![start, end].every((point) => point && Number.isInteger(point.x) && point.x >= 0 && Number.isInteger(point.y) && point.y >= 0)) return null;
  return { columns: Math.abs(end.x - start.x), rows: Math.abs(end.y - start.y) };
}

/** 吸附最近的可见真实传感点；点图外空白不强行命中边缘点。 */
export function nearestSensorPoint(points, location, columns, maxDistance = 32) {
  let nearest = null, distance = maxDistance;
  for (const point of points) {
    if (!point.visible) continue;
    const next = Math.hypot(point.x - location.x, point.y - location.y);
    if (next <= distance) { distance = next; nearest = point; }
  }
  return nearest ? { x: nearest.index % columns, y: Math.floor(nearest.index / columns) } : null;
}

/** 从本机设置读取指定系统和矩阵尺寸的点距；无记录或损坏时保持未设置。 */
export function readSensorPitch(key, storage = globalThis.localStorage) {
  try { return normalizeSensorPitch(JSON.parse(storage.getItem(key))); } catch { return null; }
}

/** 保存校验后的点距，写入失败时由界面提示本次仍可测量。 */
export function saveSensorPitch(key, pitch, storage = globalThis.localStorage) {
  const value = normalizeSensorPitch(pitch);
  if (!value) return false;
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
