/** 在矩阵范围内钳制整数格坐标。 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** 从屏幕命中的采样面取得原始矩阵区域；适用于带压力高度的 3D 点图。 */
export function screenRectToGrid(projected, rect, columns) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const point of projected) {
    if (!point.visible || point.x < Math.min(rect.x1, rect.x2) || point.x > Math.max(rect.x1, rect.x2)
      || point.y < Math.min(rect.y1, rect.y2) || point.y > Math.max(rect.y1, rect.y2)) continue;
    const x = point.index % columns, y = Math.floor(point.index / columns);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return Number.isFinite(left) ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1 } : null;
}

/** 按格边界向外吸附原始矩阵框；小于一格的拖动仍可选中完整一格。 */
export function snapGridRect(rect, bounds, columns, rows) {
  const width = (bounds.x2 - bounds.x1) / columns, height = (bounds.y2 - bounds.y1) / rows;
  if (!(width > 0 && height > 0)) return null;
  const x = clamp(Math.floor((Math.min(rect.x1, rect.x2) - bounds.x1) / width + 1e-7), 0, columns);
  const y = clamp(Math.floor((Math.min(rect.y1, rect.y2) - bounds.y1) / height + 1e-7), 0, rows);
  const right = clamp(Math.ceil((Math.max(rect.x1, rect.x2) - bounds.x1) / width - 1e-7), 0, columns);
  const bottom = clamp(Math.ceil((Math.max(rect.y1, rect.y2) - bounds.y1) / height - 1e-7), 0, rows);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** 投影固定矩阵区域；二维精确贴格边，三维按有效采样面包围框显示。 */
export function projectSelectionRegion(region, projected, bounds, columns, rows) {
  if (bounds) {
    const width = (bounds.x2 - bounds.x1) / columns, height = (bounds.y2 - bounds.y1) / rows;
    return { x1: bounds.x1 + region.x * width, y1: bounds.y1 + region.y * height,
      x2: bounds.x1 + (region.x + region.width) * width, y2: bounds.y1 + (region.y + region.height) * height };
  }
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const point of projected) {
    const x = point.index % columns, y = Math.floor(point.index / columns);
    if (!point.visible || x < region.x || x >= region.x + region.width || y < region.y || y >= region.y + region.height) continue;
    x1 = Math.min(x1, point.x); x2 = Math.max(x2, point.x); y1 = Math.min(y1, point.y); y2 = Math.max(y2, point.y);
  }
  return Number.isFinite(x1) ? { x1: x1 - 5, y1: y1 - 5, x2: x2 + 5, y2: y2 + 5 } : null;
}

/** 整框按格移动，到矩阵边缘停住，始终保持选中的行数和列数。 */
export function moveGridRegion(region, dx, dy, columns, rows) {
  return { ...region, x: clamp(region.x + Math.round(dx), 0, columns - region.width),
    y: clamp(region.y + Math.round(dy), 0, rows - region.height) };
}

/** 在投影中寻找最近原始点，用于 3D 拖动时的整数格位移。 */
function nearestCell(projected, point, columns) {
  let best = null, distance = Infinity;
  for (const candidate of projected) {
    if (!candidate.visible || candidate.sensor === false) continue;
    const next = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (next < distance) { best = candidate; distance = next; }
  }
  return best ? { x: best.index % columns, y: Math.floor(best.index / columns) } : null;
}

/** 固定手势起点的投影，生成逐格预览；松手前不改变用于压力统计的选区。 */
export function createGridSelectionGesture({ projected, bounds, columns, rows, region, start, mode, dir = '' }) {
  const originalRect = region && projectSelectionRegion(region, projected, bounds, columns, rows);
  const anchorCell = !bounds && nearestCell(projected, start, columns);
  /** 将当前指针转换为矩阵区域，移动保尺寸，边手柄只调整对应方向。 */
  return (point) => {
    const dx = point.x - start.x, dy = point.y - start.y;
    if (mode === 'create') {
      const rect = { x1: start.x, y1: start.y, x2: point.x, y2: point.y };
      return bounds ? snapGridRect(rect, bounds, columns, rows) : screenRectToGrid(projected, rect, columns);
    }
    if (!originalRect) return null;
    if (mode === 'move') {
      const current = !bounds && nearestCell(projected, point, columns);
      return bounds ? moveGridRegion(region, dx * columns / (bounds.x2 - bounds.x1), dy * rows / (bounds.y2 - bounds.y1), columns, rows)
        : anchorCell && current ? moveGridRegion(region, current.x - anchorCell.x, current.y - anchorCell.y, columns, rows) : region;
    }
    const rect = { ...originalRect };
    if (dir.includes('w')) rect.x1 += dx;
    if (dir.includes('e')) rect.x2 += dx;
    if (dir.includes('n')) rect.y1 += dy;
    if (dir.includes('s')) rect.y2 += dy;
    let left = region.x, right = region.x + region.width, top = region.y, bottom = region.y + region.height;
    if (bounds) {
      const width = (bounds.x2 - bounds.x1) / columns, height = (bounds.y2 - bounds.y1) / rows;
      if (dir.includes('w')) left = clamp(Math.floor((rect.x1 - bounds.x1) / width + 1e-7), 0, right - 1);
      if (dir.includes('e')) right = clamp(Math.ceil((rect.x2 - bounds.x1) / width - 1e-7), left + 1, columns);
      if (dir.includes('n')) top = clamp(Math.floor((rect.y1 - bounds.y1) / height + 1e-7), 0, bottom - 1);
      if (dir.includes('s')) bottom = clamp(Math.ceil((rect.y2 - bounds.y1) / height - 1e-7), top + 1, rows);
    } else {
      const next = screenRectToGrid(projected, rect, columns);
      if (!next) return region;
      if (dir.includes('w')) left = Math.min(next.x, right - 1);
      if (dir.includes('e')) right = Math.max(next.x + next.width, left + 1);
      if (dir.includes('n')) top = Math.min(next.y, bottom - 1);
      if (dir.includes('s')) bottom = Math.max(next.y + next.height, top + 1);
    }
    return { ...region, x: left, y: top, width: right - left, height: bottom - top };
  };
}
