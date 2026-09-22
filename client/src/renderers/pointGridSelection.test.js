import { describe, expect, it, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, PerspectiveCamera, Points } from 'three';
import { createPointGridSelection, gridSelectionStats, gridSelectionIndices, projectGridSensors, screenRectToGrid } from './pointGridSelection';

/** 构造含插值边缘、父组旋转、平移和画布偏移的真实 Three.js 投影。 */
function fixture() {
  const columns = 4, rows = 3, interpolation = 2, padding = 4;
  const width = columns * interpolation + padding * 2, height = rows * interpolation + padding * 2;
  const positions = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    positions.set([x - width / 2, (x + y) / 5, y - height / 2], (y * width + x) * 3);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const points = new Points(geometry), group = new Group(); group.add(points);
  group.position.set(5, 10, 2); group.rotation.y = .2; points.scale.setScalar(.7);
  const camera = new PerspectiveCamera(40, 1.5, .1, 1000); camera.position.set(5, 40, 40); camera.lookAt(group.position);
  const rect = { left: 300, top: 120, width: 900, height: 600 };
  const canvas = { getBoundingClientRect: () => rect };
  const options = { points, camera, canvas, columns, rows, interpolation, padding };
  return { ...options, options, api: createPointGridSelection(options) };
}

describe('门户点图原始矩阵框选', () => {
  it('三维拖动通过真实点位投影移动整格，行列数和提交前统计保持不变', () => {
    const { api } = fixture(); api.setActive(true); api.updateValues(Array(12).fill(10));
    api.save({ x: 1, y: 1, width: 2, height: 1 });
    const region = api.getSnapshot().regions[0], points = api.getSensorPoints();
    const move = api.beginGesture({ region, mode: 'move', start: points.find((p) => p.index === 5) });
    const preview = move(points.find((p) => p.index === 6));
    expect(preview).toMatchObject({ x: 2, y: 1, width: 2, height: 1 });
    expect(api.getSnapshot().regions[0]).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
    expect(api.getStats().totalPres).toBe(20);
  });
  it('真实插值投影扣掉补边；反向拖动及偏移画布均选中同一原始传感点', () => {
    const { options } = fixture();
    const projected = projectGridSensors(options), target = projected.find((p) => p.index === 9);
    const rect = { x1: target.x + 1, y1: target.y + 1, x2: target.x - 1, y2: target.y - 1 };
    expect(screenRectToGrid(projected, rect, options.columns)).toEqual({ x: 1, y: 2, width: 1, height: 1 });
    expect(screenRectToGrid(projected, { x1: -100, y1: -100, x2: -50, y2: -50 }, options.columns)).toBe(null);
  });
  it('非对称区域按行优先读取；边缘插值不混入统计、不转置', () => {
    const { api } = fixture(); api.setActive(true);
    api.updateValues([1, 2, 3, 4, 10, 20, 30, 40, 100, 200, 300, 400]);
    api.save({ x: 1, y: 2, width: 2, height: 1 });
    expect(api.getStats()).toMatchObject({ totalPres: 500, maxPres: 300, meanPres: 250, selectedPoints: 2, point: 2 });
    expect(api.containsGridPoint(7, 9)).toBe(true);
    expect(api.containsGridPoint(3, 9)).toBe(false);
    expect(api.containsGridPoint(9, 7)).toBe(false);
  });
  it('每个框统计独立、重叠框合计去重，删除最后一个框及退出恢复整幅数据', () => {
    const { api } = fixture(); api.setActive(true); api.updateValues(Array(12).fill(128));
    api.save({ x: 0, y: 0, width: 2, height: 3 });
    expect(api.getStats()).toMatchObject({ selectedPoints: 6, point: 6, totalPres: 768 });
    api.save({ x: 1, y: 0, width: 2, height: 3 });
    expect(api.getStats()).toMatchObject({ selectedPoints: 9, totalPres: 1152 });
    expect(api.getSnapshot().regions.map((r) => r.stats.totalPres)).toEqual([768, 768]);
    for (const region of api.getSnapshot().regions) api.remove(region.id);
    expect(api.getStats().totalPres).toBe(1536);
    api.save({ x: 0, y: 0, width: 1, height: 1 }); api.setActive(false);
    expect(api.getStats().totalPres).toBe(1536);
  });
  it('空白点击、非法坐标和第五框有提示，不把已有有效框改成零或越界', () => {
    const { api } = fixture(); api.setActive(true); api.updateValues(Array(12).fill(7));
    for (let x = 0; x < 4; x++) expect(api.save({ x, y: 0, width: 1, height: 1 })).toBe(true);
    expect(new Set(api.getSnapshot().regions.map((r) => r.color)).size).toBe(4);
    expect(api.save({ x: 0, y: 1, width: 1, height: 1 })).toBe(false);
    expect(api.getSnapshot().error).toContain('4 个');
    const { id } = api.getSnapshot().regions[0];
    for (const x of [-1, 4, 1.5, NaN]) expect(api.save({ x, y: 0, width: 1, height: 1 }, id)).toBe(false);
    expect(api.selectScreen({ x1: -100, y1: -100, x2: -50, y2: -50 }, id)).toBe(false);
    expect(api.getSnapshot().error).toContain('没有选中传感点');
    expect(api.getStats().totalPres).toBe(28);
  });
  it('区域跟随当前投影；新帧只更新读数，不漂移矩阵位置；卸载撤销订阅', () => {
    const { api, points } = fixture(); api.setActive(true); api.save({ x: 0, y: 0, width: 2, height: 2 });
    const listener = vi.fn(); api.subscribe(listener);
    const before = api.getScreenRegions()[0].rect;
    points.position.x += 1;
    expect(api.getScreenRegions()[0].rect.x1).not.toBe(before.x1);
    api.updateValues(Array(12).fill(2));
    expect(api.getSnapshot().regions[0]).toMatchObject({ x: 0, y: 0, width: 2, height: 2, stats: { totalPres: 8 } });
    expect(listener).toHaveBeenCalledOnce(); api.dispose();
    expect(api.save({ x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });
  it('真实零压保留选中点数、受压数为零；坏值不污染合计', () => {
    expect(gridSelectionStats([0, 0, NaN, Infinity], gridSelectionIndices([{ x: 0, y: 0, width: 4, height: 1 }], 4)))
      .toEqual({ totalPres: 0, maxPres: 0, point: 0, selectedPoints: 4, meanPres: 0 });
  });
});

describe('原始矩阵格边界预览', () => {
  const bounds = { x1: 120, y1: 80, x2: 320, y2: 170 };
  it('预览不改统计，提交后读原始索引，取消不会留下空选区', () => {
    const api = createPointGridSelection({ columns: 10, rows: 6, projectSensors: () => [], getGridBounds: () => bounds });
    api.setActive(true); api.updateValues(Array.from({ length: 60 }, (_, i) => i + 1));
    const preview = api.beginGesture({ mode: 'create', start: { x: 143, y: 96 } })({ x: 199, y: 136 });
    expect(api.getSnapshot().regions).toHaveLength(0);
    expect(api.getStats().totalPres).toBe(1830);
    api.save(preview);
    expect(api.getStats().totalPres).toBe(207);
    expect(api.getScreenRegions()[0].rect).toEqual({ x1: 140, y1: 95, x2: 200, y2: 140 });
    expect(api.beginGesture({ mode: 'create', start: { x: 30, y: 40 } })).toBe(null);
    expect(api.getStats().totalPres).toBe(207);
  });
});
