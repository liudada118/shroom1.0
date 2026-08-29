function createMutableAccessor(get, set) {
  return { get, set };
}

function toPropertyDescriptor(accessor) {
  return {
    configurable: true,
    enumerable: true,
    get: accessor.get,
    set: accessor.set,
  };
}

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

  return Object.fromEntries(
    Object.entries(accessors).map(([key, accessor]) => [key, toPropertyDescriptor(accessor)]),
  );
}

/**
 * 将 getter/setter 描述转换成 WebSocket handler 可使用的运行态访问器。
 *
 * @param {Record<string, { get: Function, set: Function }>} mutableAccessors 可读写旧变量描述。
 * @returns {Record<string, { get: Function, set: Function }>} 规范化后的运行态访问器。
 */
function buildMutableAccessors(mutableAccessors = {}) {
  return Object.entries(mutableAccessors).reduce((result, [key, accessor]) => {
    result[key] = createMutableAccessor(accessor.get, accessor.set);
    return result;
  }, {});
}

/**
 * 创建旧 WebSocket handler 的运行时兼容上下文。
 *
 * server.js 只负责把依赖和旧运行态变量以 getter/setter 形式传进来；
 * 本模块统一挂载 runtime accessor，避免 WebSocket handler 继续直接耦合 server.js 变量。
 *
 * @param {object} options 创建参数。
 * @param {object} options.dependencies WebSocket handler 需要的稳定服务依赖。
 * @param {Record<string, { get: Function, set: Function }>} options.mutableAccessors 旧运行态变量访问器。
 * @param {Function} options.playbackStateAccessor 回放状态访问器工厂。
 * @param {Function} options.serialPortStateAccessor 串口状态访问器工厂。
 * @param {Function} options.zeroStateAccessor 零点状态访问器工厂。
 * @returns {object} 可直接传给 createWebSocketHandlerAttacher 的上下文。
 */
function createWebSocketHandlerContext({
  dependencies,
  mutableAccessors,
  playbackStateAccessor,
  serialPortStateAccessor,
  zeroStateAccessor,
}) {
  const context = { ...dependencies };

  Object.defineProperties(context, createWebSocketContextAccessors({
    mutableAccessors: buildMutableAccessors(mutableAccessors),
    playbackStateAccessor,
    serialPortStateAccessor,
    zeroStateAccessor,
  }));

  return context;
}

module.exports = {
  buildMutableAccessors,
  createWebSocketContextAccessors,
  createWebSocketHandlerContext,
};
