const IDENTIFIER = /^[A-Za-z0-9_.:-]{1,80}$/;
const UUID = /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const V2_EVENTS = new Set(['usage_delivery_summary', 'collection_outcome_reconciled']);
const COUNTERS = new Set(['committedRows', 'failedRows', 'frameCount', 'queuedCount', 'droppedCount', 'invalidCount',
  'expiredCount', 'capacityDroppedCount', 'storageFailureCount', 'suppressedCount', 'repeatedCount']);
const ENUMS = {
  outcome: ['saved', 'partial', 'failed', 'cancelled', 'unknown'],
  usageContext: ['customer', 'internal', 'demo', 'test'],
  summaryKind: ['page_residence', 'legacy_frame_window'],
};
const V2_PROPERTIES = new Set([...COUNTERS, ...Object.keys(ENUMS), 'collectionId', 'stopReason',
  'outcomeRevision', 'supersedesEventId', 'oldestQueuedAt', 'qualityId']);

/** Validate only the additional v2 metadata; sensor values and arbitrary objects remain forbidden. */
function normalizeV2Property(name, value) {
  let valid = false;
  if (COUNTERS.has(name)) valid = Number.isSafeInteger(value) && value >= 0 && value <= 1e12;
  else if (ENUMS[name]) valid = ENUMS[name].includes(value);
  else if (name === 'outcomeRevision') valid = Number.isSafeInteger(value) && value >= 0 && value <= 1e9;
  else if (name === 'supersedesEventId' || name === 'qualityId') valid = typeof value === 'string' && UUID.test(value);
  else if (name === 'oldestQueuedAt') valid = typeof value === 'string' && value.length <= 40
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  else valid = typeof value === 'string' && IDENTIFIER.test(value);
  if (!valid) throw new Error('USAGE_EVENT_INVALID');
  return value;
}

/** Keep collection outcomes distinguishable from control acknowledgements and old v1 observations. */
function validateV2Event(eventName, properties) {
  if (['collection_started', 'collection_finished', 'collection_outcome_reconciled'].includes(eventName)
    && !properties.collectionId) throw new Error('USAGE_COLLECTION_ID_REQUIRED');
  if (['collection_finished', 'collection_outcome_reconciled'].includes(eventName)) {
    const result = { saved: 'success', partial: 'failure', failed: 'failure', cancelled: 'cancelled', unknown: 'unknown' }[properties.outcome];
    if (!result || properties.result !== result || !properties.stopReason
      || !Number.isSafeInteger(properties.outcomeRevision)
      || !['committedRows', 'failedRows', 'frameCount'].every(name => Number.isSafeInteger(properties[name]))) throw new Error('USAGE_COLLECTION_OUTCOME_INVALID');
    if (eventName === 'collection_finished' ? properties.outcomeRevision !== 0 || properties.supersedesEventId !== undefined
      : properties.outcomeRevision < 1 || !properties.supersedesEventId) throw new Error('USAGE_COLLECTION_REVISION_INVALID');
  } else if (properties.outcome !== undefined || properties.outcomeRevision !== undefined || properties.supersedesEventId !== undefined) {
    throw new Error('USAGE_COLLECTION_REVISION_INVALID');
  }
  if (eventName === 'usage_delivery_summary' && (!properties.qualityId
    || !['queuedCount', 'droppedCount', 'invalidCount'].every(name => Number.isSafeInteger(properties[name])))) throw new Error('USAGE_QUALITY_INVALID');
}

module.exports = { V2_EVENTS, V2_PROPERTIES, normalizeV2Property, validateV2Event };
