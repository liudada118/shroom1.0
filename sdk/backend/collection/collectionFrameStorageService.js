/**
 * 采集帧存储服务。
 *
 * 根据当前传感器类型和通道，把实时 payload 转成 matrix.data 的存储格式，
 * 再交给入库队列。旧设备继续集中处理 sit/back/head 三路差异；Display System
 * 则统一按 canonical channelId 存入主库，通道数量不再受三路模型限制。
 */

/**
 * 创建采集帧存储服务。
 *
 * @param {object} options 运行时依赖和传感器类型判断函数。
 * @returns {object} 三路采集存储 API。
 */
function createCollectionFrameStorageService(options = {}) {
  const {
    getSensorType,
    getDbRef,
    isCollecting,
    shouldStoreCollectionFrame,
    hasEnoughCollectionDiskSpace,
    enqueueCollectionFrame,
    buildZeroAwareStorageData,
    buildSmallBed12BCollectionStorageData,
    getFrameMatrixData,
    isZeroFrameStorageType,
    isSmallBedMatrixType,
    tempFullBedType,
    smallBed12BType,
  } = options;

  /**
   * 读取当前传感器类型。
   *
   * @returns {string} 当前传感器类型。
   */
  function sensorType() {
    return typeof getSensorType === 'function' ? getSensorType() : '';
  }

  /**
   * 判断当前通道本帧是否允许入库。
   *
   * 三个条件缺一不可，且 `isCollecting` 必须排在最前面：
   *
   * 1. **采集开关开着**。这一条以前漏了 —— `publishSit/Back/Head` 是实时下发路径，
   *    每帧都会调到这里，所以少了这个判断就变成「串口一有数据就落库」，
   *    没点开始采集也照写。对照老路径 `legacySerialFrameRuntime.js` 的
   *    `ctx.flag && ctx.shouldStoreCollectionFrame(...) && ctx.hasEnoughCollectionDiskSpace()`，
   *    条件顺序和语义都是照它补齐的。
   *    连带后果是「磁盘满 → `setCollectionState('flag', false)`」这条急停链路以前
   *    停不住任何东西（全仓没有一处读 `flag`），补上之后才真的能停。
   * 2. 本帧没被采集频率限流。
   * 3. 磁盘剩余空间够。
   *
   * @param {'sit' | 'back' | 'head'} channel 采集通道。
   * @returns {boolean} 是否可以入库。
   */
  function canStore(channel) {
    return Boolean(
      isCollecting?.() &&
      shouldStoreCollectionFrame?.(channel) &&
      hasEnoughCollectionDiskSpace?.()
    );
  }

  /**
   * 判断一帧是否来自 manifest Display System 运行时。
   *
   * @param {object} frame 实时帧。
   * @returns {boolean} 是否为 canonical Display System 帧。
   */
  function isDisplaySystemFrame(frame) {
    return frame?.runtimeSource === 'display-system'
      && Boolean(String(frame?.channelId || '').trim());
  }

  /**
   * 解析 Display System 帧的稳定身份与本次物理串口快照。
   * channelId 是长期主键；serialPortPath 可能在重新插拔后变化，因此按帧保存。
   *
   * @param {object} frame 实时帧。
   * @param {string} fallbackChannel 调用方提供的输出通道兜底。
   * @returns {object|null} 入库身份；不是 Display System 帧时返回 null。
   */
  function getDisplaySystemFrameIdentity(frame, fallbackChannel = 'sit') {
    if (!isDisplaySystemFrame(frame)) return null;

    const channelId = String(frame.channelId).trim();
    const displaySystemId = String(frame.displaySystemId || channelId.split(':')[0] || '').trim();
    const prefix = displaySystemId ? `${displaySystemId}:` : '';
    const sensorId = String(
      frame.sensorId
      || (prefix && channelId.startsWith(prefix) ? channelId.slice(prefix.length) : '')
      || channelId.slice(channelId.indexOf(':') + 1)
      || fallbackChannel,
    ).trim();
    const outputChannel = String(frame.outputChannel || fallbackChannel || sensorId).trim();
    const serial = frame.serial && typeof frame.serial === 'object' ? frame.serial : {};
    const rawParser = serial.parserChannel ?? frame.parserChannel;
    const parserChannel = rawParser && typeof rawParser === 'object'
      ? (rawParser.id || rawParser.role || null)
      : rawParser;
    const baudRate = Number(serial.baudRate ?? frame.baudRate);
    const timestamp = Number(frame.timestamp);

    return {
      channelId,
      displaySystemId,
      sensorId,
      sensorLabel: String(frame.sensorLabel || frame.label || sensorId).trim(),
      sensorType: frame.sensorType || null,
      outputChannel,
      schemaVersion: Number(frame.schemaVersion) || 1,
      serialRole: String(serial.role || frame.serialRole || '').trim() || null,
      serialPortPath: String(serial.path || frame.serialPortPath || '').trim() || null,
      baudRate: Number.isFinite(baudRate) && baudRate > 0 ? baudRate : null,
      parserChannel: parserChannel == null ? null : String(parserChannel),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
    };
  }

  /**
   * 展示系统帧需要保留算法指标和映射后矩阵，供历史回放恢复左侧数据面板。
   * 旧设备没有 displaySystemId，仍沿用原来的数组存储格式。
   *
   * @param {object} frameToStore 实时帧对象。
   * @param {'sitData' | 'backData' | 'headData'} dataKey 当前通道矩阵字段。
   * @returns {string | null} 展示系统存储数据；非展示系统帧返回 null。
   */
  function buildDisplaySystemCollectionData(frameToStore, dataKey) {
    // legacy zero adapter 也会补齐 canonical displaySystemId/channelId，供实时帧
    // 寻址使用；这不代表该帧应切换到 manifest 专用历史格式。只有 runtime
    // processor 明确标记的 Display System 帧才能走这里，否则会绕过手套零点帧、
    // 小床 12B 和温度床等既有存储协议。
    const identity = getDisplaySystemFrameIdentity(frameToStore, frameToStore?.outputChannel);
    if (!identity) return null;

    const resolvedDataKey = dataKey || `${identity.outputChannel}Data`;
    const processed = Array.isArray(frameToStore.data)
      ? frameToStore.data
      : Array.isArray(frameToStore[resolvedDataKey])
        ? frameToStore[resolvedDataKey]
        : Array.isArray(frameToStore.normalizedData)
          ? frameToStore.normalizedData
          : null;
    if (!processed) return null;

    const serial = frameToStore.serial && typeof frameToStore.serial === 'object'
      ? { ...frameToStore.serial }
      : null;
    return JSON.stringify({
      ...frameToStore,
      ...identity,
      data: processed,
      [resolvedDataKey]: processed,
      normalizedData: Array.isArray(frameToStore.normalizedData)
        ? frameToStore.normalizedData
        : processed,
      algorithmMetrics: frameToStore.algorithmMetrics || {},
      metrics: frameToStore.metrics || {},
      serial,
      runtimeSource: 'display-system',
    });
  }

  /**
   * 构建坐面通道的 matrix.data 存储字符串。
   *
   * @param {object} frameToStore 实时帧对象。
   * @returns {string} 序列化后的存储数据。
   */
  function buildSitCollectionData(frameToStore) {
    const displaySystemData = buildDisplaySystemCollectionData(frameToStore, 'sitData');
    if (displaySystemData) return displaySystemData;

    const type = sensorType();
    return type === tempFullBedType
      ? JSON.stringify({
        sitData: frameToStore.sitData,
        rawSitData: frameToStore.rawSitData,
        matrixWidth: frameToStore.matrixWidth,
        matrixHeight: frameToStore.matrixHeight,
        matrixOrientation: frameToStore.matrixOrientation,
        realArr: frameToStore.realArr,
        pressureThreshold: frameToStore.pressureThreshold,
        temperatureRawData: frameToStore.temperatureRawData,
        temperatureData: frameToStore.temperatureData,
        temperatureAvg: frameToStore.temperatureAvg,
        temperatureK: frameToStore.temperatureK,
      })
      : isZeroFrameStorageType(type)
        ? buildZeroAwareStorageData(frameToStore, 'sitData', 'sit')
        : type === smallBed12BType
          ? buildSmallBed12BCollectionStorageData(frameToStore)
          : isSmallBedMatrixType(type)
          ? JSON.stringify(getFrameMatrixData(frameToStore, 'sitData'))
          : JSON.stringify([...frameToStore.sitData]);
  }

  /**
   * 构建靠背通道的 matrix.data 存储字符串。
   *
   * @param {object} frameToStore 实时帧对象。
   * @returns {string} 序列化后的存储数据。
   */
  function buildBackCollectionData(frameToStore) {
    const displaySystemData = buildDisplaySystemCollectionData(frameToStore, 'backData');
    if (displaySystemData) return displaySystemData;

    const type = sensorType();
    return frameToStore.tempObj
      ? JSON.stringify(frameToStore.tempObj)
      : isZeroFrameStorageType(type)
        ? buildZeroAwareStorageData(frameToStore, 'backData', 'back')
        : isSmallBedMatrixType(type)
          ? JSON.stringify(getFrameMatrixData(frameToStore, 'backData'))
          : JSON.stringify([...frameToStore.backData]);
  }

  /**
   * 构建头枕通道的 matrix.data 存储字符串。
   *
   * @param {object} frameToStore 实时帧对象。
   * @returns {string} 序列化后的存储数据。
   */
  function buildHeadCollectionData(frameToStore) {
    const displaySystemData = buildDisplaySystemCollectionData(frameToStore, 'headData');
    if (displaySystemData) return displaySystemData;

    const type = sensorType();
    return isZeroFrameStorageType(type)
      ? buildZeroAwareStorageData(frameToStore, 'headData', 'head')
      : isSmallBedMatrixType(type)
        ? JSON.stringify(getFrameMatrixData(frameToStore, 'headData'))
        : JSON.stringify([...frameToStore.backData]);
  }

  /**
   * 按通道选择构造器并把采集帧加入入库队列。
   *
   * @param {'sit' | 'back' | 'head'} channel 采集通道。
   * @param {object} frameToStore 实时帧对象。
   * @returns {boolean} 是否已入队。
   */
  function store(channel, frameToStore) {
    const displayIdentity = getDisplaySystemFrameIdentity(frameToStore, channel);
    if (displayIdentity) {
      if (frameToStore?.stored === false) return false;
      if (!canStore(displayIdentity.channelId)) return false;
      const dataToStore = buildDisplaySystemCollectionData(
        frameToStore,
        `${displayIdentity.outputChannel}Data`,
      );
      if (!dataToStore) return false;

      // 所有 manifest 通道共享当前型号的主库，并由 channel_id 精确隔离。
      // 不能按 outputChannel 映射 db1/db2：任意多串口并不存在可无限扩展的 dbN。
      enqueueCollectionFrame(getDbRef('sit'), dataToStore, displayIdentity);
      return true;
    }

    if (!canStore(channel)) return false;

    const builders = {
      sit: buildSitCollectionData,
      back: buildBackCollectionData,
      head: buildHeadCollectionData,
    };
    const builder = builders[channel];
    if (!builder) {
      throw new Error(`unknown collection channel: ${channel}`);
    }

    enqueueCollectionFrame(getDbRef(channel), builder(frameToStore), channel);
    return true;
  }

  return {
    buildBackCollectionData,
    buildDisplaySystemCollectionData,
    buildHeadCollectionData,
    buildSitCollectionData,
    getDisplaySystemFrameIdentity,
    store,
    storeFrame: (frameToStore, options = {}) => store(
      options.fallbackChannel || frameToStore?.outputChannel || 'sit',
      frameToStore,
    ),
    storeBack: (frameToStore) => store('back', frameToStore),
    storeHead: (frameToStore) => store('head', frameToStore),
    storeSit: (frameToStore) => store('sit', frameToStore),
  };
}

module.exports = {
  createCollectionFrameStorageService,
};
