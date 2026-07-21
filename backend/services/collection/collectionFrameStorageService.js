/**
 * 采集帧存储服务。
 *
 * 根据当前传感器类型和通道，把实时 payload 转成 matrix.data 的存储格式，
 * 再交给入库队列。这里集中处理 sit/back/head 三路差异，避免实时输出管线
 * 直接拼接存储结构。
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
   * @param {'sit' | 'back' | 'head'} channel 采集通道。
   * @returns {boolean} 是否可以入库。
   */
  function canStore(channel) {
    return Boolean(
      shouldStoreCollectionFrame?.(channel) &&
      hasEnoughCollectionDiskSpace?.()
    );
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
    if (!frameToStore?.displaySystemId || !Array.isArray(frameToStore[dataKey])) {
      return null;
    }

    return JSON.stringify({
      [dataKey]: frameToStore[dataKey],
      normalizedData: Array.isArray(frameToStore.normalizedData)
        ? frameToStore.normalizedData
        : frameToStore[dataKey],
      algorithmMetrics: frameToStore.algorithmMetrics || {},
      metrics: frameToStore.metrics || {},
      displaySystemId: frameToStore.displaySystemId,
      channelId: frameToStore.channelId,
      outputChannel: frameToStore.outputChannel,
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
    store,
    storeBack: (frameToStore) => store('back', frameToStore),
    storeHead: (frameToStore) => store('head', frameToStore),
    storeSit: (frameToStore) => store('sit', frameToStore),
  };
}

module.exports = {
  createCollectionFrameStorageService,
};
