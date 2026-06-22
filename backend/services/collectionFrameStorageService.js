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

  function sensorType() {
    return typeof getSensorType === 'function' ? getSensorType() : '';
  }

  function canStore(channel) {
    return Boolean(
      shouldStoreCollectionFrame?.(channel) &&
      hasEnoughCollectionDiskSpace?.()
    );
  }

  function buildSitCollectionData(frameToStore) {
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

  function buildBackCollectionData(frameToStore) {
    const type = sensorType();
    return frameToStore.tempObj
      ? JSON.stringify(frameToStore.tempObj)
      : isZeroFrameStorageType(type)
        ? buildZeroAwareStorageData(frameToStore, 'backData', 'back')
        : isSmallBedMatrixType(type)
          ? JSON.stringify(getFrameMatrixData(frameToStore, 'backData'))
          : JSON.stringify([...frameToStore.backData]);
  }

  function buildHeadCollectionData(frameToStore) {
    const type = sensorType();
    return isZeroFrameStorageType(type)
      ? buildZeroAwareStorageData(frameToStore, 'headData', 'head')
      : isSmallBedMatrixType(type)
        ? JSON.stringify(getFrameMatrixData(frameToStore, 'headData'))
        : JSON.stringify([...frameToStore.backData]);
  }

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
