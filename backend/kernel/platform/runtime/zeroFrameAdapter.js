/**
 * 拷一份帧并把每项转成数字；非数组返回 **null**。
 *
 * 返回 null 而不是 `[]`（与零点仓库的 cloneFrame 相反）：本模块靠「null = 这个字段不
 * 存在」和「空数组 = 字段存在但没数据」的区别来挑候选字段，见 firstFrame。
 *
 * `Number(item)` 是必须的：legacy payload 里同一个字段有时是数字数组、有时是字符串
 * 数组（不同年代的串口处理器行为不同）。framesEqual 用严格 `===` 比较，不统一成数字的
 * 话 `"12" !== 12`，同一份数据会被判成不同阶段，扣零就落不到字段上。
 *
 * @param {*} value 待处理的值。
 * @returns {number[]|null} 数字数组；非数组返回 null。
 */
function cloneNumericFrame(value) {
  return Array.isArray(value) ? value.map((item) => Number(item)) : null;
}

/**
 * 按优先级从多个候选字段里挑出第一份**非空**的帧。
 *
 * 候选顺序即优先级，各调用点的顺序都是按「越新越靠前」排的（显式传入的 sourceStages
 * 优先于任何字段名猜测）。
 *
 * @param {...*} candidates 候选值，按优先级排列。
 * @returns {number[]|null} 第一份非空帧；都为空时 null。
 */
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

/**
 * 求 legacy payload 里承载数据的字段名。
 *
 * ⚠️ **不要和 display system 侧的 `getChannelDataField` 混用**（在
 * `extension-host/runtime/displaySystemFrameProcessorFactory.js`）。两者名字像、
 * back/head 两条也一样，但有两处关键差别：
 * - 这里多认一个 `sensor` → `sensorData`。
 * - 这里的兜底是**一律 `sitData`**，而那边未知通道会拼 `${outputChannel}Data`。
 *
 * 兜底不同是刻意的：那边是新链路，动态字段名能让多传感器各占一个字段；这里是兼容
 * 边界，legacy 前端只认那三四个固定字段名，拼一个它不认识的名字等于数据丢失。动态
 * 字段名在 `prepare` 里另算一份（`dynamicDataField`）并与本函数的结果**同时**参与
 * 候选，两者都覆盖，这样新旧消费者都能拿到扣零后的数据。
 *
 * @param {string} outputChannel 输出通道名。
 * @returns {string} legacy 字段名。
 */
function getLegacyDataField(outputChannel) {
  if (outputChannel === 'back') return 'backData';
  if (outputChannel === 'head') return 'headData';
  if (outputChannel === 'sensor') return 'sensorData';
  return 'sitData';
}

/**
 * 把 target 上「内容等于 source」的那些字段替换成 replacement（原地改 target）。
 *
 * 这是兼容层扣零的落地方式。legacy payload 里同一份数据常同时挂在好几个字段上
 * （`data` / `sitData` / `pressureData` / `value` 都指向同一个数组），扣零后必须**全部**
 * 换掉 —— 只换一个的话，不同前端组件读不同字段，会一半扣零一半没扣，画面对不上。
 *
 * 判等用**内容**而不是长度（行内注释已说明原因）；也不用引用相等，因为 firstFrame
 * 已经把候选拷贝并转成数字了，引用早就不同。
 *
 * `!source || !replacement` 时直接返回：没选中这一阶段，或扣零没产出结果，就什么都
 * 不改，保持原帧。
 *
 * @param {object} target 待修改的帧对象（**原地修改**）。
 * @param {string[]} fields 候选字段名。
 * @param {number[]|null} source 被选中的原始阶段数据。
 * @param {number[]|null} replacement 扣零后的数据。
 * @returns {void}
 */
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

/**
 * 逐点判断两帧是否完全相同。
 *
 * 本模块用它回答的问题不是「数值是否接近」，而是「**这两个字段是不是同一份数据的
 * 别名**」。所以用严格 `===`、不设容差 —— 容差会让两块尺寸相同、数值恰好接近的不同
 * 传感器数据被判成同一阶段，然后被互相覆盖。
 *
 * 两边都必须是数组：null（字段不存在）与任何东西都不相等，于是调用点不需要判空。
 *
 * 定义在 replaceMatchingFrames 之后却被它调用，靠函数声明提升。
 *
 * @param {*} left 帧 A。
 * @param {*} right 帧 B。
 * @returns {boolean} 是否逐点相等。
 */
function framesEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

/**
 * 取「入库时该扣掉的那份基准」。
 *
 * 存历史数据的一方需要知道**写进库里的数值是哪一阶段的**，才能记录对应的零点基准 ——
 * 否则回放时用错基准，回放画面和当时的实时画面就不一样。`prepare` 已经把判断结果放在
 * 帧的 `zeroStorageStage` 上（它是按帧**内容**判的，不是按字段名猜的，见 prepare 里
 * rawPressureData 那一段），这里只是照着取。
 *
 * 取不到就退到另一阶段：帧上没标记、或标记的那一阶段还没归零（基准为空）时，另一阶段
 * 的基准比「没有基准」更接近事实。两个阶段都空就返回空数组，表示这一路没归过零。
 *
 * @param {object} zeroStateStore 零点仓库。
 * @param {string} channelId canonical channelId。
 * @param {{zeroStorageStage?: string}|null} [frame] 帧（读它的 zeroStorageStage 标记）。
 * @returns {number[]} 基准数组；未归零为 []。
 */
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

  /**
   * 给一帧 legacy payload 补上身份、记录零点 source、并把扣零结果写回各个别名字段。
   *
   * 四组候选字段名是历史包袱清单，组内按「越新越靠前」排：decoded（`rawData`/`realArr`/…）、
   * normalized、processed（`data`/`${通道}Data`/…）、mapped（`mappedData`/`newArr147`/…）。新增串口
   * 处理器时用 `options.sourceStages` **显式**告知阶段数据（优先于所有字段名猜测），别往清单里再加名字。
   * `rawPressureData` 单独按**内容**比对判阶段（不同 legacy 分片里语义不同），结果作为
   * `zeroStorageStage` 传给入库方。输出帧打 `runtimeSource: 'legacy'`，是下游区分两条链路的依据。
   *
   * ⚠️ 两条提前退出决定了适配器边界：帧带 `channelId` 且（`runtimeSource === 'display-system'` 或
   * `zeroApplied === true`）→ 原样返回，否则是**双重扣零**（现象：归零后画面整体偏低甚至大片归零）；
   * 解析不出 channelId → 原样返回，零点状态**只以完整 channelId 为键**，宁可不扣零也不能按旧串口角色
   * 猜一个（猜错会让两个展示系统共享零点）。
   *
   * @param {string} channel 旧的通道/角色名（交给注入的 resolveChannelIdentity 解析）。
   * @param {string|object} input 帧对象，或它的 JSON 字符串。
   * @param {{sourceStages?: object}} [options] 显式阶段数据。
   * @returns {{frame: object, zeroedStages: object}} 补全后的帧与四阶段扣零结果。
   */
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

  /**
   * prepare 的「只要帧」入口，给不关心四阶段扣零明细的调用方用。
   *
   * 发布链路走这个（它只需要发出去的那一帧）；需要按阶段分别落库或诊断的走 prepare。
   *
   * @param {string} channel 旧的通道/角色名。
   * @param {string|object} input 帧对象或其 JSON 字符串。
   * @param {{sourceStages?: object}} [options] 显式阶段数据。
   * @returns {object} 补全后的帧。
   */
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
