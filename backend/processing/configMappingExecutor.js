const fs = require('fs');
const { mapOneBasedOrder, paintPoints } = require('./lineOrderMapper');

function loadJsonDefinition(filePath, fsLike = fs) {
  return JSON.parse(fsLike.readFileSync(filePath, 'utf8'));
}

function normalizeOrderDefinition(definition) {
  if (Array.isArray(definition)) return definition;
  if (Array.isArray(definition?.order)) return definition.order;
  if (Array.isArray(definition?.adcOrder)) return definition.adcOrder;
  throw new Error('line order definition must be an array or contain order/adcOrder');
}

function normalizePointDefinition(definition, { enforceMatrixBounds = true } = {}) {
  const points = Array.isArray(definition) ? definition : definition?.points;
  if (!Array.isArray(points)) {
    throw new Error('point order definition must be an array or contain points');
  }
  if (points.length === 0) {
    throw new Error('point order definition must contain at least one point');
  }

  let inferredRows = 0;
  let inferredCols = 0;
  const coordinateKeys = new Set();
  points.forEach((point, index) => {
    if (!Array.isArray(point) || point.length < 2) {
      throw new Error(`points[${index}] must be [row, col]`);
    }
    const [row, col] = point;
    if (!Number.isInteger(row) || row < 0) {
      throw new Error(`points[${index}][0] row must be a non-negative integer`);
    }
    if (!Number.isInteger(col) || col < 0) {
      throw new Error(`points[${index}][1] col must be a non-negative integer`);
    }

    const coordinateKey = `${row},${col}`;
    if (coordinateKeys.has(coordinateKey)) {
      throw new Error(`points[${index}] duplicates coordinate [${row}, ${col}]`);
    }
    coordinateKeys.add(coordinateKey);
    inferredRows = Math.max(inferredRows, row + 1);
    inferredCols = Math.max(inferredCols, col + 1);
  });

  const rawRows = Array.isArray(definition)
    ? undefined
    : definition?.rows ?? definition?.matrix?.rows;
  const rawCols = Array.isArray(definition)
    ? undefined
    : definition?.cols ?? definition?.matrix?.cols;
  const rows = rawRows == null ? inferredRows : Number(rawRows);
  const cols = rawCols == null ? inferredCols : Number(rawCols);
  if (!Number.isInteger(rows) || rows <= 0) {
    throw new Error('point order matrix rows must be a positive integer');
  }
  if (!Number.isInteger(cols) || cols <= 0) {
    throw new Error('point order matrix cols must be a positive integer');
  }
  if (enforceMatrixBounds && (rows < inferredRows || cols < inferredCols)) {
    throw new Error(`point order matrix ${rows}x${cols} does not contain every point`);
  }

  return {
    points,
    rows,
    cols,
  };
}

function applyLineOrderDefinition(source, definition) {
  return mapOneBasedOrder(source, normalizeOrderDefinition(definition));
}

function applyPointOrderDefinition(values, definition) {
  const normalized = normalizePointDefinition(definition);
  return paintPoints(values, normalized.points, {
    rows: normalized.rows,
    cols: normalized.cols,
  });
}

function executeConfiguredMapping(source, { lineOrder, pointOrder }) {
  const ordered = lineOrder ? applyLineOrderDefinition(source, lineOrder) : [...source];
  if (!pointOrder) return ordered;
  return applyPointOrderDefinition(ordered, pointOrder);
}

module.exports = {
  applyLineOrderDefinition,
  applyPointOrderDefinition,
  executeConfiguredMapping,
  loadJsonDefinition,
  normalizeOrderDefinition,
  normalizePointDefinition,
};
