import { describe, expect, it } from 'vitest';

import { toLegacyCommand } from './legacyCommands.js';

describe('legacy command conversion', () => {
  it('preserves exact dynamic targets for calibration.zero', () => {
    expect(toLegacyCommand({
      type: 'calibration.zero',
      payload: {
        enabled: true,
        displaySystemId: 'chair-v2',
        channelIds: ['chair-v2:left', 'chair-v2:right'],
      },
    })).toEqual({
      resetZero: true,
      displaySystemId: 'chair-v2',
      channelIds: ['chair-v2:left', 'chair-v2:right'],
    });
  });

  it('preserves an explicit empty target list', () => {
    expect(toLegacyCommand({
      type: 'calibration.zero',
      payload: { enabled: false, channelIds: [] },
    })).toEqual({ resetZero: false, channelIds: [] });
  });
});
