const { LineOrderRegistry } = require('./LineOrderRegistry');

const LINE_ORDER_EXPORT_DENY_LIST = new Set([
  'convertTempFullBedTemperature',
  'openWeb',
  'normalizeTempFullBedPressure',
  'rotate90',
  'timeStampToDate',
  'timeStampToDateNum',
  'timeStampTo_Date',
]);

function loadProjectLineOrderSources() {
  const sources = [];

  try {
    sources.push(require('../../../backend/processing/lineOrders'));
  } catch (error) {
    sources.push({});
  }

  try {
    sources.push(require('../../../backend/processing/utilMatrix'));
  } catch (error) {
    sources.push({});
  }

  return sources;
}

function createProjectLineOrderRegistry(extraLineOrders = {}) {
  const registry = new LineOrderRegistry();

  loadProjectLineOrderSources().forEach((source) => {
    Object.entries(source).forEach(([name, handler]) => {
      if (LINE_ORDER_EXPORT_DENY_LIST.has(name) || typeof handler !== 'function') {
        return;
      }
      registry.register(name, handler);
    });
  });

  Object.entries(extraLineOrders).forEach(([name, handler]) => {
    registry.register(name, handler);
  });

  return registry;
}

const PROJECT_LINE_ORDER_NAMES = createProjectLineOrderRegistry().list();

module.exports = {
  LINE_ORDER_EXPORT_DENY_LIST,
  PROJECT_LINE_ORDER_NAMES,
  createProjectLineOrderRegistry,
};
