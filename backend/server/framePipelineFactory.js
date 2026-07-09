const { createCollectionFrameStorageService } = require('../services/collection/collectionFrameStorageService');
const { createFrameOutputPipeline } = require('../services/realtime/frameOutputPipelineService');

/**
 * 创建实时帧输出管线。
 *
 * server.js 不再直接维护 channel -> db/db1/db2 的读取规则；统一通过 runtimeContext
 * 获取当前传感器类型和对应数据库句柄。
 *
 * @param {object} options 创建参数。
 * @returns {{ collectionFrameStorage: object, frameOutputPipeline: object }} 实时帧管线。
 */
function createServerFramePipeline({
  runtimeContext,
  publishRealtimeChannel,
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
  minzhenType,
  applyMinzhenBackendGauss,
}) {
  const collectionFrameStorage = createCollectionFrameStorageService({
    getSensorType: runtimeContext.getSensorType,
    getDbRef: (channel) => runtimeContext.getDatabase(channel),
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
  });

  const frameOutputPipeline = createFrameOutputPipeline({
    collectionFrameStorage,
    publishRealtimeChannel,
    getSensorType: runtimeContext.getSensorType,
    minzhenType,
    applyMinzhenBackendGauss,
  });

  return {
    collectionFrameStorage,
    frameOutputPipeline,
  };
}

module.exports = {
  createServerFramePipeline,
};
