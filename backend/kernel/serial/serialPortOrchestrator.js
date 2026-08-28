/**
 * 创建串口打开/关闭编排器。
 *
 * SerialManager 负责物理串口生命周期，本模块负责把业务角色映射到
 * parser channel、波特率、自动重连和特殊数据 handler。
 *
 * @param {object} options 创建参数。
 * @param {Function} options.getBaudRate 当前主压力串口波特率读取函数。
 * @param {Function} options.getSerialConfig 按传感器类型和串口角色读取 manifest 配置。
 * @param {Function} options.getSensorType 当前系统类型读取函数。
 * @param {Function} options.handleMinzhenSensorPortData 敏枕文本传感器数据处理函数。
 * @param {object} options.logger 日志对象。
 * @param {string} options.minzhenType 敏枕系统类型。
 * @param {object} options.serialManager 串口管理器。
 * @param {object} options.serialParserManager 串口 parser 管理器。
 * @param {object} options.serialRoles 串口角色常量。
 * @param {string} options.smallBed12BType 小床 12B 系统类型。
 * @param {Function} options.listSerialChannels 列出当前展示系统声明的串口通道。
 * @param {Function} options.resetMinzhenSensorExtractor 敏枕文本分帧缓存清理函数。
 * @returns {object} 串口编排能力。
 */
function createSerialPortOrchestrator({
  getBaudRate,
  getSerialConfig,
  getSensorType,
  handleMinzhenSensorPortData,
  logger,
  minzhenType,
  serialManager,
  serialParserManager,
  serialRoles,
  smallBed12BType,
  listSerialChannels,
  resetMinzhenSensorExtractor,
}) {
  function getConfiguredChannel(role) {
    return typeof getSerialConfig === 'function'
      ? getSerialConfig(getSensorType(), role)
      : null;
  }

  function getManagedSerialPort(role) {
    return serialManager.getPort(role);
  }

  function getManifestSerialChannel(role) {
    if (!role || typeof listSerialChannels !== 'function') return null;
    const channels = listSerialChannels(getSensorType()) || [];
    return channels.find((channel) => channel.serialRole === role) || null;
  }

  function listManagedSerialRoles() {
    if (typeof serialManager.getStatus !== 'function') return [];
    const statuses = serialManager.getStatus();
    if (!Array.isArray(statuses)) return [];
    return [...new Set(statuses
      .map((status) => status?.role || status?.portId)
      .filter(Boolean))];
  }

  function createInvalidSerialRoleError(serialRole) {
    const error = new Error(`serial role is not declared by current manifest: ${serialRole}`);
    error.code = 'INVALID_COMMAND';
    error.httpStatus = 400;
    return error;
  }

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
    return serialManager.stop(role, reason);
  }

  function openSitSerialPort(portPath, reason = 'open sit') {
    if (!portPath) return null;
    const sensorType = getSensorType();
    const configured = getConfiguredChannel(serialRoles.SIT);
    return openManagedSerialPort(serialRoles.SIT, {
      path: portPath,
      baudRate: configured?.baudRate || getBaudRate(),
      reconnect: true,
      parserChannel: configured?.parserChannel || (sensorType === 'bigBed'
        ? serialParserManager.channels.BIG_BED_SIT
        : getSitParserChannel()),
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  function openBackSerialPort(portPath, reason = 'open back') {
    if (!portPath) return null;
    const useRawMinzhenText = getSensorType() === minzhenType;
    const configured = getConfiguredChannel(serialRoles.BACK);
    if (useRawMinzhenText) {
      resetMinzhenSensorExtractor();
    }
    return openManagedSerialPort(serialRoles.BACK, {
      path: portPath,
      baudRate: configured?.baudRate || getBaudRate(),
      reconnect: true,
      parserChannel: useRawMinzhenText
        ? undefined
        : (configured?.parserChannel || serialParserManager.channels.BACK),
      dataHandler: useRawMinzhenText ? handleMinzhenSensorPortData : undefined,
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  function openHeadSerialPort(portPath, reason = 'open head') {
    if (!portPath) return null;
    const configured = getConfiguredChannel(serialRoles.HEAD);
    return openManagedSerialPort(serialRoles.HEAD, {
      path: portPath,
      baudRate: configured?.baudRate || getBaudRate(),
      reconnect: true,
      parserChannel: configured?.parserChannel || serialParserManager.channels.HEAD,
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  /**
   * 按 manifest 声明打开展示系统的一路物理串口。
   *
   * 角色与协议由展示系统配置决定；找不到声明时拒绝猜测波特率或 parser，
   * 避免把同波特率的不同设备错误映射到一起。
   */
  function openManifestSerialPort(serialRole, portPath, reason = 'open manifest channel') {
    if (!portPath || !serialRole) return null;
    const configured = getManifestSerialChannel(serialRole);
    if (!configured) {
      logger.warn({ serialRole, portPath }, `${reason}: no manifest channel declared`);
      return null;
    }

    return openManagedSerialPort(serialRole, {
      path: portPath,
      baudRate: configured.baudRate,
      reconnect: true,
      parserChannel: configured.parserChannel,
      onOpenError: (err) => logger.warn(err, `${reason} err`),
    });
  }

  /**
   * 原子校验一批 manifest 串口后再逐路打开。
   * 未声明角色会在任何硬件动作前失败；同步打开异常时关闭本批已启动角色。
   */
  function openManifestSerialPorts(channelPorts = {}, reason = 'open manifest channels') {
    const entries = Object.entries(channelPorts || {})
      .filter(([serialRole, portPath]) => serialRole && portPath != null);
    const invalidEntry = entries.find(([serialRole]) => !getManifestSerialChannel(serialRole));
    if (invalidEntry) throw createInvalidSerialRoleError(invalidEntry[0]);

    const rollbackRoles = [];
    try {
      return entries.map(([serialRole, portPath]) => {
        // registerPort 发生在 start 之前；即使 start 同步抛错，当前角色也必须禁用重连并停止。
        rollbackRoles.push(serialRole);
        const port = openManifestSerialPort(serialRole, portPath, `${reason} ${serialRole}`);
        if (!port) throw createInvalidSerialRoleError(serialRole);
        return port;
      });
    } catch (error) {
      rollbackRoles.forEach((serialRole) => {
        void closeManagedSerialPort(serialRole, `${reason} rollback`);
      });
      throw error;
    }
  }

  /**
   * 按动态角色批量关闭。strict 模式只接受当前 manifest 声明或已注册的角色，
   * 避免把拼写错误当成成功关闭。
   */
  function closeManagedSerialPorts(roles = [], reason = 'close managed channels', { strict = false } = {}) {
    const normalizedRoles = [...new Set(
      (Array.isArray(roles) ? roles : [roles])
        .map((role) => String(role || '').trim())
        .filter(Boolean),
    )];
    if (strict) {
      const registeredRoles = new Set(listManagedSerialRoles());
      const invalidRole = normalizedRoles.find((role) => (
        !getManifestSerialChannel(role) && !registeredRoles.has(role)
      ));
      if (invalidRole) throw createInvalidSerialRoleError(invalidRole);
    }
    return normalizedRoles.map((role) => closeManagedSerialPort(role, reason));
  }

  /**
   * 关闭 SerialManager 当前登记的所有物理串口，但保留全局重连定时器本身。
   * 新展示系统随后打开的新角色仍可继续使用同一重连循环。
   */
  function closeAllManagedSerialPorts(reason = 'close all managed channels') {
    return closeManagedSerialPorts(listManagedSerialRoles(), reason);
  }

  return {
    closeAllManagedSerialPorts,
    closeManagedSerialPort,
    closeManagedSerialPorts,
    getManagedSerialPort,
    getSitParserChannel,
    openBackSerialPort,
    openHeadSerialPort,
    openManifestSerialPort,
    openManifestSerialPorts,
    openManagedSerialPort,
    openSitSerialPort,
  };
}

module.exports = {
  createSerialPortOrchestrator,
};
