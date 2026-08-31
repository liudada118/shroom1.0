/**
 * 构造回到实时模式时需要推送的空白帧。
 * 作用是让旧前端页面清空历史回放画面，避免残留上一帧历史数据。
 */
function createZeroPayloads({ file, sitTotal, backTotal, isCar, isThreePortFile }) {
  const payloads = [];
  payloads.push({
    sitData: new Array(file === 'bigBed' ? 2048 : sitTotal).fill(0),
  });
  if (isCar(file)) {
    payloads.push({
      backData: new Array(backTotal).fill(0),
    });
    if (isThreePortFile(file)) {
      payloads.push({
        headData: new Array(100).fill(0),
      });
    }
  }
  return payloads;
}

/**
 * 注册串口和传感器控制命令。
 *
 * 这一组 handler 是 HTTP 控制面和旧 WebSocket 命令的共享实现：
 * - 打开/关闭 sit/back/head/sensor 串口
 * - 切换传感器类型 file
 * - 进入/退出 local 历史回放
 * - 刷新串口列表和自动连接触觉手套
 *
 * 注意：handler 通过 getRuntime/setRuntime 读写 server 运行时状态，
 * 不直接 import server.js，避免形成反向依赖。
 */
function registerSerialControlHandlers(router, deps) {
  const {
    HAND_GLOVE_DOUBLE,
    closeAllManagedSerialPorts,
    closeManagedSerialPort,
    closeManagedSerialPorts,
    closeMinzhenSensorPort,
    getPort,
    getRuntime,
    getSensorBaudRate,
    initDb,
    isCar,
    isThreePortFile,
    listPorts,
    loadSelectedHistory,
    logSerialPortList,
    logger,
    openBackSerialPort,
    openHeadSerialPort,
    openManifestSerialPort,
    openManifestSerialPorts,
    openMinzhenSensorPort,
    openSitSerialPort,
    petCareRuntimeService,
    publishHistoryDateList,
    publishSystemEvent,
    rebindDisplaySystemRuntime,
    serialRoles,
    setRuntime,
    stopPlaybackTimer,
  } = deps;

  /**
   * 授权有效期保护。
   * 旧逻辑要求大部分控制命令只在 nowDate < endDate 时生效。
   */
  function isAuthorizedRuntime() {
    const { nowDate, endDate } = getRuntime();
    return nowDate < endDate;
  }

  /**
   * 授权守卫：没有有效授权就抛错，中断当前命令。
   *
   * 与 `isAuthorizedRuntime()` 的分工是「拦截」与「判断」—— 后者用于分支（某些命令未授权时降级
   * 而不是失败），本函数用于绝大多数控制命令的入口。**抛错而不是返回 false**：守卫返回布尔值时
   * 漏写一个 `if` 就等于绕过授权且毫无征兆，抛错是唯一「默认安全」的形状。
   *
   * `code` + `httpStatus` 是与命令层的约定（同 `serialPortOrchestrator` 的 `INVALID_COMMAND`/
   * 400）：HTTP 层读 `httpStatus` 回状态码，WebSocket 层把 `code` 放进 `command.ack`。
   * **403 而不是 401**：重发凭据不会变好，前端靠这个区别决定是弹授权框还是提示「授权已过期」。
   *
   * ⚠️ 判据 `nowDate < endDate` 里的 `nowDate` 来自运行态（授权模块用网络时间刷新），不是现取
   * 系统时间 —— 时钟或授权刷新失败时，这里会沿用上一次的判断结果。
   *
   * @returns {void} 有授权时静默返回。
   * @throws {Error} 未授权时抛出带 `code: 'LICENSE_REQUIRED'` 与 `httpStatus: 403` 的错误。
   */
  function requireAuthorizedRuntime() {
    if (isAuthorizedRuntime()) return;
    const error = new Error('a valid license is required for this command');
    error.code = 'LICENSE_REQUIRED';
    error.httpStatus = 403;
    throw error;
  }

  // 加载指定日期的历史数据，并进入 local 回放状态。
  router.register({
    name: 'history-load-date',
    when: (message) => message.getTime != null,
    handle: (message) => {
      setRuntime({
        getTime: message.getTime,
        localFlag: true,
        nowGetTime: message.getTime,
      });
      loadSelectedHistory(message.getTime);
      return { stop: true };
    },
  });

  // 切换传感器类型：关闭旧串口、清空旧画面、重新初始化对应数据库。
  router.register({
    name: 'sensor-file-switch',
    when: (message) => message.file != null,
    handle: (message) => {
      requireAuthorizedRuntime();
      const runtime = getRuntime();

      setRuntime({
        backClose: true,
        sitClose: true,
        headClose: true,
        sensorClose: true,
        com: undefined,
        com1: undefined,
        comhead: undefined,
        comSensor: undefined,
      });

      if (runtime.port1?.isOpen) {
        publishSystemEvent({
          sitData: new Array(runtime.file === 'bigBed' ? 2048 : runtime.sitTotal).fill(0),
        });
      }
      if (runtime.port2?.isOpen) {
        publishSystemEvent({
          backData: new Array(runtime.backTotal).fill(0),
        });
      }
      if (runtime.portHead?.isOpen) {
        publishSystemEvent({
          headData: new Array(100).fill(0),
        });
      }

      if (typeof closeAllManagedSerialPorts === 'function') {
        closeAllManagedSerialPorts('file switch');
      } else {
        closeManagedSerialPort(serialRoles.SIT, 'file switch');
        closeManagedSerialPort(serialRoles.BACK, 'file switch');
        closeManagedSerialPort(serialRoles.HEAD, 'file switch');
      }
      closeMinzhenSensorPort('file switch');
      const receiveFile = message.file;
      const dbObj = initDb(receiveFile);
      petCareRuntimeService.resetAll();
      stopPlaybackTimer();
      setRuntime({
        file: receiveFile,
        baudRate: getSensorBaudRate(receiveFile),
        db: dbObj.db,
        db1: dbObj.db1,
        db2: dbObj.db2,
        nowIndex: 0,
        localData: [],
        localDataBack: [],
        localDataHead: [],
        historyChannels: [],
        indexArr: [0, 0],
      });
      // Display System dispatcher 的策略依赖当前传感器类型，切换后立即重绑，
      // 让刚保存的 parser/line-order/algorithm 链路无需重启软件即可接收数据。
      rebindDisplaySystemRuntime?.();
      // 当前选择与密钥授权范围是两类状态，不能再复用 file 字段，否则会覆盖前端授权列表。
      publishSystemEvent({ currentSensorType: receiveFile });
    },
  });

  // 串口打开/关闭控制。HTTP 请求会先被转换为这些旧命令字段。
  router.register({
    name: 'serial-port-control',
    when: (message) => (
      message.sitPort != null ||
      message.headPort != null ||
      message.sensorPort != null ||
      message.backPort != null ||
      message.channelPorts != null ||
      message.channelClose != null ||
      message.sitClose === true ||
      message.backClose === true ||
      message.headClose === true ||
      message.sensorClose === true
    ),
    handle: (message, context = {}) => {
      requireAuthorizedRuntime();
      // manifest 多传感器系统用 channelPorts 这一个字段承载任意数量的通道，
      // 而不是给每个新传感器再加一对 xxxPort / xxxClose 命令字段。
      if (message.channelPorts && typeof message.channelPorts === 'object') {
        if (typeof openManifestSerialPorts === 'function') {
          openManifestSerialPorts(message.channelPorts, context.scope || 'main');
        } else {
          Object.entries(message.channelPorts).forEach(([serialRole, portPath]) => {
            if (portPath == null) return;
            const opened = openManifestSerialPort?.(
              serialRole,
              portPath,
              `${context.scope || 'main'} ${serialRole}`,
            );
            if (!opened) {
              const error = new Error(`serial role is not declared by current manifest: ${serialRole}`);
              error.code = 'INVALID_COMMAND';
              error.httpStatus = 400;
              throw error;
            }
          });
        }
      }
      if (Array.isArray(message.channelClose)) {
        if (typeof closeManagedSerialPorts === 'function') {
          closeManagedSerialPorts(
            message.channelClose,
            `${context.scope || 'main'} manual close`,
            { strict: true },
          );
        } else {
          message.channelClose.forEach((serialRole) => {
            if (serialRole) closeManagedSerialPort(serialRole, `${context.scope || 'main'} manual close`);
          });
        }
      }
      if (message.sitPort != null) {
        setRuntime({ sitClose: false, com: message.sitPort });
        openSitSerialPort(message.sitPort, `${context.scope || 'main'} sitPort`);
      }
      if (message.headPort != null) {
        setRuntime({ headClose: false, comhead: message.headPort });
        openHeadSerialPort(message.headPort, `${context.scope || 'main'} headPort`);
      }
      if (message.sensorPort != null) {
        openMinzhenSensorPort(message.sensorPort);
      }
      if (message.backPort != null) {
        setRuntime({ backClose: false, com1: message.backPort });
        openBackSerialPort(message.backPort, `${context.scope || 'main'} backPort`);
      }
      if (message.sitClose === true) {
        setRuntime({ sitClose: true, com: undefined });
        closeManagedSerialPort(serialRoles.SIT, 'manual close');
      }
      if (message.backClose === true) {
        setRuntime({ backClose: true, com1: undefined });
        closeManagedSerialPort(serialRoles.BACK, `${context.scope || 'main'} manual close`);
      }
      if (message.headClose === true) {
        setRuntime({ headClose: true, comhead: undefined });
        closeManagedSerialPort(serialRoles.HEAD, 'manual close');
      }
      if (message.sensorClose === true) {
        setRuntime({ sensorClose: true, comSensor: undefined });
        closeMinzhenSensorPort('manual close');
      }
    },
  });

  // 历史回放/实时模式切换。back 独立端口保留旧兼容行为。
  router.register({
    name: 'local-playback-switch',
    when: (message) => message.local === true || message.local === false,
    handle: (message, context = {}) => {
      requireAuthorizedRuntime();
      const runtime = getRuntime();
      if (context.scope === 'back') {
        if (message.local === true) {
          publishSystemEvent({ backData: new Array(runtime.backTotal).fill(0) });
        } else {
          setRuntime({ localFlag: false });
          stopPlaybackTimer();
          publishSystemEvent({ backData: new Array(runtime.backTotal).fill(0) });
          if (runtime.com1) {
            openBackSerialPort(runtime.com1, 'shared websocket resume back');
          }
        }
        return {};
      }

      if (message.local === true) {
        setRuntime({ localFlag: true });
        publishHistoryDateList();
        return {};
      }

      setRuntime({ localFlag: false });
      createZeroPayloads({
        file: runtime.file,
        sitTotal: runtime.sitTotal,
        backTotal: runtime.backTotal,
        isCar,
        isThreePortFile,
      }).forEach(publishSystemEvent);
    },
  });

  // 坐垫和靠背串口互换，保留旧前端的 exchange 命令。
  router.register({
    name: 'exchange-sit-back-ports',
    when: (message) => message.exchange != null,
    handle: () => {
      requireAuthorizedRuntime();
      const runtime = getRuntime();
      const nextCom = runtime.com1;
      const nextCom1 = runtime.com;
      setRuntime({ com: nextCom, com1: nextCom1 });
      closeManagedSerialPort(serialRoles.SIT, 'exchange');
      closeManagedSerialPort(serialRoles.BACK, 'exchange');
      setTimeout(() => {
        const latest = getRuntime();
        if (latest.com) {
          openSitSerialPort(latest.com, 'exchange sit');
        }
        if (latest.com1) {
          openBackSerialPort(latest.com1, 'exchange back');
        }
      }, 1000);
    },
  });

  // 重新扫描串口列表，并将结果通过系统事件推送给旧前端。
  router.register({
    name: 'serial-port-list-refresh',
    when: (message) => message.serialReset != null,
    handle: () => {
      listPorts().then((ports) => {
        const serialport = getPort(ports);
        logSerialPortList('serialReset', serialport);
        setRuntime({ serialport });
        publishSystemEvent({ port: serialport });
      }).catch((error) => {
        logger.error('[SerialList] serialReset failed', error);
      });
    },
  });

  // 自动连接触觉手套双串口：默认取扫描结果中的前两个可用 path。
  router.register({
    name: 'auto-connect-hand-glove-double',
    when: (message) => message.autoConnectHand0205Double === true,
    handle: () => {
      listPorts().then((ports) => {
        const serialport = getPort(ports);
        logSerialPortList('autoConnectHand0205Double', serialport);
        setRuntime({ serialport });
        const paths = serialport.map((port) => port.path).filter(Boolean);
        if (paths.length < 2) {
          publishSystemEvent({
            port: serialport,
            autoConnectHand0205Double: {
              success: false,
              message: `触觉手套2 自动连接失败：只检测到 ${paths.length} 个可用手套串口`,
            },
          });
          return;
        }

        const [leftPath, rightPath] = paths;
        setRuntime({
          sitClose: false,
          backClose: false,
          com: leftPath,
          com1: rightPath,
          baudRate: getSensorBaudRate(HAND_GLOVE_DOUBLE),
        });
        closeManagedSerialPort(serialRoles.SIT, 'autoConnectHand0205Double');
        closeManagedSerialPort(serialRoles.BACK, 'autoConnectHand0205Double');
        try {
          openSitSerialPort(leftPath, 'autoConnectHand0205Double sit');
          openBackSerialPort(rightPath, 'autoConnectHand0205Double back');
          publishSystemEvent({
            port: serialport,
            autoConnectHand0205Double: {
              success: true,
              portname: leftPath,
              portnameBack: rightPath,
              message: `触觉手套2 已连接：${leftPath} / ${rightPath}`,
            },
          });
        } catch (error) {
          logger.warn('[autoConnectHand0205Double] open failed', error);
          publishSystemEvent({
            port: serialport,
            autoConnectHand0205Double: {
              success: false,
              message: error?.message || '触觉手套2 自动连接失败',
            },
          });
        }
      }).catch((error) => {
        logger.error('[SerialList] autoConnectHand0205Double failed', error);
        publishSystemEvent({
          autoConnectHand0205Double: {
            success: false,
            message: error?.message || '触觉手套2 串口扫描失败',
          },
        });
      });
    },
  });
}

module.exports = {
  registerSerialControlHandlers,
};
