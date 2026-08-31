function cloneNumericFrame(value) {
  return Array.isArray(value) ? value.map((item) => Number(item)) : null;
}

function firstFrame(...candidates) {
  for (const candidate of candidates) {
    const frame = cloneNumericFrame(candidate);
    // legacy payload 常会保留一个空的通用字段，同时在
    // sitData/backData/动态通道字段里携带真实帧。空数组不能
    // 抢占优先级，否则后续 capture 会误判为没有 source。
    if (frame?.length) return frame;
  }
  return null;
}

function getLegacyDataField(outputChannel) {
  if (outputChannel === 'back') return 'backData';
  if (outputChannel === 'head') return 'headData';
  if (outputChannel === 'sensor') return 'sensorData';
  return 'sitData';
}

function replaceMatchingFrames(target, fields, source, replacement) {
  if (!source || !replacement) return;
  fields.forEach((field) => {
    const candidate = firstFrame(target[field]);
    // 只有内容也等于被选中的 source 才是同一阶段的别名。只比较长度会把
    // 同尺寸但语义不同的 data / sitData / pressureData 全部覆盖成一份数据。
    if (framesEqual(candidate, source)) {
      target[field] = [...replacement];
    }
  });
}

function framesEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function getZeroBaselineForStorage(zeroStateStore, channelId, frame = null) {
  const preferredStage = frame?.zeroStorageStage === 'processed'
    ? 'processed'
    : 'decoded';
  const fallbackStage = preferredStage === 'processed' ? 'decoded' : 'processed';
  const preferred = zeroStateStore.getBaseline(channelId, preferredStage);
  return preferred.length
    ? preferred
    : zeroStateStore.getBaseline(channelId, fallbackStage);
}

/**
 * 为仍输出 legacy payload 的串口处理器提供 channel-aware 零点适配。
 *
 * 新式 Display System processor 已经持有精确 channelId，并在算法完成后直接应用
 * 零点；这里仅接管没有 channelId 的 legacy 帧。状态始终以完整 channelId 为键，
 * sitData/backData/headData 只在这个兼容边界用于识别 payload 字段，不参与状态寻址。
 */
function createZeroFrameAdapter({
  zeroStateStore,
  resolveChannelIdentity,
} = {}) {
  if (!zeroStateStore) throw new Error('zeroStateStore is required');
  if (typeof resolveChannelIdentity !== 'function') {
    throw new Error('resolveChannelIdentity is required');
  }

  function prepare(channel, input, options = {}) {
    const source = typeof input === 'string' ? JSON.parse(input) : input;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return { frame: source, zeroedStages: {} };
    }

    // Manifest processor 使用精确 channelId，并已在 processor 内记录/应用零点。
    // 不在兼容层重复扣零。
    if (
      String(source.channelId || '').trim()
      && (source.runtimeSource === 'display-system' || source.zeroApplied === true)
    ) {
      return { frame: source, zeroedStages: {} };
    }

    const identity = resolveChannelIdentity(channel);
    if (!identity?.channelId) return { frame: source, zeroedStages: {} };

    const outputChannel = String(identity.outputChannel || channel || '').trim();
    const legacyDataField = getLegacyDataField(outputChannel);
    const dynamicDataField = `${outputChannel}Data`;
    const explicitSources = options?.sourceStages && typeof options.sourceStages === 'object'
      ? options.sourceStages
      : {};
    const frame = { ...source };
    const rawPressure = firstFrame(source.rawPressureData);
    const decoded = firstFrame(
      explicitSources.decoded,
      source.rawData,
      source.realArr,
      source.rawSitData,
      rawPressure,
    );
    const normalized = firstFrame(explicitSources.normalized, source.normalizedData);
    const processed = firstFrame(
      explicitSources.processed,
      source.data,
      source[dynamicDataField],
      source[legacyDataField],
      source.pressureData,
      source.value,
    );
    const mapped = firstFrame(
      explicitSources.mapped,
      source.mappedData,
      source.mappedArr195,
      source.newArr147,
      source.newArr,
    );

    zeroStateStore.updateSources(identity.channelId, {
      decoded,
      normalized,
      processed,
      mapped,
    }, identity);

    const zeroedStages = {
      decoded: decoded
        ? zeroStateStore.apply(identity.channelId, 'decoded', decoded)
        : null,
      normalized: normalized
        ? zeroStateStore.apply(identity.channelId, 'normalized', normalized)
        : null,
      processed: processed
        ? zeroStateStore.apply(identity.channelId, 'processed', processed)
        : null,
      mapped: mapped
        ? zeroStateStore.apply(identity.channelId, 'mapped', mapped)
        : null,
    };

    if (processed) {
      replaceMatchingFrames(frame, [
        'data',
        dynamicDataField,
        legacyDataField,
        'pressureData',
        'value',
      ], processed, zeroedStages.processed);
    }

    let zeroStorageStage = null;
    if (rawPressure) {
      // 部分 legacy 分片把 processed 帧同时放进 rawPressureData；其余手套路径
      // 则放真正的 decoded 原始矩阵。按帧内容选择同阶段基准，不能只按字段名猜。
      const baselineStage = framesEqual(rawPressure, processed) ? 'processed' : 'decoded';
      const baselineSource = baselineStage === 'processed' ? processed : decoded;
      if (baselineSource && rawPressure.length === baselineSource.length) {
        frame.rawPressureData = [...zeroedStages[baselineStage]];
        zeroStorageStage = baselineStage;
      }
    } else {
      const storedData = firstFrame(source[legacyDataField], source[dynamicDataField]);
      if (framesEqual(storedData, processed)) zeroStorageStage = 'processed';
      else if (framesEqual(storedData, decoded)) zeroStorageStage = 'decoded';
    }

    if (mapped) {
      replaceMatchingFrames(frame, [
        'mappedData',
        'mappedArr195',
        'newArr147',
        'newArr',
      ], mapped, zeroedStages.mapped);
    }

    return {
      frame: {
        ...frame,
        channelId: identity.channelId,
        displaySystemId: identity.displaySystemId,
        runtimeSource: 'legacy',
        sensorId: identity.sensorId,
        sensorType: identity.sensorType,
        outputChannel,
        ...(zeroStorageStage ? { zeroStorageStage } : {}),
      },
      zeroedStages,
    };
  }

  function process(channel, input, options = {}) {
    return prepare(channel, input, options).frame;
  }

  return { prepare, process };
}

module.exports = {
  createZeroFrameAdapter,
  firstFrame,
  framesEqual,
  getLegacyDataField,
  getZeroBaselineForStorage,
};
