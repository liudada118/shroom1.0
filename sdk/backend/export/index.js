/**
 * `@shroom/backend/export` - CSV 导出
 *
 * peer: `csv-writer`。
 *
 * - `CsvExporter`：从 `CaptureStore` / `MemoryCaptureStore` 里的帧直接导 CSV，
 *   新项目要的「下载」就是它。
 * - `csvHelper`：主应用那两种表头（传感器帧、压力统计）和导出文件名规则，
 *   要跟主应用导出的文件对得上就用它。
 *
 * 主应用完整的导出流程（目录校验、进度推送、三路库合并）还在
 * `backend/services/export/csvDownloadService.js` —— 它有 20 个注入参数、
 * 形状被应用绑死了，搬过来别人也用不了，所以没进包。
 */
module.exports = {
  ...require('./csvHelper'),
  ...require('./CsvExporter'),
};
