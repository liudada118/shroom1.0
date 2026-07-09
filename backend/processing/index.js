/**
 * processing 领域聚合入口。
 *
 * 新代码应优先从这里或具体分类模块引入能力。
 * 当前 processing 已经断开对旧 openWeb.js 的直接依赖。
 */
module.exports = {
  ...require('./webStaticServer'),
  ...require('./algorithmDefinitions'),
  ...require('./configMappingExecutor'),
  ...require('./interpolation'),
  ...require('./videoPointMappings'),
  ...require('./lineOrders'),
  ...require('./pressureTransforms'),
  ...require('./matrixTransforms'),
  ...require('./timeFormatters'),
};
