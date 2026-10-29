/** Keep browser source coordinates in the existing stack field when no useful Error stack is available. */
export function describeRendererError(event) {
  const error = event.error || event.reason;
  const message = String(event.message || error?.message || '页面运行异常');
  let stack = typeof error?.stack === 'string' ? error.stack : '';
  const hasSource = /:\d+:\d+\)?(?:\r?\n|$)/.test(stack);
  if (!hasSource && typeof event.filename === 'string' && event.filename
    && Number.isSafeInteger(event.lineno) && event.lineno > 0
    && Number.isSafeInteger(event.colno) && event.colno >= 0) {
    stack = `${stack || message}\n    at browser (${event.filename}:${event.lineno}:${event.colno})`;
  }
  return { module: 'renderer', errorType: event.type, severity: 'error', message, stack };
}
