/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/logger.js`。
 *
 * 带时间戳和级别的统一日志，行为不变（LOG_LEVEL / LOG_FILE 环境变量照旧）。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
const logger = require('@shroom/backend/logger.js');
const { recordBusinessEvent } = require('./businessEvents');

/** Recognize public diagnostic codes without treating credentials or arbitrary object fields as codes. */
function diagnosticCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value) && !/^[A-F0-9]{32,}$/.test(value) ? value : undefined;
}

/** Extract only error text, stack and a bounded code; extra objects remain in the local log. */
function errorProperties(message, extra) {
  const values = [message, ...extra];
  const error = values.find(value => value instanceof Error);
  const detail = error || values.find(value => value && typeof value === 'object' && !Array.isArray(value)
    && (typeof value.message === 'string' || diagnosticCode(value.code || value.errorCode)));
  const text = typeof message === 'string' ? message.trim() : '';
  const tag = /^\[[A-Za-z][A-Za-z0-9_. -]{0,47}\](?=\s|$)/.exec(text)?.[0];
  const label = text && (!/^[\[{]/.test(text) || tag) ? text : '';
  const reason = typeof detail?.message === 'string' ? detail.message : '';
  const summary = reason ? (tag ? `${tag} ${reason}` : reason) : label || '后端操作异常';
  const errorCode = diagnosticCode(detail?.code) || diagnosticCode(detail?.errorCode);
  const errorType = typeof detail?.name === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(detail.name) ? detail.name : 'Error';
  return { module: 'backend', errorType, severity: 'error', message: summary,
    ...(errorCode ? { errorCode } : {}), ...(typeof detail?.stack === 'string' ? { stack: detail.stack } : {}) };
}

/** Mirror diagnostic fields while retaining the original SDK logger output even if reporting fails. */
module.exports = { ...logger, error: (message, ...extra) => {
  try { recordBusinessEvent('error_reported', errorProperties(message, extra)); } catch { /* Diagnostics must not replace the original log. */ }
  return logger.error(message, ...extra);
} };
