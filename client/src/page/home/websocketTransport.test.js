import { describe, expect, it, vi } from 'vitest';
import { sendWebSocketJson } from './websocketTransport';

describe('sendWebSocketJson', () => {
  it('returns true only after an open socket accepts the serialized frame', () => {
    const send = vi.fn();

    expect(sendWebSocketJson({ readyState: 1, send }, { requestId: 'load-1' })).toBe(true);
    expect(send).toHaveBeenCalledWith('{"requestId":"load-1"}');
  });

  it('returns false without sending when the socket is not open', () => {
    const send = vi.fn();

    expect(sendWebSocketJson({ readyState: 0, send }, { requestId: 'load-2' })).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(sendWebSocketJson(null, { requestId: 'load-3' })).toBe(false);
  });

  it('returns false when an open socket throws while sending', () => {
    const send = vi.fn(() => { throw new Error('connection disappeared'); });

    expect(sendWebSocketJson({ readyState: 1, send }, { requestId: 'save-1' })).toBe(false);
  });
});
