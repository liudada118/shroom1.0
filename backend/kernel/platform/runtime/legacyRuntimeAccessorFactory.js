/**
 * 创建普通可变变量的 accessor。
 *
 * 该 helper 用于迁移期：server.js 中尚未下沉的旧变量先通过 getter/setter 暴露，
 * 后续变量迁入 store 后，只需要替换 accessor 来源。
 */
function createMutableAccessor(get, set) {
  return {
    get,
    set,
  };
}

/**
 * 创建 legacy 串口 runtime 需要的状态 accessor。
 *
 * 固定的 store 状态在这里统一拼装，server.js 只传入尚未迁移的变量 accessor，
 * 避免 legacy 兼容字段继续散落在启动编排文件里。
 */
function createLegacySerialFrameRuntimeAccessors({
  collectionStateAccessor,
  getManagedSerialPort,
  mutableAccessors = {},
  runtimeStateAccessor,
  serialRoles,
  zeroStateAccessor,
} = {}) {
  return {
    ...mutableAccessors,
    colHZ: collectionStateAccessor('colHZ'),
    firstBlueData: runtimeStateAccessor('firstBlueData'),
    firstBlueData1: runtimeStateAccessor('firstBlueData1'),
    firstBlueData2: runtimeStateAccessor('firstBlueData2'),
    flag: collectionStateAccessor('flag'),
    lastBlueData: runtimeStateAccessor('lastBlueData'),
    lastBlueData1: runtimeStateAccessor('lastBlueData1'),
    lastBlueData2: runtimeStateAccessor('lastBlueData2'),
    newArr: runtimeStateAccessor('newArr'),
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
    pointArr4zero: zeroStateAccessor('pointArr4zero'),
    pointArr4zeroData: zeroStateAccessor('pointArr4zeroData'),
    pointArr147zero: zeroStateAccessor('pointArr147zero'),
    pointArr147zero_2: zeroStateAccessor('pointArr147zero_2'),
    port1: { get: () => getManagedSerialPort(serialRoles.SIT) },
    port2: { get: () => getManagedSerialPort(serialRoles.BACK) },
    saveTime: collectionStateAccessor('saveTime'),
  };
}

module.exports = {
  createLegacySerialFrameRuntimeAccessors,
  createMutableAccessor,
};

