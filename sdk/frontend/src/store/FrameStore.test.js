import { describe, expect, it } from 'vitest';
import { createFrameKey, FrameStore } from './FrameStore.js';

describe('FrameStore canonical channel identity', () => {
  it('uses channelId so equal sensorType/outputChannel values do not collide', () => {
    const store = new FrameStore();
    const first = {
      channelId: 'seat-a:sit',
      displaySystemId: 'seat-a',
      sensorId: 'sit',
      sensorType: 'shared-seat',
      channel: 'sit',
      data: [1],
    };
    const second = {
      ...first,
      channelId: 'seat-b:sit',
      displaySystemId: 'seat-b',
      data: [2],
    };

    store.update(first);
    store.update(second);

    expect(store.frames.size).toBe(2);
    expect(store.getFrameByChannelId('seat-a:sit')).toBe(first);
    expect(store.getFrameByChannelId('seat-b:sit')).toBe(second);
    expect(store.getFrame('ignored', 'sit', { displaySystemId: 'seat-b' })).toBe(second);
  });

  it('keeps the historical sensorType/channel key for legacy normalized frames', () => {
    const legacy = { sensorType: 'hand', channel: 'sit', data: [3] };
    const store = new FrameStore();
    store.update(legacy);

    expect(createFrameKey(legacy)).toBe('hand:sit');
    expect(store.getFrame('hand', 'sit')).toBe(legacy);
  });
});
