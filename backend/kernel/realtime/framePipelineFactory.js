const { createCollectionFrameStorageService } = require('@shroom/backend/collection/collectionFrameStorageService.js');
const { createFrameOutputPipeline } = require('./frameOutputPipelineService');

/**
 * 创建实时帧输出管线。
 *
 * server.js 不再直接维护 channel -> db/db1/db2 的读取规则；统一通过 runtimeContext
 * 获取当前传感器类型和对应数据库句柄。
 *
 * @param {object} options 创建参数。
 * @param {() => boolean} options.isCollecting 采集开关是否打开。实时下发路径每帧都会
 *   走到入库判断，缺了它就会「串口一有数据就落库」，详见 `collectionFrameStorageService`
 *   的 `canStore`。
 * @returns {{ collectionFrameStorage: object, frameOutputPipeline: object }} 实时帧管线。
 */
function createServerFramePipeline({
  runtimeContext,
  publishRealtimeChannel,
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
  minzhenType,
  applyMinzhenBackendGauss,
}) {
  const collectionFrameStorage = createCollectionFrameStorageService({
    getSensorType: runtimeContext.getSensorType,
    getDbRef: (channel) => runtimeContext.getDatabase(channel),
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
