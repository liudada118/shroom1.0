/**
 * 创建串口打开/关闭编排器。
 *
 * SerialManager 负责物理串口生命周期，本模块负责把业务角色映射到
 * parser channel、波特率、自动重连和特殊数据 handler。
 *
 * **这里有两族打开函数，语义不同，别混用：**
 * - 旧路径 `openSitSerialPort`/`openBackSerialPort`/`openHeadSerialPort` —— 角色写死，
 *   配置查不到就**回落**到内置波特率与 parser 通道。老传感器上线时还没有 manifest，
 *   这条路径是它们唯一的入口，不能撤。
 * - manifest 路径 `openManifestSerialPort`/`openManifestSerialPorts` —— 角色由展示系统
 *   声明，查不到就**拒绝**打开。二开新增的传感器一律走这条：宁可报「manifest 没声明」，
 *   也不要靠猜波特率把同波特率的两种设备错认成一种（那会解析出看似合理的假数据）。
 *
 * 本模块**不持有**串口状态，全部委托给 SerialManager；它持有的只是「角色 → 配置来源」
 * 这层映射。所以切换展示系统时不需要重建它，只要 `getSensorType()` 变了行为就跟着变。
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
  /**
   * 取当前传感器型号下某个固定角色的串口配置（波特率 + parser 通道）。
   *
   * 只服务 `openSitSerialPort`/`openBackSerialPort`/`openHeadSerialPort` 这三条**旧路径**：
   * 它们的角色是写死的（sit/back/head），配置查不到时会回落到 `getBaudRate()` 和内置的
   * parser 通道常量 —— 那是老式传感器上线时就有的行为，不能撤。
   * 新的 manifest 路径走 `getManifestSerialChannel`，查不到就拒绝打开，不回落。
   *
   * `typeof` 判断是为了让不注入 `getSerialConfig` 的测试装配仍能跑（回落到全部内置默认）。
   *
   * @param {string} role 串口角色。
   * @returns {{baudRate: number, parserChannel: string, protocol: object}|null} 配置或 null。
   */
  function getConfiguredChannel(role) {
    return typeof getSerialConfig === 'function'
      ? getSerialConfig(getSensorType(), role)
      : null;
  }

  /**
   * 按角色取已打开的物理串口对象。
   *
   * 透传 SerialManager，存在的意义是让上层（命令层、HTTP 路由）只依赖本编排器一个门面，
   * 不用各自去 import serialManager —— 否则「谁能碰串口」这件事就没有唯一入口了。
   *
   * @param {string} role 串口角色。
   * @returns {object|undefined} SerialPort 实例；未打开时 undefined。
   */
  function getManagedSerialPort(role) {
    return serialManager.getPort(role);
  }

  /**
   * 在当前展示系统的 manifest 声明里找某个角色的通道。
   *
   * 这是 manifest 路径的**唯一合法性判据**：角色必须由当前展示系统显式声明过。
   * 返回 null 有两种含义（manifest 没声明 / 装配没注入 `listSerialChannels`），
   * 调用方都当「不允许操作这个角色」处理 —— 见 `createInvalidSerialRoleError` 的理由。
   *
   * 每次都现查而不缓存：切换展示系统会换掉整份通道声明，缓存会让刚切过去的系统仍然
   * 能打开上一套的角色。
   *
   * @param {string} role 串口角色。
   * @returns {object|null} 通道声明（含 baudRate/parserChannel）或 null。
   */
  function getManifestSerialChannel(role) {
    if (!role || typeof listSerialChannels !== 'function') return null;
    const channels = listSerialChannels(getSensorType()) || [];
    return channels.find((channel) => channel.serialRole === role) || null;
  }

  /**
   * 列出 SerialManager 当前**登记过**的全部角色（不只是打开着的）。
   *
   * ⚠️ `serialManager.getStatus()` 遍历的是 `registeredPorts`，所以已经关掉但登记还在的
   * 角色也会出现在这里。两处依赖这个语义：
   * - `closeAllManagedSerialPorts` 借它拿到「所有该关的角色」—— 包含 status 为 closed 的
   *   也无害（`stop` 对已关端口是幂等的），漏掉正在重连的才是真问题。
   * - `closeManagedSerialPorts` 的 strict 校验用它兜住「manifest 已经换掉、但上一套的
   *   端口还开着」这种情况，否则切换展示系统后就再也关不掉旧角色了。
   *
   * `status.role || status.portId` 是因为没显式给 role 的登记会退化成用 portId 当角色
   * （见 serialManager 的 `buildStatus`）。去重是因为多个 portId 可能映射到同一角色。
   *
   * @returns {string[]} 角色列表，去重且去掉空值。
   */
  function listManagedSerialRoles() {
    if (typeof serialManager.getStatus !== 'function') return [];
    const statuses = serialManager.getStatus();
    if (!Array.isArray(statuses)) return [];
    return [...new Set(statuses
      .map((status) => status?.role || status?.portId)
      .filter(Boolean))];
  }

  /**
   * 造一个「这个串口角色当前不合法」的错误。
   *
   * 带 `code`/`httpStatus` 是为了让 HTTP 命令层不用再猜：这是**调用方传错了**（400），
   * 不是后端故障（500）。二开者自己写的展示系统忘了声明通道时，看到的应该是
   * 「manifest 里没有这个角色」而不是一个 500 —— 后者会让人去查串口硬件。
   *
   * 400 而不是 404 的理由：请求是打开某个角色，角色名本身是请求体的一部分，
   * 属于参数不合法。
   *
   * @param {string} serialRole 不合法的角色名。
   * @returns {Error} 带 code 与 httpStatus 的错误（**返回，不抛**，由调用方决定何时抛）。
   */
  function createInvalidSerialRoleError(serialRole) {
    const error = new Error(`serial role is not declared by current manifest: ${serialRole}`);
    error.code = 'INVALID_COMMAND';
    error.httpStatus = 400;
    return error;
  }

  /**
   * 取坐垫（sit）角色该用的 parser 通道。
   *
   * 小床 12B 的帧分隔符与普通压力帧不同（见 serialRuntimeFactory 注入的两个 delimiter），
   * 所以它要走独立的 parser 通道 —— 用错通道的现象是**分帧全错、数据像噪声**，而不是报错，
   * 所以这个分支不能省。
   *
   * 单独抽成函数（而不是内联在 `openSitSerialPort` 里）是因为它也被导出：命令层在不重开
   * 串口的情况下也要知道当前该往哪个通道喂数据。
   *
   * @returns {string} parser 通道标识。
   */
  function getSitParserChannel() {
    return getSensorType() === smallBed12BType
      ? serialParserManager.channels.SMALL_BED_12B
      : serialParserManager.channels.SIT;
  }

  /**
   * 登记并启动一路物理串口。
   *
   * **必须先 `registerPort` 再 `start`**：SerialManager 的 `start` 只认已登记的 portId，
   * 没登记会直接抛 `serial port is not registered`。重连循环读的也是登记信息，
   * 所以「登记」是配置的存放处，「启动」才碰硬件。同一角色重复调用等于用新配置覆盖旧登记
   * 并重启该端口（`start` 内部会先 `stop` 自己）。
   *
   * `reconnect: options.reconnect === true` 显式归一成布尔：这个值会被重连循环按
   * `!== true` 判断，传进来一个 truthy 的字符串会让「不该重连的端口」开始自动重连。
   *
   * ⚠️ 副作用：`serialManager.start` 会关掉**其他**指向同一物理路径的角色
   * （见 serialManager 的 `closeByPath`）。这是有意的 —— 一个 COM 口不能被两个角色同时读，
   * 但也意味着把两个角色配到同一路径时，后打开的会静默顶掉先打开的。
   *
   * @param {string} role 串口角色。
   * @param {object} [options] 端口配置（path/baudRate/parserChannel/dataHandler/onOpenError/reconnect）。
   * @returns {object} SerialPort 实例。
   * @throws {Error} 缺 path 或底层打开失败（同步部分）。
   */
  function openManagedSerialPort(role, options = {}) {
    serialManager.registerPort(role, {
      ...options,
      role,
      reconnect: options.reconnect === true,
    });
    return serialManager.start(role);
  }

  /**
   * 关闭一路物理串口。
   *
   * **必须先 `setReconnect(role, false)` 再 `stop`。** 顺序反了的话，重连循环会在下一个
   * tick 看到「登记着、要求重连、但没开」的端口，把它重新拉起来 —— 现象是「点了关闭，
   * 串口过一秒自己又开了」，而且没有任何错误日志。
   *
   * 只清重连标志、不注销登记：登记信息保留着，下次同角色 `openManagedSerialPort` 仍会
   * 覆盖它；同时 `listManagedSerialRoles` 还能看到这个角色，strict 校验才不会把它当拼写错误。
   *
   * @param {string} role 串口角色。
   * @param {string} reason 关闭原因，进日志用于区分是用户操作还是切换展示系统触发的。
   * @returns {Promise<void>} 端口关闭完成。对未打开的端口是幂等的。
   */
  function closeManagedSerialPort(role, reason) {
    serialManager.setReconnect(role, false);
    return serialManager.stop(role, reason);
  }

  /**
   * 打开坐垫（sit）串口 —— 旧路径的三个固定角色之一。
   *
   * 与 manifest 路径的关键区别是**查不到配置也照样开**：波特率回落到 `getBaudRate()`
   * （全局主压力波特率），parser 通道回落到内置常量。这批老传感器上线时还没有 manifest，
   * 撤掉回落就等于让它们全部打不开，所以这条路径要一直留着。
   *
   * 两层 parser 回落的嵌套顺序：manifest 声明 → `bigBed` 专用通道 → `getSitParserChannel()`
   * （它自己还要再分 smallBed12B）。`bigBed` 单独判是因为它的分帧与坐垫不同但共用 sit 角色。
   *
   * `reconnect: true` 是这三个角色的默认策略：压力垫是主数据源，掉线要自己恢复，
   * 否则用户得手动重开串口。
   *
   * 空 `portPath` 返回 null 而不是抛错：调用方常常是「配置里有就开」的循环，
   * 没配路径是正常的未接线状态。
   *
   * @param {string} portPath 串口设备路径（如 COM3 / /dev/ttyUSB0）。
   * @param {string} [reason] 日志前缀。
   * @returns {object|null} SerialPort 实例；路径为空时 null。
   */
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

  /**
   * 打开靠背（back）串口 —— 旧路径的三个固定角色之一。
   *
   * **敏枕（minzhen）是这里唯一的分叉，而且它绕开了整个 parser 层。** 敏枕传感器发的是
   * 换行分隔的**文本**，不是本仓统一的二进制分隔符帧，所以：
   * - `parserChannel: undefined` —— 不接 parser（接了会按二进制分隔符切，切出来全是垃圾）。
   * - `dataHandler` 直接挂到 port 的 `'data'` 事件上，自己做文本分帧（见 server.js 的
   *   `handleMinzhenSensorPortData` + `minzhenSensorExtractor`）。
   *
   * 打开前 `resetMinzhenSensorExtractor()` 是必需的：那个提取器持有一段跨 chunk 的残留
   * 缓冲，上次断开时很可能停在半行上。不清的话新连接的第一帧会和上次的尾巴拼成一行，
   * 解析失败 —— 现象是「重连后第一帧数据丢了」，偶发且难查。
   *
   * 非敏枕分支与 sit 一致：manifest 配置优先，查不到回落到全局波特率 + 内置 BACK 通道。
   *
   * @param {string} portPath 串口设备路径。
   * @param {string} [reason] 日志前缀。
   * @returns {object|null} SerialPort 实例；路径为空时 null。
   */
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

  /**
   * 打开头部（head）串口 —— 旧路径的三个固定角色之一。
   *
   * 三个旧角色里最简单的一个：没有型号分叉，只有「manifest 配置优先、查不到回落」这一层。
   * 它与 sit/back 长得几乎一样却没有合并，是因为另两个各自带了不可共享的分支
   * （sit 的三层 parser 回落、back 的敏枕文本路径），强行抽公共函数会得到一个满是
   * 型号判断的开关函数 —— 那正是 manifest 路径要取代的形态。新增角色请走
   * `openManifestSerialPort`，不要在这里加第四个。
   *
   * @param {string} portPath 串口设备路径。
   * @param {string} [reason] 日志前缀。
   * @returns {object|null} SerialPort 实例；路径为空时 null。
   */
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
