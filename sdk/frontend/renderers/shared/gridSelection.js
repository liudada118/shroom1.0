import { Vector3 } from 'three';
import { createGridSelectionGesture, projectSelectionRegion, screenRectToGrid, snapGridRect } from './gridSelectionGeometry.js';
export { screenRectToGrid } from './gridSelectionGeometry.js';

export const POINT_SELECTION_COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7'];

/** 将有效插值面投影到画布 CSS 坐标，并关联原始格点；补零边缘不参与统计。 */
export function projectGridSensors({ points, camera, canvas, columns, rows, interpolation, padding }) {
  const rect = canvas.getBoundingClientRect();
  const positions = points.geometry.getAttribute('position');
  const gridWidth = columns * interpolation + padding * 2;
  points.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  const vertex = new Vector3();
  return Array.from({ length: columns * rows * interpolation * interpolation }, (_, slot) => {
    const col = slot % (columns * interpolation), row = Math.floor(slot / (columns * interpolation));
    const x = padding + col, y = padding + row;
    const index = Math.floor(row / interpolation) * columns + Math.floor(col / interpolation);
    vertex.fromBufferAttribute(positions, y * gridWidth + x).applyMatrix4(points.matrixWorld).project(camera);
    return { index, sensor: col % interpolation === 0 && row % interpolation === 0, x: rect.left + (vertex.x + 1) * rect.width / 2,
      y: rect.top + (1 - vertex.y) * rect.height / 2, visible: vertex.z >= -1 && vertex.z <= 1 };
  });
}

/** 只读取原始矩阵的行优先索引，重叠框合计时每个传感点只算一次。 */
export function gridSelectionIndices(regions, columns) {
  const indices = new Set();
  for (const region of regions) for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) indices.add(y * columns + x);
  }
  return indices;
}

/** 计算有限原始值的压力和受压点数；selectedPoints 包括区域内零压点。 */
export function gridSelectionStats(values, indices) {
  let totalPres = 0, maxPres = 0, point = 0;
  for (const index of indices) {
    const value = Number(values[index]);
    if (!Number.isFinite(value)) continue;
    totalPres += value;
    if (value > 0) point++;
    maxPres = Math.max(maxPres, value);
  }
  return { totalPres, maxPres, point, selectedPoints: indices.size, meanPres: totalPres / (point || 1) };
}

/** 管理门户点图的最多四个矩阵选区，只影响展示统计，不下发设备或采集命令。 */
export function createPointGridSelection(options) {
  const { columns, rows, interpolation = 1, padding = 0 } = options;
  const project = options.projectSensors || (() => projectGridSensors(options));
  const listeners = new Set();
  let regions = [], values = [], selected = null, sequence = 0, active = false, measuring = false, disposed = false;
  let snapshot = { regions: [], error: '', active: false, columns, rows };
  /** 发布不可变快照，统计和界面订阅共享同一份原始索引。 */
  const publish = (error = '') => {
    snapshot = { active, columns, rows, error, regions: regions.map((region) => ({ ...region,
      stats: gridSelectionStats(values, gridSelectionIndices([region], columns)) })) };
    listeners.forEach((listener) => listener());
  };
  /** 校验输入矩阵坐标，禁止越界、负数、小数或零面积。 */
  const save = (region, id) => {
    if (disposed) return false;
    if (!['x', 'y', 'width', 'height'].every((key) => Number.isInteger(region[key])) || region.x < 0 || region.y < 0
      || region.width < 1 || region.height < 1 || region.x + region.width > columns || region.y + region.height > rows) {
      publish(`请输入有效整数坐标，区域不能超过 ${columns} × ${rows} 点。`); return false;
    }
    if (!id && regions.length >= 4) { publish('最多保留 4 个框选区域，请先删除一个。'); return false; }
    const previous = regions.find((entry) => entry.id === id);
    if (id && !previous) return false;
    const color = previous?.color || POINT_SELECTION_COLORS.find((entry) => !regions.some((r) => r.color === entry));
    const next = { x: region.x, y: region.y, width: region.width, height: region.height, id: id || `region-${++sequence}`, color,
      name: String(region.name || previous?.name || `框选 ${sequence}`).trim().slice(0, 24) };
    regions = id ? regions.map((entry) => entry.id === id ? next : entry) : [...regions, next];
    selected = gridSelectionIndices(regions, columns); publish(); options.onSelectionChange?.(); return true;
  };
  return {
    canvas: options.canvas,
    /** 读取稳定快照供 React 订阅。 */
    getSnapshot: () => snapshot,
    /** 订阅选区和低频统计变化。 */
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    /** 开关时清理区域，退出后恢复全图统计。 */
    setActive(next) { active = next; regions = []; selected = null; options.onInteractionChange?.(active || measuring); publish(); options.onSelectionChange?.(); },
    /** 测量时停用相机手势，退出后恢复原有控制。 */
    setMeasurementActive(next) { measuring = next; options.onInteractionChange?.(active || measuring); },
    /** 返回真实采样点的屏幕投影；插值点不充当物理传感点。 */
    getSensorPoints() { return disposed ? [] : project().filter((point) => point.sensor !== false); },
    /** 保存手动输入区域或更新既有框。 */
    save,
    /** 开始格点手势，快照投影避免拖动期间压力变化改变移动基准。 */
    beginGesture({ region, start, mode, dir }) {
      if (disposed) return null;
      if (mode === 'create' && regions.length >= 4) { publish('最多保留 4 个框选区域，请先删除一个。'); return null; }
      const bounds = options.getGridBounds?.() || null;
      if (mode === 'create' && bounds && (start.x < bounds.x1 || start.x > bounds.x2 || start.y < bounds.y1 || start.y > bounds.y2)) {
        publish('请在传感器矩阵内开始框选。'); return null;
      }
      const projected = project();
      const resolve = createGridSelectionGesture({ projected, bounds, columns, rows, region, start, mode, dir });
      const color = region?.color || POINT_SELECTION_COLORS.find((entry) => !regions.some((r) => r.color === entry));
      return (point) => {
        const next = resolve(point);
        return next ? { ...next, color, rect: projectSelectionRegion(next, projected, bounds, columns, rows) } : null;
      };
    },
    /** 根据当前真实投影创建矩阵区域；无命中时保留已有有效框并提示。 */
    selectScreen(rect, id) {
      const bounds = options.getGridBounds?.();
      const region = bounds ? snapGridRect(rect, bounds, columns, rows) : screenRectToGrid(project(), rect, columns);
      if (!region) { publish('此处没有选中传感点，请在点图上重新框选。'); return false; }
      return save(region, id);
    },
    /** 将固定矩阵区域映射回当前画布，窗口缩放和压力高度变化后仍跟随对应点。 */
    getScreenRegions() {
      const projected = project();
      const bounds = options.getGridBounds?.() || null;
      return regions.map((region) => ({ ...region, rect: projectSelectionRegion(region, projected, bounds, columns, rows) }));
    },
    /** 删除一框后重新合并剩余区域；最后一框删除后回到全图。 */
    remove(id) { regions = regions.filter((r) => r.id !== id); selected = regions.length ? gridSelectionIndices(regions, columns) : null; publish(); options.onSelectionChange?.(); },
    /** 接收渲染器已有的原始帧，按原统计频率刷新各框读数。 */
    updateValues(next) { values = next; if (active) publish(snapshot.error); },
    /** 汇总选区并集，无选区时返回整幅原始数据的统计。 */
    getStats() { return gridSelectionStats(values, selected || new Set(Array.from({ length: columns * rows }, (_, index) => index))); },
    /** 判断插值点是否位于选区，先扣边缘再转原始行列。 */
    containsGridPoint(x, y) {
      if (!selected) return true;
      const col = Math.floor((x - padding) / interpolation), row = Math.floor((y - padding) / interpolation);
      return col >= 0 && col < columns && row >= 0 && row < rows && selected.has(row * columns + col);
    },
    /** 卸载后撤销订阅与选区。 */
    dispose() { disposed = true; listeners.clear(); regions = []; selected = null; options.onInteractionChange?.(false); },
  };
}
