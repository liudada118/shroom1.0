import { describe, expect, it } from 'vitest';
import { canSubmitLocalSystem, listSystemsWithRevisionStatus } from './companySystemSubmission.js';

describe('local system submission eligibility', () => {
  it('joins revision metadata that is absent from the compact Manifest list', () => {
    const [local, revision, managed, native] = listSystemsWithRevisionStatus({
      systems: [
        { id: 'seatpad2', editable: true },
        { id: 'revision_0123456789abcdefabcd', editable: true },
        { id: 'company-seat', editable: false, managed: true },
        { id: 'hand_copy', kind: 'builtin-template', editable: true },
      ],
      runtimeDefinitions: [{ displayMetadata: { id: 'revision_0123456789abcdefabcd', revisionDraft: true } }],
    });
    expect(canSubmitLocalSystem(local)).toBe(true);
    expect(canSubmitLocalSystem(revision)).toBe(false);
    expect(canSubmitLocalSystem(managed)).toBe(false);
    expect(canSubmitLocalSystem(native)).toBe(true);
  });

  it('does not offer submission for an unmarked revision-shaped ID or an unwritable native copy', () => {
    expect(canSubmitLocalSystem({ id: 'revision_0123456789abcdefabcd', editable: true })).toBe(false);
    expect(canSubmitLocalSystem({ id: 'hand_copy', kind: 'builtin-template', editable: false })).toBe(false);
  });
});
