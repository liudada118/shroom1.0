/**
 * WebSocket 连接处理挂载器。
 *
 * 这是过渡层：先把三端口 WebSocket 连接和旧消息处理从 server.js 迁出；
 * 命令处理和运行时状态后续再继续下沉。ctx 中的访问器是旧状态兼容入口。
 */
function createWebSocketHandlerAttacher(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('webSocket handler context is required');
  }

  return function attachWebSocketHandlers() {
    with (ctx) {
    if (serverOpened) {
      logger.info("[Server] openServer skipped: listeners already attached");
      return;
    }

    serverOpened = true;
    serverShutdownRequested = false;

    server1.on("open", function open() {
      logger.info("connected");
    });

    server1.on("close", function close() {
      logger.info("disconnected");
    });

    // 头枕端口只负责 head 实时数据订阅，控制命令统一走主端口或 HTTP。
    server2.on("connection", function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = `${ip}${port}`;
      logger.info("%s is connected to head channel", clientName);
      wsSubscriptions.registerClient(ws, {
        channels: ['head'],
        clientId: clientName,
        scope: 'head',
      });
    });

    // 靠背端口保留少量旧命令兼容，同时默认订阅 back 通道。
    server1.on("connection", function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = `${ip}${port}`;
      wsSubscriptions.registerClient(ws, {
        channels: ['back'],
        clientId: clientName,
        scope: 'back',
      });
      ws.on("message", function incoming(message) {
        logger.debug("received: %s from %s", message, clientName, localFlag);

        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;
        controlCommandService.executeWs(getMessage, { clientName, scope: 'back' });

      });
    });

    server.on("open", function open() {
      logger.info("connected");
    });

    server.on("close", function close() {
      logger.info("disconnected");
    });

    // 主端口负责旧前端连接、授权状态下发、历史回放控制和实时坐面订阅。
    server.on("connection", function connection(ws, req) {

      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = ip + port;
      logger.info("%s is connected", clientName);
      wsSubscriptions.registerClient(ws, {
        channels: [WILDCARD_CHANNEL],
        clientId: clientName,
        scope: 'main',
      });

      attachHeartbeat(ws, { clientName, logger, intervalMs: 30000 });

      publishSystemEvent({
          port: serialport,
          file: licenseFile || file,
          selectFlag: selectFlag
          // length: csvSitData.length,
          // sitData: csvSitData[0], backData: csvBackData[0]
        });

      if (endDate && endDate > 0) {
        publishSystemEvent({
            date: endDate,
            nowDate: nowDate,
            file: licenseFile || file,
            selectFlag: selectFlag
          });
      } else {
        // 没有有效密钥时，发送错误信息给前端。
        publishSystemEvent({ licenseError: '未检测到有效密钥，请输入密钥后使用', noLicense: true });
      }

      ws.on("message", function incoming(message) {


        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;
        const commandResult = controlCommandService.executeWs(getMessage, { clientName, scope: 'main' });
        if (commandResult.stop) return;

        // if(getMessage.compen != null){
        //   compen = getMessage.compen
        // }

        if (getMessage.date != null) {
          try {
            const content = (getMessage.date.date)
            const date = content

            if (!date || date.trim() === '') {
              // 空密钥处理：发送错误提示给前端。
              logger.warn('[License] Empty license key received');
              publishSystemEvent({ licenseError: '密钥不能为空，请输入有效密钥' });
              return;
            }

            const dateRes = module2.decryptStr(date)

            if (!dateRes) {
              logger.warn('[License] Failed to decrypt license key');
              publishSystemEvent({ licenseError: '密钥无效，解密失败' });
              return;
            }

            fs.mkdirSync(path.dirname(writableNameTxt), { recursive: true });
            fs.writeFile(writableNameTxt, date, err => {
              if (err) {
                logger.error(err);
              }
            });
            nameTxt = writableNameTxt;

            const parsedLicense = JSON.parse(dateRes);
            licenseFile = parsedLicense.file || null;
            selectFlag = getSelectFlagFromLicense(parsedLicense.file);
            // 支持 moduleConfig 字段：各传感器类型的默认功能模块配置。
            // { [sensorValue]: numMatrixFlag }
            const rawModuleConfig = parsedLicense.moduleConfig || null;
            const nextFile = getDefaultFileFromLicense(parsedLicense.file);
            if (nextFile) {
              file = nextFile;
              petCareRuntimeService.resetAll();
            }
            endDate = parseFloat(parsedLicense.date);

            baudRate = getSensorBaudRate(file);
            const payload = {
              date: endDate,
              nowDate: nowDate,
              file: licenseFile || file,
              selectFlag: selectFlag,
            };
            // 将功能模块配置一并下发给前端。
            if (rawModuleConfig) {
              payload.moduleConfig = rawModuleConfig;
            }
            publishSystemEvent(payload);

          } catch (err) {
            logger.error('[License] Invalid license key:', err.message);
            publishSystemEvent({ licenseError: '密钥无效，请检查后重新输入' });
          }
        }



        // if(new Date().getTime() >= parseInt(sysStartTime) + parseInt(module2.decryptStr(date)) * 24 * 60 * 60 * 1000){
        //   legacyClientBroadcast( {
        //     /**
        // 向前端广播授权状态或授权错误。
        //      *  */
        //     const jsonData = JSON.stringify({
        //       timeExpires: true,
        //       // length: csvSitData.length,
        //       // sitData: csvSitData[0], backData: csvBackData[0]
        //     });
        //     if (client.readyState === WebSocket.OPEN) {
        //       client.send(jsonData);
        //     }
        //   });
        // }

        if (nowDate < endDate) {



          if (getMessage.variety != null) {
            if (indexArr) {
              if (localDataBack.length) {

                const startArr = JSON.parse(localDataBack[indexArr[0]].data);
                const endArr = JSON.parse(localDataBack[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  backData: newArr,
                });
                publishSystemEvent( jsonData);
              }
              if (localData.length) {

                const startArr = JSON.parse(localData[indexArr[0]].data);
                const endArr = JSON.parse(localData[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  sitData: newArr,
                });
                publishSystemEvent( jsonData);
              }
            }
          }

          // 保留旧版调试分支。
          if (getMessage.resetZero === true) {
            if (pointArr) pointArr1zero = [...pointArr1zeroData]
            if (pointArr2) pointArr2zero = [...pointArr2zeroData]
            if (pointArr3) pointArr3zero = [...pointArr3zeroData]
            if (pointArr4) pointArr4zero = [...pointArr4zeroData]
            if (pointArr1RawZeroData.length) pointArr1RawZero = [...pointArr1RawZeroData]
            if (pointArr2RawZeroData.length) pointArr2RawZero = [...pointArr2RawZeroData]
            if (newArr147) pointArr147zero = [...newArr147]
            if (newArr147_2) pointArr147zero_2 = [...newArr147_2]

          }

          if (getMessage.resetZero === false) {
            pointArr1zero = []
            pointArr2zero = []
            pointArr3zero = []
            pointArr4zero = []
            pointArr1RawZero = []
            pointArr2RawZero = []
            pointArr147zero = []
            pointArr147zero_2 = []
          }

          /**
           * 打开本地保存数据通道。
           */
          /**
           * 打开实时座椅数据通道。
           */
          /**
           * 打开实时靠背数据通道。
           */
          /**
           * 关闭座椅数据通道。
           */
          /**
           * 推送回放帧给前端。
           */
          /**
           * 打开读取本地数据通道。
           */
          if (localFlag) {
            if (getMessage.value != null) {
              const value = Number(getMessage.value);
              logger.debug('received playback index %s from %s', value, clientName);
              nowIndex = value;
              publishPlaybackFrame(value, { includeIndex: false });
            }
          }
          // 靠背框选统计。
          if (getMessage.backIndex != null) {
            let press = [],
              area = [];
            if (localDataBack.length) {
              const backArr = getMessage.backIndex;
              (backPressSelect = []), (backAreaSelect = []);
              for (let i = 0; i < localDataBack.length; i++) {
                newback = [];
                // for (let x = backArr[2] < 0 ? 0 :backArr[2] ; x < backArr[3]; x++) {
                //   for (let y = backArr[0] < 0 ? 0 :backArr[0] ; y < backArr[1]; y++) {
                //     newback.push(JSON.parse(localDataBack[i].data)[x * 32 + y])
                //   }
                // }

                for (
                  let x = backArr[0] < 0 ? 0 : backArr[0];
                  x <= (backArr[1] > 31 ? 31 : backArr[1]);
                  x++
                ) {
                  for (
                    let y = 31 - backArr[3] < 0 ? 0 : 31 - backArr[3];
                    y <= (31 - backArr[2] > 31 ? 31 : 31 - backArr[2]);
                    y++
                  ) {
                    newback.push(JSON.parse(localDataBack[i].data)[x * 32 + y]);
                  }
                }
                // newback = newback.filter((a))
                let a = newback.reduce((a, b) => a + b, 0);
                let b = newback.filter((a) => a > 10).length;

                // backPressSelect.push(pressToN(b, a ));
                // backAreaSelect.push(b*2.1);

                backPressSelect.push(totalToN(a, 1.3));
                backAreaSelect.push(b);
              }


              publishSystemEvent({
                  pressArr: backPressSelect,
                  areaArr: backAreaSelect,
                  length: length,
                  time: timeStamp,
                  index: nowIndex,
                  // backData: file === 'car10' ? new Array(100).fill(0) : new Array(1024).fill(0),
                });
            }
          }

          if (getMessage.sitIndex != null) {

            const sitArr = getMessage.sitIndex;
            (sitPressSelect = []), (sitAreaSelect = []);
            for (let i = 0; i < localData.length; i++) {
              const newsit = [];
              // for (let x = sitArr[2]; x < sitArr[3]; x++) {
              //   for (let y = sitArr[0]; y < sitArr[1]; y++) {
              //     newsit.push(JSON.parse(localData[i].data)[x * 32 + y])
              //   }
              // }
              if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE || file === TEMP_FULL_BED_TYPE) {
                const storedSitData = file === TEMP_FULL_BED_TYPE
                  ? buildTempFullBedPlaybackPayload(localData[i]).sitData
                  : file === SMALL_BED_12B_TYPE
                    ? normalizeHistoryPressureData(localData[i], file)
                    : getStoredSitData(localData[i]);
                const storedFrame = parseStoredFrameData(localData[i]);
                const storedWidth = file === TEMP_FULL_BED_TYPE ? 15 : Number(storedFrame?.matrixWidth) || 32;
                for (let x = sitArr[0]; x < sitArr[1]; x++) {
                  for (let y = sitArr[2]; y < sitArr[3]; y++) {
                    newsit.push(storedSitData[x * storedWidth + y]);
                  }
                }
              } else {
                let data = JSON.parse(localData[i].data)
                // data = pressSmallBed({arr : data ,width : 32 ,height : 32 , type})
                for (let x = sitArr[2]; x < sitArr[3]; x++) {
                  for (let y = sitArr[0]; y < sitArr[1]; y++) {
                    newsit.push(JSON.parse(localData[i].data)[x * 32 + y]);
                  }
                }

              }

              let a = newsit.reduce((a, b) => a + b, 0);
              let b = newsit.filter((a) => a > 10).length;
              // sitPressSelect.push(pressToN(b, a));
              // sitAreaSelect.push(b * 2.1);
              sitPressSelect.push(formatMatrixTotalForFile(a, file));
              sitAreaSelect.push(b);
            }

            publishSystemEvent({
                length: length,
                time: timeStamp,
                index: nowIndex,
                pressArr: sitPressSelect,
                areaArr: sitAreaSelect,
                // length: csvSitData.length,
                // sitData: file === 'bigBed' ? new Array(2048).fill(0) : new Array(1024).fill(0),
              });
          }

          // 历史曲线统计。
          // 调整高斯滤波参数。
          // 打开压力数据推送通道。
          if (getMessage.indexArr != null) {

            historyArr = getMessage.indexArr;
            const historySeries = getHistorySeries({
              sitRows: localData,
              backRows: localDataBack,
              start: getMessage.indexArr[0],
              end: getMessage.indexArr[1],
              file,
            });
            const press = historySeries.press;
            const area = historySeries.area;

            publishSystemEvent({
                pressArr: press,
                areaArr: area,
                // length: csvSitData.length,
                // sitData: csvSitData[0], backData: csvBackData[0]
              });

            indexArr = getMessage.indexArr;
            // localData
            // localDataBack
          }
        }
      });
    })

    }
  };
}

module.exports = {
  createWebSocketHandlerAttacher,
};
