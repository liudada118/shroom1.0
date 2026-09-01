import { describe, expect, it, vi } from 'vitest';
import {
  SensorClient,
  normalizeSubscriptionChannels,
  resolveChannelId,
} from './SensorClient.js';

class FakeWebSocket {
  static CONNECTING = 0;

  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({ type: 'open' });
  }

  send(message) {
    this.sent.push(JSON.parse(message));
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ type: 'close' });
  }
}

describe('canonical subscription channel IDs', () => {
  it('accepts channelId directly or composes displaySystemId:sensorId', () => {
    expect(resolveChannelId('chair:sit')).toBe('chair:sit');
    expect(resolveChannelId({ channelId: 'chair:back' })).toBe('chair:back');
    expect(resolveChannelId(
      { displaySystemId: 'bed', sensorId: 'head' },
    )).toBe('bed:head');
    expect(resolveChannelId('sit', { displaySystemId: 'chair' })).toBe('chair:sit');
    expect(resolveChannelId('*', { displaySystemId: 'chair' })).toBe('*');
  });

  it('deduplicates canonical IDs and preserves legacy aliases without a display system', () => {
    expect(normalizeSubscriptionChannels([
      'sit',
      { sensorId: 'sit' },
      { channelId: 'chair:back' },
      { displaySystemId: 'chair', sensorId: 'back' },
      null,
      '',
    ], { displaySystemId: 'chair' })).toEqual(['chair:sit', 'chair:back']);

    expect(normalizeSubscriptionChannels(['sit', 'back'])).toEqual(['sit', 'back']);
  });

  it('auto-subscribes with canonical IDs when displaySystemId is configured', () => {
    const client = new SensorClient({
      WebSocketImpl: FakeWebSocket,
      displaySystemId: 'chair-display',
      channels: ['sit', { sensorId: 'back' }, 'sit'],
    });

    const socket = client.connect();
    socket.open();

    expect(socket.sent).toEqual([{
      type: 'subscribe',
      channels: ['chair-display:sit', 'chair-display:back'],
    }]);
  });

  it('normalizes direct subscribe and unsubscribe calls', () => {
    const client = new SensorClient({ WebSocketImpl: FakeWebSocket });
    const socket = client.connect();
    socket.open();

    expect(client.subscribe([
      { displaySystemId: 'bed', sensorId: 'sit' },
      { channelId: 'bed:back' },
    ])).toEqual(['bed:sit', 'bed:back']);
    expect(client.unsubscribe('head', { displaySystemId: 'bed' })).toEqual(['bed:head']);

    expect(socket.sent).toEqual([
      { type: 'subscribe', channels: ['bed:sit', 'bed:back'] },
      { type: 'unsubscribe', channels: ['bed:head'] },
    ]);
  });
});

describe('SensorClient canonical frame events', () => {
  it('emits the normalized SDK frame and canonical type event', () => {
    const client = new SensorClient({ WebSocketImpl: FakeWebSocket });
    const frameListener = vi.fn();
    const channelListener = vi.fn();
    const legacyChannelListener = vi.fn();
    const canonicalListener = vi.fn();
    client.on('frame', frameListener);
    client.on('frame:demo:sit', channelListener);
    client.on('frame:shared:sit', legacyChannelListener);
    client.on('sensor.frame', canonicalListener);

    const envelope = {
      type: 'sensor.frame',
      schemaVersion: 1,
      channelId: 'demo:sit',
      displaySystemId: 'demo',
      sensorId: 'sit',
      sensorType: 'shared',
      outputChannel: 'sit',
      timestamp: 123,
      payload: {
        value: [1, 2, 3, 4],
        matrix: { rows: 2, cols: 2 },
      },
    };

    client.handleMessage(JSON.stringify(envelope));

    expect(frameListener).toHaveBeenCalledTimes(1);
    expect(frameListener).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'demo:sit',
      channel: 'sit',
      data: [1, 2, 3, 4],
    }));
    expect(channelListener).toHaveBeenCalledTimes(1);
    expect(legacyChannelListener).toHaveBeenCalledTimes(1);
    expect(canonicalListener).toHaveBeenCalledWith(envelope);
  });

  it('routes malformed and future declared frames only to invalidFrame', () => {
    const client = new SensorClient({ WebSocketImpl: FakeWebSocket });
    const frameListener = vi.fn();
    const channelListener = vi.fn();
    const canonicalListener = vi.fn();
    const invalidFrameListener = vi.fn();
    client.on('frame', frameListener);
    client.on('frame:demo:sit', channelListener);
    client.on('sensor.frame', canonicalListener);
    client.on('invalidFrame', invalidFrameListener);

    const baseFrame = {
      type: 'sensor.frame',
      schemaVersion: 1,
      channelId: 'demo:sit',
      displaySystemId: 'demo',
      sensorId: 'sit',
      outputChannel: 'sit',
      payload: { value: [1, null, 3] },
      sitData: [99],
    };
    const invalidFrames = [
      { ...baseFrame, schemaVersion: 2 },
      { ...baseFrame, payload: { stages: { processed: [1, 2] } } },
      { ...baseFrame, payload: { value: [1, '2'] } },
      { ...baseFrame, channelId: 'other:sit' },
    ];

    invalidFrames.forEach((frame) => client.handleMessage(JSON.stringify(frame)));

    expect(invalidFrameListener.mock.calls.map(([value]) => value)).toEqual(invalidFrames);
    expect(frameListener).not.toHaveBeenCalled();
    expect(channelListener).not.toHaveBeenCalled();
    expect(canonicalListener).not.toHaveBeenCalled();
  });
});

describe('SensorClient serial protocol detection', () => {
  it('posts the physical path and optional preset ids through the contract route', async () => {
    const fetchImpl = vi.fn(async (url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          status: 'matched',
          match: { id: 'standard-1024', protocol: { baudRate: 1000000 } },
          candidates: [],
        },
        message: 'success',
      }),
    }));
    const client = new SensorClient({
      httpBaseUrl: 'http://backend.test',
      fetchImpl,
      routes: { serialProtocolDetect: '/custom/protocol-detect' },
    });

    const result = await client.serial.detectProtocol({
      path: 'COM7',
      candidateIds: ['standard-1024'],
    });

    expect(result.status).toBe('matched');
    expect(result.match.id).toBe('standard-1024');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://backend.test/custom/protocol-detect',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'COM7', candidateIds: ['standard-1024'] }),
      }),
    );
  });

  it('exposes the stable backend error code and HTTP status', async () => {
    const client = new SensorClient({
      httpBaseUrl: 'http://backend.test',
      fetchImpl: vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          code: 1,
          data: {},
          message: 'serial port is busy',
          errorCode: 'SERIAL_PORT_BUSY',
        }),
      })),
    });

    await expect(client.serial.detectProtocol({ path: 'COM7' })).rejects.toMatchObject({
      code: 'SERIAL_PORT_BUSY',
      status: 409,
      message: 'serial port is busy',
    });
  });
});
