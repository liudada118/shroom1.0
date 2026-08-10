const {
  addSide,
  gaussBlur_1,
  interp,
  interp1016,
} = require('./interpolationAlgorithms');

/**
 * 插值和基础平滑入口。
 *
 * 当前实现已经迁到 interpolationAlgorithms.js，不再依赖旧 openWeb.js。
 */
module.exports = {
  addSide,
  gaussBlur_1,
  interp,
  interp1016,
};
