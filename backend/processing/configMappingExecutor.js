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

function normalizePointDefinition(definition) {
  const points = Array.isArray(definition) ? definition : definition?.points;
  if (!Array.isArray(points)) {
    throw new Error('point order definition must be an array or contain points');
  }
  return {
    points,
    rows: Number(definition?.rows || definition?.matrix?.rows || 32),
    cols: Number(definition?.cols || definition?.matrix?.cols || 32),
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
