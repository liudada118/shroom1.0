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
    closeManagedSerialPort,
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
    openMinzhenSensorPort,
    openSitSerialPort,
    petCareRuntimeService,
    publishHistoryDateList,
    publishSystemEvent,
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
      if (!isAuthorizedRuntime()) return {};
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
        closeManagedSerialPort(serialRoles.SIT, 'file switch');
        publishSystemEvent({
          sitData: new Array(runtime.file === 'bigBed' ? 2048 : runtime.sitTotal).fill(0),
        });
      }
      if (runtime.port2?.isOpen) {
        closeManagedSerialPort(serialRoles.BACK, 'file switch');
        publishSystemEvent({
          backData: new Array(runtime.backTotal).fill(0),
        });
      }
      if (runtime.portHead?.isOpen) {
        closeManagedSerialPort(serialRoles.HEAD, 'file switch');
        publishSystemEvent({
          headData: new Array(100).fill(0),
        });
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
        indexArr: [0, 0],
      });
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
      message.sitClose === true ||
      message.backClose === true ||
      message.headClose === true ||
      message.sensorClose === true
    ),
    handle: (message, context = {}) => {
      if (!isAuthorizedRuntime()) return {};
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
      if (!isAuthorizedRuntime()) return {};
      const runtime = getRuntime();
      if (context.scope === 'back') {
        if (message.local === true) {
          publishSystemEvent({ backData: new Array(runtime.backTotal).fill(0) });
        } else {
          setRuntime({ localFlag: false });
          stopPlaybackTimer();
          publishSystemEvent({ backData: new Array(runtime.backTotal).fill(0) });
          if (runtime.com1) {
            openBackSerialPort(runtime.com1, 'server1 resume back');
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
      if (!isAuthorizedRuntime()) return {};
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
