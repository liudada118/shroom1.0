import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushUsageCommits, setUsageSystemContext, trackUsage, trackUsageCommit, trackUsageOperation } from './usageAnalytics';

afterEach(() => { flushUsageCommits(); setUsageSystemContext(); vi.useRealTimers(); vi.unstubAllGlobals(); });
/** Install an isolated desktop bridge without sending events to a real server. */
function bridge() { const invoke = vi.fn(async () => {}); vi.stubGlobal('window', { electronAPI: { services: { invoke } } }); return invoke; }

describe('usage helpers', () => {
  it('does not interrupt controls when the bridge is absent, throws or rejects', async () => {
    vi.stubGlobal('window', {}); expect(() => trackUsage('analysis_tool_used')).not.toThrow();
    const invoke = bridge(); invoke.mockImplementation(() => { throw new Error('bridge unavailable'); });
    expect(() => trackUsage('analysis_tool_used')).not.toThrow();
    invoke.mockRejectedValue(new Error('IPC unavailable'));
    await expect(trackUsageOperation('analysis_tool_used', {}, () => 12)).resolves.toBe(12);
  });
  it('keeps async outcomes tied to their starting system and preserves the original exception', async () => {
    const invoke = bridge(); setUsageSystemContext({ systemType: 'old', systemOrigin: 'custom' });
    let finish; const operation = trackUsageOperation('algorithm_result', { featureId: 'algorithms' }, () => new Promise(resolve => { finish = resolve; }));
    setUsageSystemContext({ systemType: 'new', systemOrigin: 'builtin' }); finish({ ok: true, secret: 'not-uploaded' }); await operation;
    expect(invoke.mock.calls.at(-1)[1].properties.systemType).toBe('old');
    const error = Object.assign(new Error('private details'), { code: 'FIXTURE_ERROR' });
    await expect(trackUsageOperation('algorithm_result', {}, () => { throw error; })).rejects.toBe(error);
    expect(invoke.mock.calls.at(-1)[1].properties).toMatchObject({ result: 'failure', errorCode: 'FIXTURE_ERROR' });
    expect(JSON.stringify(invoke.mock.calls)).not.toContain('private details');
    expect(JSON.stringify(invoke.mock.calls)).not.toContain('secret');
  });
  it('coalesces continuous adjustments and flushes once on system exit', () => {
    vi.useFakeTimers(); const invoke = bridge(), release = setUsageSystemContext({ systemType: 'matrix', systemOrigin: 'custom' });
    for (let i = 0; i < 100; i++) trackUsageCommit('analysis_tool_used', { featureId: 'playback_control', action: 'seek', result: 'success' });
    expect(invoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(500); expect(invoke).toHaveBeenCalledOnce();
    trackUsageCommit('analysis_tool_used', { featureId: 'playback_control', action: 'threshold' }); release(); vi.advanceTimersByTime(500);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls.at(-1)[1].properties.systemType).toBe('matrix');
  });
});
