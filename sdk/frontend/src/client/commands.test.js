import { describe, expect, it } from 'vitest';

import { sensorCommands } from './commands.js';

describe('zero commands', () => {
  it('targets exact canonical channel IDs', () => {
    const command = sensorCommands.zeroCapture({
      displaySystemId: 'chair-v2',
      channelIds: ['chair-v2:left', 'chair-v2:right'],
    });
    expect(command.type).toBe('calibration.zero');
    expect(command.payload).toEqual({
      enabled: true,
      displaySystemId: 'chair-v2',
      channelIds: ['chair-v2:left', 'chair-v2:right'],
    });
  });

  it('rejects an explicit empty target list instead of widening it to all channels', () => {
    expect(() => sensorCommands.zeroClear({ channelIds: [] })).toThrow(/must not be empty/);
  });

  it('rejects malformed target identity fields', () => {
    expect(() => sensorCommands.zeroCapture({ displaySystemId: '' })).toThrow(/too short|invalid format/);
    expect(() => sensorCommands.zeroCapture({ channelIds: ['seat'] })).toThrow(/invalid format/);
  });

  it('accepts manifest-compatible Unicode and internal-space identities', () => {
    expect(sensorCommands.zeroCapture({
      displaySystemId: '轮椅 A',
      channelIds: ['轮椅 A:左 侧'],
    }).payload).toEqual({
      enabled: true,
      displaySystemId: '轮椅 A',
      channelIds: ['轮椅 A:左 侧'],
    });
  });

  it('keeps the former no-argument behavior when callers pass null options', () => {
    expect(sensorCommands.zeroClear(null).payload).toEqual({ enabled: false });
  });
});
