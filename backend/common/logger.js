/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/logger.js`。
 *
 * 带时间戳和级别的统一日志，行为不变（LOG_LEVEL / LOG_FILE 环境变量照旧）。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/logger.js');
