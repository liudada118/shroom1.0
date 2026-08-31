const ZERO_STAGES = Object.freeze([
  'decoded',
  'normalized',
  'processed',
  'mapped',
]);

const ZERO_STAGE_SET = new Set(ZERO_STAGES);

function cloneFrame(frame) {
  return Array.isArray(frame) ? [...frame] : [];
}

function createStageState() {
  return ZERO_STAGES.reduce((state, stage) => {
    state[stage] = [];
    return state;
  }, {});
}

function cloneStageState(state = {}) {
  return ZERO_STAGES.reduce((snapshot, stage) => {
    snapshot[stage] = cloneFrame(state[stage]);
    return snapshot;
  }, {});
}

function parseChannelId(channelId) {
  if (typeof channelId !== 'string' || channelId !== channelId.trim()) return null;
  const parts = channelId.split(':');
  // canonical channelId 是严格的 `displaySystemId:sensorId` 两段式。
  // 如果组件本身允许冒号，单凭 channelId 就无法唯一还原身份。
  if (
    parts.length !== 2
    || !parts[0]
    || !parts[1]
    || parts.some((part) => part !== part.trim())
  ) return null;
  return {
    channelId,
    displaySystemId: parts[0],
    sensorId: parts[1],
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function resolveChannelIdentity(channelId, identity = {}) {
  const parsed = requireChannelId(channelId);
  const input = identity && typeof identity === 'object' ? identity : {};
  const hasExplicitIdentity = hasOwn(input, 'displaySystemId') || hasOwn(input, 'sensorId');

  if (hasOwn(input, 'channelId') && input.channelId !== channelId) {
    throw new TypeError('zero state identity channelId must match channelId');
  }

  if (!hasExplicitIdentity) return parsed;

  const displaySystemId = typeof input.displaySystemId === 'string'
    ? input.displaySystemId.trim()
    : '';
  const sensorId = typeof input.sensorId === 'string' ? input.sensorId.trim() : '';
  if (
    !displaySystemId
    || !sensorId
    || displaySystemId.includes(':')
    || sensorId.includes(':')
  ) {
    throw new TypeError(
      'zero state identity requires non-empty displaySystemId and sensorId without colons',
    );
  }
  if (`${displaySystemId}:${sensorId}` !== channelId) {
    throw new TypeError('zero state identity must match channelId');
  }
  return {
    channelId,
    displaySystemId,
    sensorId,
  };
}

function requireChannelId(channelId) {
  const parsed = parseChannelId(channelId);
  if (!parsed) {
    throw new TypeError('zero state requires a complete channelId');
  }
  return parsed;
}

function normalizeStage(stage) {
  const normalized = stage === 'raw' ? 'decoded' : stage;
  if (!ZERO_STAGE_SET.has(normalized)) {
    throw new TypeError(`unsupported zero state stage: ${String(stage)}`);
  }
  return normalized;
}

function normalizeIdentity(channel, identity = {}) {
  const input = identity && typeof identity === 'object' ? identity : {};
  const outputChannel = typeof input.outputChannel === 'string'
    && input.outputChannel.trim()
    ? input.outputChannel.trim()
    : channel.sensorId;
  return {
    ...input,
    channelId: channel.channelId,
    displaySystemId: channel.displaySystemId,
    sensorId: channel.sensorId,
    outputChannel,
  };
}

function normalizeRequestedChannelIds(channelIds) {
  const candidates = Array.isArray(channelIds)
    ? channelIds
    : (channelIds === undefined || channelIds === null ? [] : [channelIds]);
  const seen = new Set();
  return candidates.filter((channelId) => {
    if (seen.has(channelId)) return false;
    seen.add(channelId);
    return true;
  });
}

function createOperationResult() {
  return {
    affectedChannelIds: [],
    skipped: [],
  };
}

/**
 * 创建按 canonical channelId 隔离的零点状态仓库。
 *
 * 仓库只认识完整的 `displaySystemId:sensorId`，不会从 legacy 角色推断通道。
 * 每个通道分别保存最新 source 与已捕获 baseline，复用 sensorId 的展示系统
 * 也不会因此共享零点。
 */
function createZeroStateStore() {
  const channels = new Map();

  function getEntry(channelId) {
    return parseChannelId(channelId) ? channels.get(channelId) || null : null;
  }

  function snapshotEntry(entry) {
    if (!entry) return null;
    return {
      identity: { ...entry.identity },
      sources: cloneStageState(entry.sources),
      baselines: cloneStageState(entry.baselines),
    };
  }

  function updateSources(channelId, stages = {}, identity = {}) {
    // 显式 identity 存在时必须与 canonical channelId 相互校验，
    // 不再用“第一个冒号”静默重写 displaySystemId / sensorId。
    const channel = resolveChannelIdentity(channelId, identity);
    const current = channels.get(channelId);
    const entry = current || {
      identity: normalizeIdentity(channel, identity),
      sources: createStageState(),
      baselines: createStageState(),
    };

    entry.identity = normalizeIdentity(channel, {
      ...entry.identity,
      ...(identity && typeof identity === 'object' ? identity : {}),
    });

    const input = stages && typeof stages === 'object' ? stages : {};
    for (const stage of ZERO_STAGES) {
      const value = stage === 'decoded' && !Array.isArray(input.decoded)
        ? input.raw
        : input[stage];
      // source 是同一物理帧的原子快照。当前帧没有某个阶段时必须清空，
      // 否则下一次 capture 会把旧帧的 mapped 与新帧的 processed 拼在一起。
      entry.sources[stage] = Array.isArray(value) ? cloneFrame(value) : [];
    }

    channels.set(channelId, entry);
    return snapshotEntry(entry);
  }

  function getSources(channelId) {
    const entry = getEntry(channelId);
    return entry ? cloneStageState(entry.sources) : null;
  }

  function getBaselines(channelId) {
    const entry = getEntry(channelId);
    return entry ? cloneStageState(entry.baselines) : null;
  }

  function getBaseline(channelId, stage) {
    const normalizedStage = normalizeStage(stage);
    const entry = getEntry(channelId);
    return entry ? cloneFrame(entry.baselines[normalizedStage]) : [];
  }

  function capture(channelIds) {
    const result = createOperationResult();
    for (const channelId of normalizeRequestedChannelIds(channelIds)) {
      if (!parseChannelId(channelId)) {
        result.skipped.push({ channelId, reason: 'invalid-channel-id' });
        continue;
      }
      const entry = channels.get(channelId);
      if (!entry) {
        result.skipped.push({ channelId, reason: 'unknown-channel' });
        continue;
      }

      const captured = ZERO_STAGES.some((stage) => entry.sources[stage].length > 0);

      if (captured) {
        // 四阶段一起替换：当前帧缺少的阶段明确变为空，不能保留另一帧的旧基准。
        entry.baselines = cloneStageState(entry.sources);
        result.affectedChannelIds.push(channelId);
      } else {
        result.skipped.push({ channelId, reason: 'no-source-data' });
      }
    }
    return result;
  }

  function clear(channelIds) {
    const result = createOperationResult();
    for (const channelId of normalizeRequestedChannelIds(channelIds)) {
      if (!parseChannelId(channelId)) {
        result.skipped.push({ channelId, reason: 'invalid-channel-id' });
        continue;
      }
      const entry = channels.get(channelId);
      if (!entry) {
        result.skipped.push({ channelId, reason: 'unknown-channel' });
        continue;
      }
      entry.baselines = createStageState();
      result.affectedChannelIds.push(channelId);
    }
    return result;
  }

  function listChannelIds({ displaySystemId, withSourcesOnly = false } = {}) {
    return Array.from(channels.entries())
      .filter(([, entry]) => (
        displaySystemId === undefined || entry.identity.displaySystemId === displaySystemId
      ))
      .filter(([, entry]) => (
        !withSourcesOnly
        || ZERO_STAGES.some((stage) => entry.sources[stage].length > 0)
      ))
      .map(([channelId]) => channelId)
      .sort();
  }

  function snapshot(channelId) {
    if (channelId !== undefined) return snapshotEntry(getEntry(channelId));
    return listChannelIds().reduce((state, id) => {
      state[id] = snapshotEntry(channels.get(id));
      return state;
    }, {});
  }

  function apply(channelId, stage, frame) {
    requireChannelId(channelId);
    const normalizedStage = normalizeStage(stage);
    if (!Array.isArray(frame)) return [];
    const input = cloneFrame(frame);
    const baseline = channels.get(channelId)?.baselines[normalizedStage];
    if (!Array.isArray(baseline) || baseline.length !== input.length || baseline.length === 0) {
      return input;
    }
    return input.map((value, index) => {
      const numericValue = Number(value);
      const numericBaseline = Number(baseline[index]);
      if (!Number.isFinite(numericValue) || !Number.isFinite(numericBaseline)) return value;
      return Math.max(0, numericValue - numericBaseline);
    });
  }

  return {
    updateSources,
    getSources,
    getBaselines,
    getBaseline,
    capture,
    clear,
    listChannelIds,
    snapshot,
    apply,
  };
}

module.exports = {
  ZERO_STAGES,
  createZeroStateStore,
};
