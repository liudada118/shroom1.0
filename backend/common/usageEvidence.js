let adapter = null;
const providers = new Map();

/** Capture the desktop's current consent and owner identity without making backend startup depend on it. */
function captureUsageEvidenceContext() {
  try { return adapter?.captureContext?.() || null; } catch { return null; }
}

/** Freeze a host-validated envelope before committing it alongside collection evidence. */
function prepareUsageEvidence(input, context) {
  if (!context) return { state: 'suppressed', reason: 'USAGE_CONTEXT_UNAVAILABLE' };
  try { return adapter?.prepareEvidence?.(input, context) || { state: 'suppressed', reason: 'USAGE_ADAPTER_UNAVAILABLE' }; }
  catch { return { state: 'dropped', reason: 'USAGE_PREPARATION_FAILED' }; }
}

/** Record a nonterminal event in the same captured scope without exposing host identity to renderer IPC. */
function recordUsageEvidence(input, context) {
  if (!context) return false;
  try { return adapter?.recordEvidence?.(input, context) || false; } catch { return false; }
}

/** Attach committed outboxes now or when the desktop sender becomes available later in startup. */
function registerUsageOutbox(provider) {
  let unregister = null;
  try {
    if (adapter) provider.onAdapterReady?.();
    unregister = adapter?.registerOutbox?.(provider) || null;
  } catch { /* The persistent provider remains recoverable. */ }
  providers.set(provider, unregister);
  return () => { try { providers.get(provider)?.(); } finally { providers.delete(provider); } };
}

/** Install the trusted desktop adapter; replacing it detaches listeners without changing stored evidence. */
function setUsageEvidenceAdapter(next) {
  for (const [provider, unregister] of providers) {
    try { unregister?.(); } catch { /* A failed observer cannot stop collection. */ }
    providers.set(provider, null);
  }
  adapter = next || null;
  for (const provider of providers.keys()) {
    try {
      if (adapter) provider.onAdapterReady?.();
      providers.set(provider, adapter?.registerOutbox?.(provider) || null);
    } catch { /* A later attachment may retry. */ }
  }
  return () => { if (adapter === next) setUsageEvidenceAdapter(null); };
}

module.exports = { setUsageEvidenceAdapter, captureUsageEvidenceContext, prepareUsageEvidence, recordUsageEvidence, registerUsageOutbox };
