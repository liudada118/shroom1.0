/** Join runtime revision metadata to the compact system list before offering submission actions. */
export function listSystemsWithRevisionStatus(status = {}) {
  const revisionDraftIds = new Set((status.runtimeDefinitions || [])
    .filter((definition) => definition.displayMetadata?.revisionDraft === true)
    .map((definition) => definition.displayMetadata?.id || definition.sensorDefinition?.displaySystemId
      || definition.sensorDefinition?.type));
  return (status.systems || []).map((system) => ({
    ...system,
    revisionDraft: system.runtimeDefinition?.displayMetadata?.revisionDraft === true
      || revisionDraftIds.has(system.id),
  }));
}

/** Only saved, editable local systems use the direct submit route; revision drafts have their own route. */
export function canSubmitLocalSystem(system) {
  return system?.editable === true && system.managed !== true && system.revisionDraft !== true
    && !/^revision_[a-f0-9]{20}$/.test(system.id || '');
}
