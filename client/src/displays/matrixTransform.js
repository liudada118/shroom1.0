const MATRIX_TRANSFORM_TYPES = new Set(['none', 'interpolate', 'downsample']);

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function normalizeMatrixShape(matrix = {}, valueCount = 0) {
  const requestedRows = Math.trunc(Number(matrix.rows || matrix.height || 0));
  const requestedCols = Math.trunc(Number(matrix.cols || matrix.width || 0));
  const rows = requestedRows > 0
    ? requestedRows
    : requestedCols > 0
      ? Math.max(1, Math.ceil(Number(valueCount) / requestedCols) || 1)
      : 1;
  const cols = requestedCols > 0
    ? requestedCols
    : requestedRows > 0
      ? Math.max(1, Math.ceil(Number(valueCount) / requestedRows) || 1)
      : Math.max(1, Number(valueCount) || 1);
  return {
    rows,
    cols,
    width: cols,
    height: rows,
    total: rows * cols,
  };
}

export function normalizeMatrixTransform(transform = {}) {
  const type = MATRIX_TRANSFORM_TYPES.has(transform?.type) ? transform.type : 'none';
  if (type === 'interpolate') {
    return {
      type,
      factor: Number(transform.factor) === 4 ? 4 : 2,
      method: 'bilinear',
    };
  }
  if (type === 'downsample') {
    return {
      type,
      factor: Number(transform.factor) === 0.25 ? 0.25 : 0.5,
      method: 'average',
    };
  }
  return { type: 'none', factor: 1, method: 'none' };
}

export function deriveTransformedMatrix(matrix = {}, transform = {}, valueCount = 0) {
  const source = normalizeMatrixShape(matrix, valueCount);
  const normalized = normalizeMatrixTransform(transform);
  if (normalized.type === 'none') return source;
  const rows = Math.max(1, Math.round(source.rows * normalized.factor));
  const cols = Math.max(1, Math.round(source.cols * normalized.factor));
  return {
    rows,
    cols,
    width: cols,
    height: rows,
    total: rows * cols,
  };
}

function bilinearSample(values, source, row, col) {
  const sourceRow = source.rows === 1 ? 0 : row * (source.rows - 1);
  const sourceCol = source.cols === 1 ? 0 : col * (source.cols - 1);
  const row0 = Math.floor(sourceRow);
  const col0 = Math.floor(sourceCol);
  const row1 = Math.min(source.rows - 1, row0 + 1);
  const col1 = Math.min(source.cols - 1, col0 + 1);
  const rowRatio = sourceRow - row0;
  const colRatio = sourceCol - col0;
  const top = values[row0 * source.cols + col0] * (1 - colRatio)
    + values[row0 * source.cols + col1] * colRatio;
  const bottom = values[row1 * source.cols + col0] * (1 - colRatio)
    + values[row1 * source.cols + col1] * colRatio;
  return top * (1 - rowRatio) + bottom * rowRatio;
}

function interpolateValues(values, source, target) {
  return Array.from({ length: target.total }, (_, index) => {
    const targetRow = Math.floor(index / target.cols);
    const targetCol = index % target.cols;
    const row = target.rows === 1 ? 0 : targetRow / (target.rows - 1);
    const col = target.cols === 1 ? 0 : targetCol / (target.cols - 1);
    return bilinearSample(values, source, row, col);
  });
}

function downsampleValues(values, source, target) {
  return Array.from({ length: target.total }, (_, index) => {
    const targetRow = Math.floor(index / target.cols);
    const targetCol = index % target.cols;
    const rowStart = Math.floor((targetRow * source.rows) / target.rows);
    const rowEnd = Math.max(rowStart + 1, Math.floor(((targetRow + 1) * source.rows) / target.rows));
    const colStart = Math.floor((targetCol * source.cols) / target.cols);
    const colEnd = Math.max(colStart + 1, Math.floor(((targetCol + 1) * source.cols) / target.cols));
    let total = 0;
    let count = 0;
    for (let row = rowStart; row < Math.min(source.rows, rowEnd); row += 1) {
      for (let col = colStart; col < Math.min(source.cols, colEnd); col += 1) {
        total += values[row * source.cols + col];
        count += 1;
      }
    }
    return count ? total / count : 0;
  });
}

/**
 * 只转换渲染矩阵，不改变业务统计使用的 normalizedData。
 */
export function applyMatrixTransform(values = [], matrix = {}, transform = {}) {
  const source = normalizeMatrixShape(matrix, values.length);
  const normalized = normalizeMatrixTransform(transform);
  const sourceValues = Array.from(
    { length: source.total },
    (_, index) => toFiniteNumber(values[index]),
  );
  if (normalized.type === 'none') {
    return { values: sourceValues, matrix: source, transform: normalized };
  }
  const target = deriveTransformedMatrix(source, normalized, sourceValues.length);
  return {
    values: normalized.type === 'interpolate'
      ? interpolateValues(sourceValues, source, target)
      : downsampleValues(sourceValues, source, target),
    matrix: target,
    transform: normalized,
  };
}

export function transformCoordinateMap(coordinateMap, transform = {}) {
  const coordinates = Array.isArray(coordinateMap)
    ? coordinateMap
    : coordinateMap?.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.length || !Array.isArray(coordinates[0])) {
    return coordinateMap || null;
  }
  const rows = coordinates.length;
  const cols = coordinates[0].length;
  if (!coordinates.every((row) => Array.isArray(row) && row.length === cols)) {
    return coordinateMap;
  }
  const xValues = coordinates.flat().map((point) => toFiniteNumber(point?.[0]));
  const yValues = coordinates.flat().map((point) => toFiniteNumber(point?.[1]));
  const matrix = { rows, cols };
  const transformedX = applyMatrixTransform(xValues, matrix, transform);
  const transformedY = applyMatrixTransform(yValues, matrix, transform);
  const nextCoordinates = Array.from({ length: transformedX.matrix.rows }, (_, row) => (
    Array.from({ length: transformedX.matrix.cols }, (_, col) => {
      const index = row * transformedX.matrix.cols + col;
      return [transformedX.values[index], transformedY.values[index]];
    })
  ));
  if (Array.isArray(coordinateMap)) return nextCoordinates;
  return {
    ...coordinateMap,
    matrix: {
      ...(coordinateMap.matrix || {}),
      rows: transformedX.matrix.rows,
      cols: transformedX.matrix.cols,
    },
    coordinates: nextCoordinates,
  };
}
