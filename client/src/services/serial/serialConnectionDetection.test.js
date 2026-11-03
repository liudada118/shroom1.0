import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectSerialConnection, waitForSerialConnectionData, serialDetectionAction } from './serialConnectionDetection';
import resources from '../../i18n/resources';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('serial connection detection', () => {
  it('sends native identity and cancellation signal and unwraps HttpResult data', async () => {
    const result = { status: 'matched', compatible: true, match: { protocol: { baudRate: 921600 } } };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 0, data: result }) });
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    expect(await detectSerialConnection({ path: 'COM3', sensorType: 'fast256', role: 'sit', signal: controller.signal })).toEqual(result);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', signal: controller.signal });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ path: 'COM3', connection: { sensorType: 'fast256', role: 'sit' } });
  });

  it('preserves the host error code instead of interpreting a failure as unsupported', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409,
      json: async () => ({ code: 1, errorCode: 'COLLECTION_ACTIVE', msg: 'recording' }) }));
    await expect(detectSerialConnection({ path: 'COM3' })).rejects.toMatchObject({ code: 'COLLECTION_ACTIVE' });
  });

  it('fallback sends the exact default connection identity for host-side conditional close', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 0, data: { status: 'reading' } }) });
    vi.stubGlobal('fetch', fetch);
    expect(await detectSerialConnection({ path: 'COM3', sensorType: 'fast256', role: 'sit', connectionId: 7 })).toEqual({ status: 'reading' });
    expect(JSON.parse(fetch.mock.calls[0][1].body).connection).toEqual({ sensorType: 'fast256', role: 'sit', connectionId: 7 });
  });

  it('fails closed for unrecognized baud rates and unknown results', () => {
    expect(serialDetectionAction({ status: 'matched', compatible: true, defaultBaudRate: 115200,
      match: { protocol: { baudRate: 115200 } } })).toBe('notice');
    expect(serialDetectionAction({ status: 'matched', compatible: false })).toBe('notice');
    expect(serialDetectionAction(null)).toBe('notice');
    expect(serialDetectionAction({ status: 'unsupported' })).toBe('default');
  });

  it('has native identification copy and protocol names in all interface languages', () => {
    const expectedKeys = Object.keys(resources.zh.translation.monitorUi).filter(key => key.startsWith('serialDetect') || key.startsWith('serialProtocol_'));
    expect(expectedKeys.length).toBeGreaterThan(15);
    for (const language of ['zh', 'en', 'ja']) {
      for (const key of expectedKeys) expect(resources[language].translation.monitorUi[key]).toBeTruthy();
      expect(resources[language].translation.common.cancel).toBeTruthy();
    }
    expect(resources.zh.translation.common.cancel).toBe('取消');
  });
});

const connection = { path: 'COM3', role: 'sit', connectionId: 7, systemId: 'fast256' };

/** 生成按当前物理连接提供的宿主有效帧状态；ready不取决于压力是否大于零。 */
function dataStatus(patch = {}) {
  return { collectionSourceStatus: { systemId: 'fast256' }, serialDataStatus: [
    { path: 'COM3', role: 'sit', connectionId: 7, isOpen: true, ready: false, detectionSupported: true, ...patch },
  ] };
}

describe('default connection data readiness', () => {
  it('valid default data ends waiting immediately and needs no probe', async () => {
    const readStatus = vi.fn().mockResolvedValue(dataStatus({ ready: true, lastFrameAgeMs: 0 }));
    expect(await waitForSerialConnectionData({ ...connection, readStatus })).toBe('ready');
    expect(readStatus).toHaveBeenCalledOnce();
  });

  it('only two seconds of explicit no-data permits fallback and rereads at the boundary', async () => {
    vi.useFakeTimers();
    const readStatus = vi.fn().mockResolvedValue(dataStatus());
    let done = false;
    const pending = waitForSerialConnectionData({ ...connection, readStatus }).then(result => { done = true; return result; });
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe('no-data');
    expect(readStatus).toHaveBeenCalledTimes(11);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([{ role: 'back' }, { connectionId: 6 }, { path: 'COM4' }, { isOpen: false }])('another or closed connection never supplies readiness: %j', async patch => {
    expect(await waitForSerialConnectionData({ ...connection, readStatus: async () => dataStatus({ ...patch, ready: true }) })).toBe('changed');
  });

  it('a system change, unsupported protocol, old host or failed status request cannot trigger fallback', async () => {
    expect(await waitForSerialConnectionData({ ...connection, readStatus: async () => ({ ...dataStatus(), collectionSourceStatus: { systemId: 'hand' } }) })).toBe('changed');
    expect(await waitForSerialConnectionData({ ...connection, readStatus: async () => dataStatus({ detectionSupported: false }) })).toBe('unsupported');
    expect(await waitForSerialConnectionData({ ...connection, readStatus: async () => ({}) })).toBe('unavailable');
    expect(await waitForSerialConnectionData({ ...connection, readStatus: async () => { throw new Error('offline'); } })).toBe('unavailable');
  });

  it('cancellation clears polling and prevents later checks', async () => {
    vi.useFakeTimers();
    const controller = new AbortController(), readStatus = vi.fn().mockResolvedValue(dataStatus());
    const pending = waitForSerialConnectionData({ ...connection, readStatus, signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow('cancelled');
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new Error('cancelled'));
    await rejected;
    await vi.advanceTimersByTimeAsync(4000);
    expect(readStatus).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a hanging status request times out without claiming no data or closing the default port', async () => {
    vi.useFakeTimers();
    const readStatus = signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    const pending = waitForSerialConnectionData({ ...connection, readStatus });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe('unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });
});
