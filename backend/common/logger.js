/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/logger.js`。
 *
 * 带时间戳和级别的统一日志，行为不变（LOG_LEVEL / LOG_FILE 环境变量照旧）。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
const logger = require('@shroom/backend/logger.js');
const { recordBusinessEvent } = require('./businessEvents');

/** Mirror a bounded error summary while preserving the SDK logger and all local log output. */
module.exports = { ...logger, error: (message, ...extra) => {
  const error = message instanceof Error ? message : extra.find(value => value instanceof Error);
  const summary = error?.message || (typeof message === 'string' && !/^[\s]*[\[{]/.test(message) ? message : '后端操作异常');
  recordBusinessEvent('error_reported', { module: 'backend', errorType: error?.name || 'Error', severity: 'error',
    message: summary, ...(error?.stack ? { stack: error.stack } : {}) });
  return logger.error(message, ...extra);
} };
