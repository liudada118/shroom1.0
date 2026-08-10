/**
 * 串口过滤服务。
 *
 * 负责跨平台识别 WCH/CH34x 类 USB 转串口设备，并为串口扫描结果生成精简日志。
 * 业务层只需要调用 getPort 和 logSerialPortList，不再关心 vendorId/productId/pnpId 的兼容判断。
 */
function createSerialPortFilterService({
  logger,
  getPlatform = () => process.platform,
} = {}) {
  const WCH_ALLOWED_VENDOR_IDS = new Set(['1A86']);
  const WCH_ALLOWED_PRODUCT_IDS = new Set(['7523', '55D3']);

  /**
   * 归一化串口标识字段，便于跨平台比较 vendorId、productId、pnpId 等值。
   *
   * @param {unknown} value 串口描述字段。
   * @returns {string} 去空格并转大写后的字符串。
   */
  function normalizeSerialIdentifier(value) {
    return String(value || '').trim().toUpperCase();
  }

  /**
   * 判断串口描述是否命中 WCH/CH34x 类 USB 转串口特征。
   *
   * @param {object} port 串口扫描结果。
   * @returns {boolean} 是否是目标 WCH 类串口。
   */
  function hasWchSerialSignature(port = {}) {
    const vendorId = normalizeSerialIdentifier(port.vendorId ?? port.vendorIdentifier);
    const productId = normalizeSerialIdentifier(port.productId ?? port.productIdentifier);
    const pnpId = normalizeSerialIdentifier(port.pnpId);
    const manufacturer = normalizeSerialIdentifier(port.manufacturer);
    const friendlyName = normalizeSerialIdentifier(port.friendlyName);
    const portPath = normalizeSerialIdentifier(port.path);

    if (vendorId && WCH_ALLOWED_VENDOR_IDS.has(vendorId)) {
      return true;
    }

    if (pnpId.includes('VID_1A86')) {
      return true;
    }

    if (WCH_ALLOWED_PRODUCT_IDS.has(productId) && portPath.includes('USBSERIAL')) {
      return true;
    }

    if (portPath.includes('WCHUSBSERIAL')) {
      return true;
    }

    if (manufacturer.includes('WCH')) {
      return true;
    }

    return friendlyName.includes('CH34') ||
      friendlyName.includes('USB-SERIAL') ||
      friendlyName.includes('USB-ENHANCED-SERIAL');
  }

  /**
   * 判断 Windows 下是否为目标串口。
   *
   * @param {object} port 串口扫描结果。
   * @returns {boolean} 是否符合 Windows 目标串口规则。
   */
  function isWindowsTargetSerialPort(port = {}) {
    return hasWchSerialSignature(port);
  }

  /**
   * 判断 macOS 下是否为目标串口。
   *
   * @param {object} port 串口扫描结果。
   * @returns {boolean} 是否符合 macOS 目标串口规则。
   */
  function isMacTargetSerialPort(port = {}) {
    return hasWchSerialSignature(port);
  }

  /**
   * 根据当前操作系统筛选可用串口列表。
   *
   * @param {object[]} ports SerialPort.list 返回的串口列表。
   * @returns {object[]} 过滤后的串口列表。
   */
  function getPort(ports) {
    const portList = Array.isArray(ports) ? ports : [];
    const platform = getPlatform();

    if (platform === 'win32') {
      const filteredPorts = portList.filter(isWindowsTargetSerialPort);
      logger?.info?.(`[SerialList] filter win32 whitelist matched ${filteredPorts.length}/${portList.length} port(s)`);
      return filteredPorts;
    }

    if (platform === 'darwin') {
      const filteredPorts = portList.filter(isMacTargetSerialPort);
      logger?.info?.(`[SerialList] filter darwin whitelist matched ${filteredPorts.length}/${portList.length} port(s)`);
      return filteredPorts;
    }

    return portList;
  }

  /**
   * 提取串口对象中的关键字段，避免日志输出过大的原始对象。
   *
   * @param {object} port 串口扫描结果。
   * @returns {object} 精简后的串口摘要。
   */
  function summarizeSerialPort(port = {}) {
    const summary = {
      path: port.path ?? null,
      manufacturer: port.manufacturer ?? null,
      serialNumber: port.serialNumber ?? null,
      pnpId: port.pnpId ?? null,
      vendorId: port.vendorId ?? null,
      productId: port.productId ?? null,
      friendlyName: port.friendlyName ?? null,
      locationId: port.locationId ?? null,
    };

    if (port.vendorIdentifier != null) {
      summary.vendorIdentifier = port.vendorIdentifier;
    }

    if (port.productIdentifier != null) {
      summary.productIdentifier = port.productIdentifier;
    }

    return summary;
  }

  /**
   * 记录串口扫描结果，便于定位自动连接和串口筛选问题。
   *
   * @param {string} reason 本次扫描或刷新原因。
   * @param {object[]} ports 串口列表。
   */
  function logSerialPortList(reason, ports) {
    const portList = Array.isArray(ports) ? ports : [];
    logger?.info?.(`[SerialList] ${reason}: detected ${portList.length} port(s)`);

    if (portList.length === 0) {
      logger?.warn?.(`[SerialList] ${reason}: no serial ports detected`);
      return;
    }

    portList.forEach((port, index) => {
      logger?.info?.(`[SerialList] ${reason} #${index + 1}`, summarizeSerialPort(port));
    });
  }

  return {
    getPort,
    hasWchSerialSignature,
    isMacTargetSerialPort,
    isWindowsTargetSerialPort,
    logSerialPortList,
    normalizeSerialIdentifier,
    summarizeSerialPort,
  };
}

module.exports = {
  createSerialPortFilterService,
};
