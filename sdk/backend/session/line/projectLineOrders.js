const { LineOrderRegistry } = require('./LineOrderRegistry');
const lineOrders = require('../../processing/lineOrders');
const utilMatrix = require('../../processing/utilMatrix');

const LINE_ORDER_EXPORT_DENY_LIST = new Set([
  'convertTempFullBedTemperature',
  'openWeb',
  'normalizeTempFullBedPressure',
  'rotate90',
  'timeStampToDate',
  'timeStampToDateNum',
  'timeStampTo_Date',
]);

/**
 * 线序来源。
 *
 * 以前这里是两个包着 try/catch 的 `require('../../../backend/processing/...')` ——
 * 跨出 SDK 目录取主仓的实现，取不到就静默塞一个 `{}`，结果是注册表空了也没人知道。
 * 现在两个模块都在包内（`@shroom/backend/processing`），路径不可能是「有时在有时不在」，
 * 所以改成顶层 require：路径写错就直接崩，不再静默降级成零条线序。
 */
function loadProjectLineOrderSources() {
  return [lineOrders, utilMatrix];
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
