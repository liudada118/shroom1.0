function toPropertyDescriptor(accessor) {
  return {
    configurable: true,
    enumerable: true,
    get: accessor.get,
    set: accessor.set,
  };
}

/**
 * 创建 WebSocket handler context 的旧状态访问器。
 *
 * WebSocket handler 仍在兼容旧前端消息，会直接读写历史回放、清零、授权和框选统计状态。
 * 这里把状态映射集中到 runtime 层，避免 server.js 继续维护大块 Object.defineProperties。
 */
function createWebSocketContextAccessors({
  mutableAccessors = {},
  playbackStateAccessor,
  serialPortStateAccessor,
  zeroStateAccessor,
} = {}) {
  const accessors = {
    ...mutableAccessors,
    indexArr: playbackStateAccessor('indexArr'),
    localData: playbackStateAccessor('localData'),
    localDataBack: playbackStateAccessor('localDataBack'),
    nowIndex: playbackStateAccessor('nowIndex'),
    newArr147: zeroStateAccessor('newArr147'),
    newArr147_2: zeroStateAccessor('newArr147_2'),
    pointArr1RawZero: zeroStateAccessor('pointArr1RawZero'),
    pointArr1RawZeroData: zeroStateAccessor('pointArr1RawZeroData'),
    pointArr1zero: zeroStateAccessor('pointArr1zero'),
    pointArr1zeroData: zeroStateAccessor('pointArr1zeroData'),
    pointArr2RawZero: zeroStateAccessor('pointArr2RawZero'),
    pointArr2RawZeroData: zeroStateAccessor('pointArr2RawZeroData'),
    pointArr2zero: zeroStateAccessor('pointArr2zero'),
    pointArr2zeroData: zeroStateAccessor('pointArr2zeroData'),
    pointArr3zero: zeroStateAccessor('pointArr3zero'),
    pointArr3zeroData: zeroStateAccessor('pointArr3zeroData'),
    pointArr4zero: zeroStateAccessor('pointArr4zero'),
    pointArr4zeroData: zeroStateAccessor('pointArr4zeroData'),
    pointArr147zero: zeroStateAccessor('pointArr147zero'),
    pointArr147zero_2: zeroStateAccessor('pointArr147zero_2'),
    serialport: serialPortStateAccessor('serialport'),
  };

  return Object.entries(accessors).reduce((descriptors, [key, accessor]) => {
    descriptors[key] = toPropertyDescriptor(accessor);
    return descriptors;
  }, {});
}

module.exports = {
  createWebSocketContextAccessors,
};

