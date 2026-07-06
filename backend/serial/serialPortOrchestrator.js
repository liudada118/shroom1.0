/**
 * 创建串口打开/关闭编排器。
 *
 * SerialManager 负责物理串口生命周期，本模块负责把业务角色映射到
 * parser channel、波特率、自动重连和特殊数据 handler。
 *
 * @param {object} options 创建参数。
 * @param {Function} options.getBaudRate 当前主压力串口波特率读取函数。
 * @param {Function} options.getSensorType 当前系统类型读取函数。
 * @param {Function} options.handleMinzhenSensorPortData 敏枕文本传感器数据处理函数。
 * @param {object} options.logger 日志对象。
 * @param {string} options.minzhenType 敏枕系统类型。
 * @param {object} options.serialManager 串口管理器。
 * @param {object} options.serialParserManager 串口 parser 管理器。
 * @param {object} options.serialRoles 串口角色常量。
 * @param {string} options.smallBed12BType 小床 12B 系统类型。
 * @param {Function} options.resetMinzhenSensorExtractor 敏枕文本分帧缓存清理函数。
 * @returns {object} 串口编排能力。
 */
function createSerialPortOrchestrator({
  getBaudRate,
  getSensorType,
  handleMinzhenSensorPortData,
  logger,
  minzhenType,
  serialManager,
  serialParserManager,
  serialRoles,
  smallBed12BType,
  resetMinzhenSensorExtractor,
}) {
  function getSitParserChannel() {
    return getSensorType() === smallBed12BType
      ? serialParserManager.channels.SMALL_BED_12B
      : serialParserManager.channels.SIT;
  }

  function openManagedSerialPort(role, options = {}) {
    serialManager.registerPort(role, {
      ...options,
      role,
      reconnect: options.reconnect === true,
    });
    return serialManager.start(role);
  }

  function closeManagedSerialPort(role, reason) {
    serialManager.setReconnect(role, false);
    serialManager.stop(role, reason);
  }

  function openSitSerialPort(portPath, reason = 'open sit') {
    if (!portPath) return null;
    const sensorType = getSensorType();
    return openManagedSerialPort(serialRoles.SIT, {
      path: portPath,
      baudRate: getBaudRate(),
      reconnect: true,
      parserChannel: sensorType === 'bigBed'
        ? serialParserManager.channels.BIG_BED_SIT
        : getSitParserChannel(),
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  function openBackSerialPort(portPath, reason = 'open back') {
    if (!portPath) return null;
    const useRawMinzhenText = getSensorType() === minzhenType;
    if (useRawMinzhenText) {
      resetMinzhenSensorExtractor();
    }
    return openManagedSerialPort(serialRoles.BACK, {
      path: portPath,
      baudRate: getBaudRate(),
      reconnect: true,
      parserChannel: useRawMinzhenText ? undefined : serialParserManager.channels.BACK,
      dataHandler: useRawMinzhenText ? handleMinzhenSensorPortData : undefined,
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  function openHeadSerialPort(portPath, reason = 'open head') {
    if (!portPath) return null;
    return openManagedSerialPort(serialRoles.HEAD, {
      path: portPath,
      baudRate: getBaudRate(),
      reconnect: true,
      parserChannel: serialParserManager.channels.HEAD,
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  return {
    closeManagedSerialPort,
    getSitParserChannel,
    openBackSerialPort,
    openHeadSerialPort,
    openManagedSerialPort,
    openSitSerialPort,
  };
}

module.exports = {
  createSerialPortOrchestrator,
};
