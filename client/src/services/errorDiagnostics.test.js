import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeRendererError } from './errorDiagnostics';
import { setUsageSystemContext, trackUsage } from './usageAnalytics';

afterEach(() => { setUsageSystemContext(); vi.unstubAllGlobals(); });

describe('browser error diagnostics', () => {
  it('retains ErrorEvent coordinates when the browser does not provide an Error object', () => {
    const properties = describeRendererError({ type: 'error', message: "Cannot read properties of null (reading '0')",
      filename: 'http://127.0.0.1:12321/assets/Home-Abc.js', lineno: 1, colno: 4332 });
    expect(properties.stack).toContain('at browser (http://127.0.0.1:12321/assets/Home-Abc.js:1:4332)');
    expect(properties.module).toBe('renderer');
    expect(properties.errorType).toBe('error');
  });

  it('supplements a message-only stack but preserves an existing useful stack', () => {
    const event = { type: 'error', message: 'failed', filename: 'https://host/app.js', lineno: 4, colno: 9,
      error: { stack: 'TypeError: failed' } };
    expect(describeRendererError(event).stack).toContain('app.js:4:9');
    event.error.stack = 'TypeError: failed\n    at C (http://host/old.js:2:3)';
    expect(describeRendererError(event).stack).toBe(event.error.stack);
  });

  it('supports rejected promises and does not invent missing source coordinates', () => {
    const reason = new Error('Promise failed');
    expect(describeRendererError({ type: 'unhandledrejection', reason })).toMatchObject({ message: reason.message, stack: reason.stack });
    for (const lineno of [undefined, 0, -1, NaN, Infinity]) {
      expect(describeRendererError({ type: 'error', message: 'failed', filename: 'app.js', lineno, colno: 9 }).stack).toBe('');
    }
  });

  it('uses the existing bridge so the active system identity is retained', () => {
    const invoke = vi.fn(async () => {});
    vi.stubGlobal('window', { electronAPI: { services: { invoke } } });
    setUsageSystemContext({ systemType: 'hand', systemOrigin: 'builtin' });
    trackUsage('error_reported', describeRendererError({ type: 'error', message: 'failed', filename: 'app.js', lineno: 1, colno: 0 }));
    expect(invoke.mock.calls[0]).toEqual(['recordUsage', { eventName: 'error_reported', properties: {
      systemType: 'hand', systemOrigin: 'builtin', module: 'renderer', errorType: 'error', severity: 'error',
      message: 'failed', stack: 'failed\n    at browser (app.js:1:0)',
    } }]);
  });
});
