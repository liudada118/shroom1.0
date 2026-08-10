/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/storage/dbHelper.js`。
 *
 * SQLite 建库建表、写入、按日期查询与删除。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/storage/dbHelper.js');
