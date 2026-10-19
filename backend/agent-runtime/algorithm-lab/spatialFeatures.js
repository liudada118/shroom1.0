const { FEATURES } = require('./restrictedPython');

const FEATURE_VERSION = 'pressure-spatial-v2';
const SPATIAL_FEATURES = Object.freeze(['copX', 'copY', 'leftRatio', 'rightRatio', 'topRatio', 'bottomRatio', 'symmetry', 'spreadX', 'spreadY']);

/** 仅接受宿主提供的展示矩阵，点数相同也不能猜测行列。 */
function validateMatrix(matrix, pointCount) {
  if (matrix == null) return null;
  if (!Number.isInteger(matrix.rows) || matrix.rows < 1 || !Number.isInteger(matrix.cols) || matrix.cols < 1
    || !Number.isInteger(matrix.total) || matrix.total !== pointCount || matrix.rows * matrix.cols !== pointCount
    || pointCount < 1 || pointCount > 65536) throw new Error('算法矩阵与映射后的压力点数不一致。');
  return { rows: matrix.rows, cols: matrix.cols, total: matrix.total };
}

/** 共用旧统计特征，并按已验证的行优先矩阵追加归一化空间特征。 */
function windowFeaturesForVersion(frames, { featureVersion, matrix } = {}) {
  const base = require('./evaluate').windowFeatures(frames);
  if (!featureVersion || featureVersion === 'pressure-global-v1') return base;
  if (featureVersion !== FEATURE_VERSION) throw new Error('不支持此算法特征版本。');
  const shape = validateMatrix(matrix, base.pointCount);
  if (!shape) return base;
  const pressure = Array(shape.total).fill(0);
  for (const frame of frames) for (let index = 0; index < shape.total; index++) {
    if (!Number.isFinite(frame.values[index])) throw new Error('空间特征输入包含无效压力数值。');
    pressure[index] += Math.max(0, frame.values[index]);
  }
  let mass = 0, xSum = 0, ySum = 0, xSquared = 0, ySquared = 0, left = 0, right = 0, top = 0, bottom = 0, asymmetry = 0;
  for (let index = 0; index < shape.total; index++) {
    const row = Math.floor(index / shape.cols), col = index % shape.cols, value = pressure[index];
    const x = shape.cols === 1 ? .5 : col / (shape.cols - 1), y = shape.rows === 1 ? .5 : row / (shape.rows - 1);
    mass += value; xSum += value * x; ySum += value * y; xSquared += value * x * x; ySquared += value * y * y;
    left += value * (x < .5 ? 1 : x === .5 ? .5 : 0); right += value * (x > .5 ? 1 : x === .5 ? .5 : 0);
    top += value * (y < .5 ? 1 : y === .5 ? .5 : 0); bottom += value * (y > .5 ? 1 : y === .5 ? .5 : 0);
    if (col < Math.floor(shape.cols / 2)) asymmetry += Math.abs(value - pressure[row * shape.cols + shape.cols - col - 1]);
  }
  const copX = mass ? xSum / mass : .5, copY = mass ? ySum / mass : .5;
  const result = { ...base, copX, copY, leftRatio: mass ? left / mass : 0, rightRatio: mass ? right / mass : 0,
    topRatio: mass ? top / mass : 0, bottomRatio: mass ? bottom / mass : 0, symmetry: mass ? Math.max(0, 1 - asymmetry / mass) : 0,
    spreadX: mass ? Math.sqrt(Math.max(0, xSquared / mass - copX * copX)) : 0,
    spreadY: mass ? Math.sqrt(Math.max(0, ySquared / mass - copY * copY)) : 0 };
  if (Object.values(result).some((value) => !Number.isFinite(value))) throw new Error('空间特征超过可计算范围。');
  return result;
}

module.exports = { FEATURE_VERSION, SPATIAL_FEATURES, ALL_FEATURES: Object.freeze([...FEATURES, ...SPATIAL_FEATURES]), validateMatrix, windowFeaturesForVersion };
