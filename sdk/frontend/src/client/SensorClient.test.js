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
});
