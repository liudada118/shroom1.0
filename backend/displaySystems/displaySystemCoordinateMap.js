/**
 * 读取坐标矩阵主体。
 *
 * 兼容用户直接提供 `rows × cols × [x, y]` 数组，也兼容标准对象中的
 * `coordinates` 字段。
 *
 * @param {object | number[][][]} definition 原始坐标定义。
 * @returns {number[][][]} 坐标矩阵。
 */
function getCoordinateMatrix(definition) {
  if (Array.isArray(definition)) return definition;
  if (Array.isArray(definition?.coordinates)) return definition.coordinates;
  throw new Error('coordinate map must be a 2D array or contain coordinates');
}

/**
 * 校验并规范化传感器物理坐标矩阵。
 *
 * @param {object | number[][][]} definition 原始坐标定义。
 * @returns {{ rows: number, cols: number, pointCount: number, coordinates: number[][][], bounds: object }}
 */
function normalizeCoordinateMapDefinition(definition) {
  const coordinates = getCoordinateMatrix(definition);
  if (coordinates.length === 0 || !Array.isArray(coordinates[0]) || coordinates[0].length === 0) {
    throw new Error('coordinate map must contain at least one row and column');
  }

  const rows = coordinates.length;
  const cols = coordinates[0].length;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  coordinates.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`coordinate map row ${rowIndex} must contain ${cols} points`);
    }
    row.forEach((coordinate, colIndex) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        throw new Error(`coordinates[${rowIndex}][${colIndex}] must be [x, y]`);
      }
      const x = Number(coordinate[0]);
      const y = Number(coordinate[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`coordinates[${rowIndex}][${colIndex}] must contain finite numbers`);
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  const declaredRows = Array.isArray(definition) ? rows : Number(definition?.matrix?.rows || rows);
  const declaredCols = Array.isArray(definition) ? cols : Number(definition?.matrix?.cols || cols);
  if (declaredRows !== rows || declaredCols !== cols) {
    throw new Error(`coordinate map matrix must match coordinate dimensions ${rows}x${cols}`);
  }
  if (maxX === minX || maxY === minY) {
    throw new Error('coordinate map must span a non-zero width and height');
  }

  return {
    rows,
    cols,
    pointCount: rows * cols,
    coordinates: coordinates.map((row) => row.map(([x, y]) => [Number(x), Number(y)])),
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

/**
 * 生成可持久化的标准坐标文件。
 *
 * @param {object | number[][][]} definition 原始坐标定义。
 * @returns {object} 标准坐标定义。
 */
function canonicalizeCoordinateMapDefinition(definition) {
  const normalized = normalizeCoordinateMapDefinition(definition);
  const extra = Array.isArray(definition) ? {} : { ...definition };
  delete extra.matrix;
  delete extra.coordinates;
  delete extra.bounds;
  delete extra.rows;
  delete extra.cols;
  delete extra.pointCount;
  return {
    ...extra,
    matrix: { rows: normalized.rows, cols: normalized.cols },
    coordinates: normalized.coordinates,
  };
}

/**
 * 校验坐标文件与展示系统矩阵是否一致。
 *
 * @param {object | number[][][]} definition 坐标定义。
 * @param {object} options 校验选项。
 * @param {string} options.source 文件来源。
 * @param {{ rows: number, cols: number }} options.matrix 展示系统矩阵。
 * @returns {string[]} 错误列表。
 */
function validateCoordinateMapDefinition(definition, { source, matrix }) {
  let normalized;
  try {
    normalized = normalizeCoordinateMapDefinition(definition);
  } catch (error) {
    return [`${source}: ${error.message}`];
  }

  const errors = [];
  if (normalized.rows !== matrix.rows) {
    errors.push(`${source}: matrix.rows must match sensor.matrix.rows ${matrix.rows}`);
  }
  if (normalized.cols !== matrix.cols) {
    errors.push(`${source}: matrix.cols must match sensor.matrix.cols ${matrix.cols}`);
  }
  return errors;
}

module.exports = {
  canonicalizeCoordinateMapDefinition,
  getCoordinateMatrix,
  normalizeCoordinateMapDefinition,
  validateCoordinateMapDefinition,
};
