/** Find the one local draft based on this exact published system version. */
export function findDraftForRelease(drafts, release) {
  return drafts.find((draft) => draft.targetSystemId === release.systemId && draft.baseVersion === release.version) || null;
}

/** Return the latest known published version, or null while the remote catalog is unavailable. */
export function latestPublishedVersion(releases, systemId) {
  const versions = releases.filter((release) => release.systemId === systemId && Number.isSafeInteger(release.version))
    .map((release) => release.version);
  return versions.length ? Math.max(...versions) : null;
}

/** Identify a draft whose base is older than the latest published release. */
export function isStaleDraft(draft, releases) {
  const latest = latestPublishedVersion(releases, draft.targetSystemId);
  return latest !== null && draft.baseVersion < latest;
}
