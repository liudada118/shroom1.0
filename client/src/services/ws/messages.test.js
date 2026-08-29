import { describe, expect, it } from 'vitest';
import { parseJsonMessage } from './messages';
import { getSensorFrameChannelValue } from './sensorFrameDecoder';

describe('parseJsonMessage', () => {
  it('在 WebSocket 接收边界保留 canonical payload 并按通道读取', () => {
    const message = parseJsonMessage({
      data: JSON.stringify({
        type: 'sensor.frame',
        schemaVersion: 1,
        channelId: 'chair:back',
        displaySystemId: 'chair',
        sensorId: 'back',
        outputChannel: 'back',
        payload: {
          value: [3, 4],
          stages: { processed: [3, 4] },
        },
      }),
    });

    expect(getSensorFrameChannelValue(message, 'back')).toEqual([3, 4]);
    expect(getSensorFrameChannelValue(message, 'sit')).toBeNull();
    expect(message.payload.value).toEqual([3, 4]);
    expect(message).not.toHaveProperty('backData');
  });

  it('继续透传系统对象和非 JSON 文本', () => {
    const systemMessage = { licenseChecking: true };
    expect(parseJsonMessage({ data: systemMessage })).toBe(systemMessage);
    expect(parseJsonMessage({ data: 'plain-text' })).toBe('plain-text');
  });
});
