import { describe, expect, it } from 'vitest';
import { findDraftForRelease, isStaleDraft, latestPublishedVersion } from './companyRevisionVersions.js';

const releases = [{ systemId: 'seatpad2', version: 4 }, { systemId: 'other', version: 2 }];
const drafts = [
  { draftId: 'revision_old', targetSystemId: 'seatpad2', baseVersion: 3, available: true },
  { draftId: 'revision_other', targetSystemId: 'other', baseVersion: 2, available: true },
];

describe('company revision version selection', () => {
  it('offers a new draft for version 4 while keeping a version 3 draft separately', () => {
    expect(findDraftForRelease(drafts, releases[0])).toBeNull();
    expect(isStaleDraft(drafts[0], releases)).toBe(true);
    expect(findDraftForRelease([...drafts, { draftId: 'revision_new', targetSystemId: 'seatpad2', baseVersion: 4 }], releases[0])?.draftId)
      .toBe('revision_new');
  });

  it('does not call a saved draft stale when the published catalog cannot be read', () => {
    expect(latestPublishedVersion([], 'seatpad2')).toBeNull();
    expect(isStaleDraft(drafts[0], [])).toBe(false);
    expect(findDraftForRelease(drafts, releases[1])?.draftId).toBe('revision_other');
  });
});
