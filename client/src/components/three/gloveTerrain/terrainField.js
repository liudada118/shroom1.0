import { GLOVE_HAND_POINTS } from '../../num/gloveHandLayout';
import { applyGlove147Layout, padGlove147Rows } from '@shroom/frontend/renderers/numMatrix/core/layouts.js';
import { REFERENCE_TERRAIN_BASE } from './referenceTerrainBase';
import { TERRAIN_DEFAULTS } from './terrainConfig';

export const TERRAIN_GRID_SIZE = 32;
export const TERRAIN_MESH_SIZE = 64;

// TerrainPianoPage 的色带；初始底形与真实压力分别处理。
const COLOR_STOPS = [
  [0, 0, .08, .18], [.06, 0, .28, .52], [.14, 0, .55, .7], [.22, 0, .7, .55],
  [.32, .1, .78, .25], [.42, .45, .82, .05], [.52, .78, .75, 0], [.62, .95, .6, 0],
  [.72, 1, .4, 0], [.82, 1, .25, 0], [.92, 1, .15, 0], [1, 1, .08, 0],
];

const REGIONS = {
  littleFinger: [3, 7, 6, 8, 1, 7], ringFinger: [1, 3, 14, 17, 0, 15],
  middleFinger: [3, 6, 22, 22, 1, 22], indexFinger: [8, 8, 26, 28, 6, 27],
  thumb: [23, 22, 26, 28, 21, 27], palm: [16, 27, 6, 18],
};

/** 将输入值规整为有限非负压力，非法读数不能污染整块地形。 */
export function pressureValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

/** 按左右手硬件点号生成手指/手掌的目标场坐标。 */
function rawSamples(side) {
  const points = GLOVE_HAND_POINTS[side];
  const result = [];
  Object.entries(REGIONS).forEach(([part, region]) => {
    const rows = part === 'palm' ? points.palm : points[part].rows;
    rows.forEach((row, y) => row.forEach((point, x) => {
      const col = region[2] + x / Math.max(1, row.length - 1) * (region[3] - region[2]);
      result.push({ index: point - 1, row: region[0] + y / Math.max(1, rows.length - 1) * (region[1] - region[0]),
        col: side === 'right' ? 31 - col : col, spread: part === 'palm' ? 1.5 : 1.2, gain: part === 'palm' ? .6 : .8 });
    }));
    if (part !== 'palm') {
      const col = region[5];
      result.push({ index: points[part].pulp - 1, row: region[4], col: side === 'right' ? 31 - col : col, spread: 1, gain: 1 });
    }
  });
  return result;
}

const RAW_SAMPLES = { left: rawSamples('left'), right: rawSamples('right') };

/** 在规则矩阵上采样；越界只读取最近边缘，不创建额外压力。 */
function bilinear(values, width, height, x, y) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  return (pressureValue(values[y0 * width + x0]) * (1 - fx) + pressureValue(values[y0 * width + x1]) * fx) * (1 - fy)
    + (pressureValue(values[y1 * width + x0]) * (1 - fx) + pressureValue(values[y1 * width + x1]) * fx) * fy;
}

/** 将真实硬件帧铺到32×32，统计只包含当前设备压力。 */
export function buildTerrainField(frame = {}, side = 'left') {
  const raw = Array.isArray(frame.rawPressure) && frame.rawPressure.length === 256 ? frame.rawPressure : null;
  const mapped = Array.isArray(frame.pressure) ? frame.pressure : [];
  const source = (raw || mapped).map(pressureValue);
  const pressureTotal = source.reduce((total, value) => total + value, 0);
  const values = source;
  const field = new Float32Array(TERRAIN_GRID_SIZE ** 2);
  let layout = 'empty';
  if (mapped.length === 195 || (!raw && mapped.length === 256)) {
    const width = raw || mapped.length === 256 ? 16 : 15;
    const height = raw || mapped.length === 256 ? 16 : 13;
    for (let row = 1; row < 31; row++) {
      for (let col = 1; col < 31; col++) field[row * 32 + col] = bilinear(values, width, height, (col - 1) / 29 * (width - 1), (row - 1) / 29 * (height - 1));
    }
    layout = 'matrix';
  } else if (raw) {
    RAW_SAMPLES[side].forEach((sample) => {
      const value = values[sample.index];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const row = Math.round(sample.row) + dy, col = Math.round(sample.col) + dx;
          if (row < 0 || row >= 32 || col < 0 || col >= 32) continue;
          const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sample.spread ** 2));
          const index = row * 32 + col;
          field[index] += value * weight * sample.gain;
        }
      }
    });
    layout = 'hand';
  } else if (mapped.length === 147) {
    const arranged = applyGlove147Layout(padGlove147Rows(values).data);
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) field[row * 32 + col] = pressureValue(arranged[row * 32 + (side === 'right' ? 31 - col : col)]);
    }
    layout = 'hand';
  }
  return { field, layout, pressureTotal,
    pressureMax: source.reduce((maximum, value) => Math.max(maximum, value), 0), points: values.length };
}

/** 按参考项目的初始底形掩膜叠加实时压力；底形不参与传感器统计。 */
export function composeTerrainField(pressure, side = 'left', baseGain = TERRAIN_DEFAULTS.baseGain) {
  const base = new Float32Array(TERRAIN_GRID_SIZE ** 2), field = new Float32Array(base.length);
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      const index = row * 32 + col;
      base[index] = REFERENCE_TERRAIN_BASE[row * 32 + (side === 'right' ? 31 - col : col)] * pressureValue(baseGain);
      const overlay = pressureValue(pressure[index]) * TERRAIN_DEFAULTS.gloveGain * Math.min(base[index] / 30, 1);
      field[index] = Math.min(255, base[index] + overlay);
    }
  }
  return { field, base };
}

/** 为地形作可分离高斯平滑；零压力输入严格保持平坦。 */
export function smoothTerrainField(values) {
  const kernel = [.0544887, .2442013, .40262, .2442013, .0544887];
  const temporary = new Float32Array(values.length), result = new Float32Array(values.length);
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      for (let offset = -2; offset <= 2; offset++) temporary[row * 32 + col] += values[row * 32 + Math.max(0, Math.min(31, col + offset))] * kernel[offset + 2];
    }
  }
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      for (let offset = -2; offset <= 2; offset++) result[row * 32 + col] += temporary[Math.max(0, Math.min(31, row + offset)) * 32 + col] * kernel[offset + 2];
    }
  }
  return result;
}

/** 使用参考项目的 Catmull-Rom 权重生成连续地形采样。 */
function cubicWeight(value) {
  const distance = Math.abs(value);
  if (distance <= 1) return 1.5 * distance ** 3 - 2.5 * distance ** 2 + 1;
  return distance < 2 ? -.5 * distance ** 3 + 2.5 * distance ** 2 - 4 * distance + 2 : 0;
}

/** 将平滑压力放大到固定网格，避免每帧重建 GPU 几何体。 */
export function sampleTerrainField(field, target = new Float32Array(TERRAIN_MESH_SIZE ** 2)) {
  for (let row = 0; row < TERRAIN_MESH_SIZE; row++) {
    const y = row / (TERRAIN_MESH_SIZE - 1) * 31, iy = Math.floor(y);
    for (let col = 0; col < TERRAIN_MESH_SIZE; col++) {
      const x = col / (TERRAIN_MESH_SIZE - 1) * 31, ix = Math.floor(x);
      let value = 0, weights = 0;
      for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          const weight = cubicWeight(x - ix - dx) * cubicWeight(y - iy - dy);
          value += field[Math.max(0, Math.min(31, iy + dy)) * 32 + Math.max(0, Math.min(31, ix + dx))] * weight;
          weights += weight;
        }
      }
      target[row * TERRAIN_MESH_SIZE + col] = Math.max(0, value / (weights || 1));
    }
  }
  return target;
}

/** 按参考 Terrain 色带写入顶点色，范围外值只在显示层钳位。 */
export function writeTerrainColor(normalized, colors, offset) {
  const value = Math.min(1, Math.max(0, normalized));
  for (let index = 1; index < COLOR_STOPS.length; index++) {
    const upper = COLOR_STOPS[index], lower = COLOR_STOPS[index - 1];
    if (value > upper[0]) continue;
    const factor = (value - lower[0]) / (upper[0] - lower[0]);
    for (let channel = 0; channel < 3; channel++) colors[offset + channel] = lower[channel + 1] + (upper[channel + 1] - lower[channel + 1]) * factor;
    break;
  }
}
