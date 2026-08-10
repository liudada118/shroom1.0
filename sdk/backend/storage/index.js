/**
 * `@shroom/backend/storage` - 落盘
 *
 * peer: `better-sqlite3`（可选，`MemoryCaptureStore` 不需要它）。
 *
 * 这里有**两套** SQLite 表结构，故意不合并：
 *
 * - `dbHelper`：主应用的历史库结构（`initDatabases()` 按传感器类型分三路建库，
 *   按日期分表），已经有几年的历史数据躺在里面，不能动。
 * - `CaptureStore`：SDK 自己的采集库，一张表，schema 简单，给新项目用。
 *   不想落盘就换 `MemoryCaptureStore`，接口一样。
 *
 * 新项目用 `CaptureStore`；要读主应用导出的历史库才用 `dbHelper`。
 */
module.exports = {
  ...require('./dbHelper'),
  ...require('./CaptureStore'),
  ...require('./MemoryCaptureStore'),
};
