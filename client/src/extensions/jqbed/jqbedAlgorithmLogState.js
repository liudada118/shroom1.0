export function jqbedAlgorithmLogFrameKey(frame) {
  if (!frame || frame.sensorType !== 'jqbed' || !frame.outputs
    || typeof frame.outputs !== 'object' || Array.isArray(frame.outputs)) return null;
  return `${frame.sequence}:${frame.receivedAt}`;
}

export function isJqbedLogMissing(value) {
  if (!Array.isArray(value)) return value === -1;
  let hasLeaf = false;
  const allMissing = (node) => {
    if (Array.isArray(node)) return node.every(allMissing);
    hasLeaf = true;
    return node === -1;
  };
  return allMissing(value) && hasLeaf;
}

export function mergeJqbedAlgorithmLogFrame(previous, incoming) {
  if (jqbedAlgorithmLogFrameKey(incoming) === null) return null;
  const outputs = Object.assign(Object.create(null),
    jqbedAlgorithmLogFrameKey(previous) === null ? {} : previous.outputs);
  Object.entries(incoming.outputs).forEach(([key, value]) => {
    if (!isJqbedLogMissing(value) || !Object.hasOwn(outputs, key)) outputs[key] = value;
  });
  return { ...incoming, outputs };
}

export function createJqbedLiveLogState(initialFrame) {
  let latest = null;
  let seen = jqbedAlgorithmLogFrameKey(initialFrame);
  return {
    observe(frame, receiving) {
      const key = jqbedAlgorithmLogFrameKey(frame);
      const fresh = key !== null && key !== seen;
      if (key !== null) seen = key;
      if (key === null || !receiving) latest = null;
      else if (fresh) latest = mergeJqbedAlgorithmLogFrame(latest, frame);
      return latest;
    },
    reset(frame) {
      seen = jqbedAlgorithmLogFrameKey(frame);
      latest = null;
      return latest;
    },
  };
}

export function createJqbedLogSubscription() {
  let current = null;
  const stop = () => {
    if (!current) return;
    const { subscribe } = current;
    current = null;
    subscribe(false);
  };
  return {
    update({ enabled, connectionEpoch, subscribe }) {
      if (current && enabled && current.connectionEpoch === connectionEpoch && current.subscribe === subscribe) {
        return current.result;
      }
      stop();
      if (!enabled || typeof subscribe !== 'function') return { attempted: false, requestId: null };
      const result = { attempted: true, requestId: subscribe(true) || null };
      current = { connectionEpoch, subscribe, result };
      return result;
    },
    stop,
  };
}
