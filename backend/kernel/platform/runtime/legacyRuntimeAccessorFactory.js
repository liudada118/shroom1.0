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
    port1: { get: () => getManagedSerialPort(serialRoles.SIT) },
    port2: { get: () => getManagedSerialPort(serialRoles.BACK) },
    saveTime: collectionStateAccessor('saveTime'),
  };
}

module.exports = {
  createLegacySerialFrameRuntimeAccessors,
  createMutableAccessor,
};
