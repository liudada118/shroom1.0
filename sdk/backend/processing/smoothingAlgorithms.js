/**
 * 平滑算法入口。
 *
 * 目前可独立复用的平滑能力是 `gaussBlur_1`。后续从旧实现继续迁移
 * `gaussBlur_return`、`gaussBlur_2` 等算法时，统一放在这里或子目录中。
 */

const { gaussBlur_1 } = require('./interpolationAlgorithms');

module.exports = {
  gaussBlur_1,
};
