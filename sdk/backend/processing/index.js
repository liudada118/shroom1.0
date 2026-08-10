/**
 * `@shroom/backend/processing` - 纯计算层
 *
 * **零依赖、零 I/O**：给一串 ADC 原始值，还你一个能画的矩阵。没有 fs、没有串口、
 * 没有数据库，所以裸 Node 里 require 得动，`scripts/smoke-backend.js` 每次都验证这条。
 *
 * | 组 | 内容 |
 * | :--- | :--- |
 * | 线序 | `lineOrders.js` 执行器 + `lineOrderDefinitions/` 点位表 + `lineOrderMapper.js` 通用映射 |
 * | 矩阵 | `matrixTransforms.js` 断线修补、`utilMatrix.js` 小床压缩 |
 * | 压力 | `pressureTransforms.js` 换算与区域统计 |
 * | 插值/平滑 | `interpolationAlgorithms.js`、`smoothingAlgorithms.js`，`interpolation.js` 是分类门面 |
 * | 视频映射 | `videoPointMappings.js` |
 * | 配置化映射 | `configMappingExecutor.js`，执行 manifest 里的 line-order / point-order JSON |
 * | 算法注册 | `algorithmDefinitions/`，manifest 里 `algorithm.type` 可选项的来源 |
 * | 通用数学 | `mathUtils.js` 高斯模糊、极值、字节拼装 |
 * | 时间 | `timeFormatters.js` |
 *
 * ## 出口顺序不能随便改
 *
 * 前 8 个 spread 的顺序是从 `backend/processing/index.js` 原样搬过来的，
 * `lineOrders` **必须**排在 `videoPointMappings` 后面 —— 两者有 9 个同名出口
 * （`carCol` / `matColLine` / `handBlue` / `handSinglePoint` 等），
 * `lineOrders` 是覆盖方。换顺序等于悄悄换实现。
 *
 * `dataProcessor.js` 和 `press.js`（一份 4096 长的原始帧样本）不在门面里，
 * 需要的话走子路径 `@shroom/backend/processing/dataProcessor.js`。
 */
module.exports = {
  ...require('./algorithmDefinitions'),
  ...require('./configMappingExecutor'),
  ...require('./interpolation'),
  ...require('./videoPointMappings'),
  ...require('./lineOrders'),
  ...require('./pressureTransforms'),
  ...require('./matrixTransforms'),
  ...require('./timeFormatters'),
  ...require('./lineOrderMapper'),
  ...require('./utilMatrix'),
  ...require('./mathUtils'),
};
