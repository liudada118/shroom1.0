/**
 * 算法能力定义表。
 *
 * Display Systems 后续可以读取这里的 id，把 manifest 里的 algorithm
 * 解析成可执行函数，而不是在 runtime 里写死 if/else。
 */

const interpolationAlgorithms = require('../interpolationAlgorithms');
const smoothingAlgorithms = require('../smoothingAlgorithms');

const ALGORITHM_DEFINITIONS = Object.freeze({
  interpolation: Object.freeze({
    interp: interpolationAlgorithms.interp,
    interp1016: interpolationAlgorithms.interp1016,
    addSide: interpolationAlgorithms.addSide,
  }),
  smoothing: Object.freeze({
    gaussBlur_1: smoothingAlgorithms.gaussBlur_1,
  }),
});

/**
 * 根据算法类型和 id 获取算法函数。
 *
 * @param {string} category 算法分类，例如 `interpolation`。
 * @param {string} id 算法 id。
 * @returns {Function | undefined} 匹配到的算法函数。
 */
function getAlgorithmDefinition(category, id) {
  return ALGORITHM_DEFINITIONS[category]?.[id];
}

module.exports = {
  ALGORITHM_DEFINITIONS,
  getAlgorithmDefinition,
};
