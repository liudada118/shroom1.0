const logger = require('./logger');
const { startWorker, callPy, stopWorker } = require('./pyWorker');
﻿const WebSocket = require("ws");
const { app } = require('electron')
const path = require('path');
const os = require('os');
const fs = require('fs');
const { SerialPort } = require("serialport");
const { DelimiterParser } = require("@serialport/parser-delimiter");
const sqlite3 = require("./sqlite3-compat").verbose();
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const {
  openWeb,
  interp,
  addSide,
  gaussBlur_1,
  carSitLine,
  carBackLine,
  press,
  calculatePressure,
  car10Back,
  objChange,
  calPress,
  car10Sit,
  interp1016,
  timeStampToDate,
  sit10Line,
  press12,
  calPressArr,
  timeStampTo_Date,
  pressToN,
  smallBed,
  smallM,
  // pressSmallBed,
  smallM1,
  rect,
  short,
  smallBedReal,
  zeroLine,
  smallBedZero,
  handLine,
  matColLine,
  smallBed1,
  smallBedReal1,
  yanfeng10sit,
  yanfeng10back,
  handBlue,
  wowSitLine,
  wowBackLine,
  wowhead,
  xiyueReal1,
  jqbed,
  carCol,
  newHand,
  gloves,
  gloves1,
  gloves0123Res,
  gloves0123,
  gloves2,
  footR,
  footVideo1,
  handR,
  handRVideo1470506,
  handL,
  footVideo,
  footL,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  footArrToNormal,
  zeroLineMatrix,
  sit100Line,
  endiSit1024,
} = require("./openWeb");
const module2 = require('./aes_ecb')
const { isCar, dedupli, totalToN, } = require("./util");
const { pressSmallBed } = require("./utilMatrix");
const { gaussBlur_return, gaussBlur_2, interpSmall, findMax, numLessZeroToZero, press6, pressNew1220, press6sit, bytes4ToInt10, arrToRealLine } = require('./server/mathUtils');
const { initDb: _initDbFromModule } = require('./server/dbManager');

const getPort = (ports) => {
  // console.log(ports)
  // if (os.platform == 'win32') {
  //   return ports.filter((port) => {
  //     return port.manufacturer == 'wch.cn'
  //   })
  // } else if (os.platform == 'darwin') {
  //   return ports.filter((port) => {
  //     return port.path.includes('usb')
  //   })
  // } else {
  //   return ports
  // }
  return ports
}

let baudRate = 1000000

let serialport = { a: 1, b: 2 }
const timeNum = 1000 / 12;
let port2,
  port1,
  portHead,
  localFlag = false,
  playFlag = false,
  nowIndex = 0,
  interval = timeNum,
  timer,
  parserOpen,
  parser2Open,
  time;



let timeStamp,
  historyArr,
  newsit,
  newback,
  backAreaSelect = [],
  backPressSelect = [],
  sitAreaSelect = [],
  sitClose = false,
  backClose = false,
  sitPressSelect = [];
const sitnum1 = 64;
const sitnum2 = 64;
const backnum1 = 64;
const backnum2 = 64;
let smoothValue = 0;
let onbedArr = []; // jqbed 在床状态数组
let onBedTime = 0; // jqbed 在床/离床计时（秒）
let useMatrixOrigin = false; // jqbed 调试 flag：true 时用算法返回的 matrix_origin 作为 sitData
let jqbedMatrixOrigin = null; // 缓存算法返回的 matrix_origin 数据
let lastData = new Array(1024).fill(0),
  firstData = new Array(1024).fill(0);
const backTotal = backnum1 * backnum2;
const sitTotal = sitnum1 * sitnum2;
let length, history, nowGetTime;

let nowDate = 0
let endDate = 0

const https = require('https')
// 使用内置 http 模块替代已废弃的 request 包
const http = require('http');
http.get('http://sensor.bodyta.com:8080/rcv/login/getSystemTime', {
  headers: { 'content-type': 'application/json; charset=utf-8;' }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const body = JSON.parse(data);
      logger.debug(body.time, 'body');
      nowDate = parseInt(body.time);
    } catch (e) {
      logger.warn('Failed to parse system time response', e);
    }
  });
}).on('error', (err) => {
  logger.warn('Failed to get system time', err);
});

const runtimeResourceRoot = app.isPackaged ? process.resourcesPath : __dirname;
let filePath = path.join(runtimeResourceRoot, "db");
let csvPath = path.join(runtimeResourceRoot, "data");
let nameTxt = path.join(runtimeResourceRoot, "config.txt");

if (!fs.existsSync(filePath)) {
  fs.mkdirSync(filePath, { recursive: true });
}

if (!fs.existsSync(csvPath)) {
  fs.mkdirSync(csvPath, { recursive: true });
}

logger.info("[Path] resourceRoot=", runtimeResourceRoot);
logger.info("[Path] db=", filePath, "data=", csvPath, "config=", nameTxt);

// initDb 包装函数，自动传入 filePath 和 runtimeResourceRoot
function initDb(fileStr) {
  return _initDbFromModule(fileStr, filePath, runtimeResourceRoot);
}

function getHistorySeries({ sitRows = [], backRows = [], start = 0, end = null }) {
  const safeSitRows = Array.isArray(sitRows) ? sitRows : [];
  const safeBackRows = Array.isArray(backRows) ? backRows : [];
  const hasSit = safeSitRows.length > 0;
  const hasBack = safeBackRows.length > 0;
  const totalLength = hasSit && hasBack
    ? Math.min(safeSitRows.length, safeBackRows.length)
    : (hasSit ? safeSitRows.length : safeBackRows.length);
  const rangeStart = Math.max(0, start);
  const rangeEnd = Math.min(end == null ? totalLength : end, totalLength);
  const baseRows = hasSit ? safeSitRows : safeBackRows;
  const press = [];
  const area = [];
  const time = [];

  for (let i = rangeStart; i < rangeEnd; i++) {
    const sitData = hasSit && safeSitRows[i] ? JSON.parse(safeSitRows[i].data) : null;
    const backData = hasBack && safeBackRows[i] ? JSON.parse(safeBackRows[i].data) : null;
    const sitTotalValue = sitData ? sitData.reduce((a, b) => a + b, 0) : 0;
    const backTotalValue = backData ? backData.reduce((a, b) => a + b, 0) : 0;
    const sitAreaValue = sitData ? sitData.filter((a) => a > 10).length : 0;
    const backAreaValue = backData ? backData.filter((a) => a > 10).length : 0;

    press.push(
      (sitData ? totalToN(sitTotalValue) : 0) +
      (backData ? totalToN(backTotalValue, 1.3) : 0)
    );
    area.push(sitAreaValue + backAreaValue);

    if (baseRows[i] && baseRows[i].timestamp != null) {
      time.push(baseRows[i].timestamp);
    }
  }

  return {
    length: totalLength,
    press,
    area,
    time,
  };
}

function stopPlaybackTimer() {
  playFlag = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}



const defauleFile = 'hand0205'
let date, sysStartTime, file = defauleFile, selectFlag
if (fs.existsSync(nameTxt)) {
  try {
    const dateRes = fs.readFileSync(nameTxt, 'utf8');
    const parsedData = JSON.parse(module2.decryptStr(dateRes));
    endDate = parseFloat(parsedData.date);
    const rawFile = parsedData.file;
    selectFlag = rawFile; // ????????????????????? 'all'??????????????
    // ??? file ????????'all'????????????????????
    if (rawFile === 'all') {
      file = defauleFile;
    } else if (Array.isArray(rawFile)) {
      // ???????????????????????????????????
      file = rawFile[0] || defauleFile;
    } else {
      file = rawFile || defauleFile;
    }
    // 根据 file 类型设置波特率
    if (file == 'handGlove115200') {
      baudRate = 115200
    } else if (['hand0205', 'footVideo', 'eye', 'daliegu', 'smallSample'].includes(file) || file.includes('robot')) {
      baudRate = 921600
    } else if (['bed4096', 'bed4096num'].includes(file)) {
      baudRate = 3000000
    } else {
      baudRate = 1000000
    }
  } catch (err) {
    logger.error(err);
  }
} else {
  logger.info("[Config] config.txt not found, skip loading license at startup.");
}

// let db = new sqlite3.Database(`${filePath}/foot.db`);
// let db1 = new sqlite3.Database(`${filePath}/back.db`);
// let db2 = new sqlite3.Database(`${filePath}/volvohead.db`);
let sitTimeArr = [],
  backTimeArr = [];
let dataFalg = 0;

// const createCsvWriter = require("csv-writer").createObjectCsvWriter;

let saveTime,
  getTime,

  com,
  com1,
  comhead;
// db = new sqlite3.Database(`${filePath}/${file}.db`);

// try {
//   const dateRes = fs.readFileSync(nameTxt, 'utf8');

//   console.log(dateRes)
//   file = dateRes
//   // date = JSON.parse(module2.decryptStr(dateRes)).dateRes
//   // // endDate = JSON.parse(module2.decryptStr(dateRes)).dateRes
//   // sysStartTime = (`${JSON.parse(module2.decryptStr(dateRes)).startTimeRes}`)
//   // console.log(JSON.parse(module2.decryptStr(dateRes)).startTimeRes);
//   // endDate = parseFloat(module2.decryptStr(date))
// } catch (err) {
//   logger.error(err);
// }




const dbObj = initDb(file)
db = dbObj.db
db1 = dbObj.db1
db2 = dbObj.db2

let flag = false;
let colHZ = 12, oldTimeStamp = new Date().getTime();
let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
// let splitBuffer1 = Buffer.from([0xaa, 0x55, 0x03, 0x09]);
let parser2 = new DelimiterParser({ delimiter: splitBuffer });
let parser = new DelimiterParser({ delimiter: splitBuffer });
let parser3 = new DelimiterParser({ delimiter: splitBuffer });
let parser4 = new DelimiterParser({ delimiter: splitBuffer });
let server, server1, server2;
let localData = [],
  localDataBack = [],
  localDataHead = [],
  indexArr = [0, 0];
let up = 1245, down = 2
let pointArr1zero = []
let pointArr147zero = []
let pointArr147zero_2 = []
let pointArr2zero = []
let pointArr3zero = []
let pointArr4zero = []

let pointArr1zeroData = []
let pointArr2zeroData = []
let pointArr3zeroData = []
let pointArr4zeroData = [], newArr147 = [], newArr147_2 = [];

server = new WebSocket.Server({ port: 19999 });
server1 = new WebSocket.Server({ port: 19998 });
server2 = new WebSocket.Server({ port: 19997 });

module.exports = {
  openServer() {

    server1.on("open", function open() {
      logger.info("connected");
    });

    server1.on("close", function close() {
      logger.info("disconnected");
    });

    server1.on("connection", function connection(ws, req) {
      ws.on("message", function incoming(message) {
        logger.debug("received: %s from %s", message, clientName, localFlag);

        const getMessage = JSON.parse(message);

        /**
         * 灏嗗疄鏃堕潬鑳屾暟鎹€氶亾鎵撳紑
         */
        if (nowDate < endDate) {
          if (JSON.parse(message).backPort != null) {
            com1 = JSON.parse(message).backPort;
            try {
              port2 = new SerialPort(
                JSON.parse(message).backPort,
                {
                  baudRate: baudRate,
                  autoOpen: true,
                },
                function (err) {
                  logger.warn(err, "err");
                }
              );
              //绠￠亾娣诲姞瑙ｆ瀽鍣?
              port2.pipe(parser2);
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          if (JSON.parse(message).local === true) {
            // localFlag = true;
            // localData = []
            // localDataBack = []
            const jsonData = JSON.stringify({
              backData: new Array(backTotal).fill(0),
            });
            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
          }
          if (JSON.parse(message).local === false) {
            localFlag = false;
            stopPlaybackTimer();
            const jsonData = JSON.stringify({
              backData: new Array(backTotal).fill(0),

            });
            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
            if (com1) {
              try {
                port2 = new SerialPort(
                  com1,
                  {
                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    logger.warn(err, "err");
                  }
                );
                //绠￠亾娣诲姞瑙ｆ瀽鍣?
                // port2.pipe(parser2);
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }

          /**
           * 灏嗛潬鑳屾暟鎹€氶亾鍏抽棴
           */
          if (JSON.parse(message).backClose === true) {
            backClose = true
            if (port2?.isOpen) {

              port2.close();
            }
          }

          // if (JSON.parse(message).getTime != null) {
          //   getTime = JSON.parse(message).getTime;
          //   localFlag = true;
          //   const selectQuery = "select * from matrix WHERE date=?";
          //   const params = [getTime];

          //   db1.all(selectQuery, params, (err, rows) => {
          //     if (err) {
          //       logger.error(err);
          //     } else {
          //       localDataBack = rows;
          //     }
          //   });
          // }
        }
      });
    });

    server.on("open", function open() {
      logger.info("connected");
    });

    server.on("close", function close() {
      logger.info("disconnected");
    });

    server.on("connection", function connection(ws, req) {

      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = ip + port;
      logger.info("%s is connected", clientName);

      server.clients.forEach(function each(client) {
        /**
         * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
         *  */
        const jsonData = JSON.stringify({
          port: serialport,
          file,
          selectFlag: selectFlag
          // length: csvSitData.length,
          // sitData: csvSitData[0], backData: csvBackData[0]
        });

        if (client.readyState === WebSocket.OPEN) {
          client.send(jsonData);
        }
      });

      if (endDate) {
        server.clients.forEach(function each(client) {
          /**
           * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
           *  */
          const jsonData = JSON.stringify({
            date: endDate,
            file: file,
            selectFlag: selectFlag
            // length: csvSitData.length,
            // sitData: csvSitData[0], backData: csvBackData[0]
          });

          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }

      ws.on("message", function incoming(message) {


        const getMessage = JSON.parse(message);

        // if(getMessage.compen != null){
        //   compen = getMessage.compen
        // }

        if (getMessage.date != null) {
          const content = (getMessage.date.date)
          const date = content


          const dateRes = module2.decryptStr(date)

          // const file = module2.encStr(date).file
          // const startTimeRes = module2.encStr(`${getMessage.date.startTime}`)
          // const content = (JSON.stringify({ dateRes }))
          // const content1 = module2.encStr(content)

          fs.writeFile(nameTxt, date, err => {
            if (err) {
              logger.error(err);
            }
            // date = module2.decryptStr(content) 
            // file written successfully
          });
          // date = JSON.parse(content).dateRes


          // sysStartTime = getMessage.date.startTime

          // console.log(JSON.parse(content).dateRes)

          // endDate = parseFloat(module2.decryptStr(date))
          const parsedLicense = JSON.parse(dateRes);
          const rawFile = parsedLicense.file;
          selectFlag = rawFile; // 淇濈暀鍘熷鍊硷紙'all'銆佸瓧绗︿覆銆佹垨鏁扮粍锛夊彂閫佺粰鍓嶇

          // 瑙ｆ瀽 file 瀛楁锛氭敮鎸?'all'銆佸崟涓瓧绗︿覆銆佹暟缁勪笁绉嶆牸寮?
          if (rawFile === 'all') {
            file = defauleFile;
          } else if (Array.isArray(rawFile)) {
            file = rawFile[0] || defauleFile;
          } else {
            file = rawFile || defauleFile;
          }
          endDate = parseFloat(parsedLicense.date);

          // 根据 file 类型设置波特率
          if (file == 'handGlove115200') {
            baudRate = 115200
          } else if (['hand0205', 'footVideo', 'eye', 'daliegu', 'smallSample'].includes(file) || file.includes('robot')) {
            baudRate = 921600
          } else if (['bed4096', 'bed4096num'].includes(file)) {
            baudRate = 3000000
          } else {
            baudRate = 1000000
          }

          server.clients.forEach(function each(client) {
            /**
             * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
             *  */
            const jsonData = JSON.stringify({
              date: date,
              file,
              selectFlag: selectFlag
              // length: csvSitData.length,
              // sitData: csvSitData[0], backData: csvBackData[0]
            });
            if (client.readyState === WebSocket.OPEN) {
              client.send(jsonData);
            }
          });

        }



        // if(new Date().getTime() >= parseInt(sysStartTime) + parseInt(module2.decryptStr(date)) * 24 * 60 * 60 * 1000){
        //   server.clients.forEach(function each(client) {
        //     /**
        //      * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
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



          if (getMessage.history != null) {
            history = getMessage.history;
          }

          if (getMessage.up != null) {
            up = Number(getMessage.up);
          }

          if (getMessage.down != null) {
            down = Number(getMessage.down);
          }


          if (getMessage.history === false) {
            history = false;
            stopPlaybackTimer();
          }

          if (getMessage.variety != null) {
            if (indexArr) {
              if (localDataBack.length) {

                const startArr = JSON.parse(localDataBack[indexArr[0]].data);
                const endArr = JSON.parse(localDataBack[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  backData: newArr,
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
              if (localData.length) {

                const startArr = JSON.parse(localData[indexArr[0]].data);
                const endArr = JSON.parse(localData[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  sitData: newArr,
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
            }
          }

          // 缃浂
          if (getMessage.resetZero === true) {
            if (pointArr) pointArr1zero = [...pointArr1zeroData]
            if (pointArr2) pointArr2zero = [...pointArr2zeroData]
            if (pointArr3) pointArr3zero = [...pointArr3zeroData]
            if (pointArr4) pointArr4zero = [...pointArr4zeroData]
            if (newArr147) pointArr147zero = [...newArr147]
            if (newArr147_2) pointArr147zero_2 = [...newArr147_2]

          }

          if (getMessage.resetZero === false) {
            pointArr1zero = []
            pointArr2zero = []
            pointArr3zero = []
            pointArr4zero = []
            pointArr147zero = []
            pointArr147zero_2 = []
          }

          if (JSON.parse(message).file != null) {
            backClose = true
            sitClose = true
            if (port1?.isOpen) {
              port1.close();

              const jsonData = JSON.stringify({
                sitData:
                  file == "bigBed"
                    ? new Array(2048).fill(0)
                    : new Array(sitTotal).fill(0),
              });

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }
            if (port2?.isOpen) {
              port2.close();
              const jsonData = JSON.stringify({
                backData: new Array(backTotal).fill(0),
              });

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }

            if (portHead?.isOpen) {
              portHead.close();
              const jsonData = JSON.stringify({
                headData: new Array(100).fill(0),
              });

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }
            const receiveFile = JSON.parse(message).file
            // db = new sqlite3.Database(`${filePath}/${receiveFile}.db`);
            file = receiveFile;

            if (receiveFile == 'handGlove115200') {
              baudRate = 115200
            } else if (['hand0205', 'footVideo', 'eye', 'daliegu', 'smallSample'].includes(receiveFile) || receiveFile.includes('robot')) {
              baudRate = 921600
            } else if (['bed4096', 'bed4096num',].includes(receiveFile)) {
              baudRate = 3000000
            } else {
              baudRate = 1000000
            }

            const dbObj = initDb(file)
            db = dbObj.db
            db1 = dbObj.db1
            db2 = dbObj.db2

          }

          if (JSON.parse(message).baudRate != null) {
            baudRate = Number(JSON.parse(message).baudRate)
          }
          /**
           * 灏嗘湰鍦颁繚瀛樻暟鎹€氶亾鎵撳紑
           */
          if (JSON.parse(message).getTime != null) {
            getTime = JSON.parse(message).getTime;
            localFlag = true;
            const selectQuery = "select * from matrix WHERE date=?";

            const params = [getTime];

            nowGetTime = getTime;

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  db.all(selectQuery, params, (err, rows) => {
                    if (err) {
                      logger.error(err);
                    } else {
                      localData = rows;
                      const historySeries = getHistorySeries({
                        sitRows: localData,
                        backRows: localDataBack,
                      });
                      length = historySeries.length;
                      indexArr = [0, Math.max(length - 2, 0)];
                      timeStamp = historySeries.time;
                      historyArr = [0, length];
                      const press = historySeries.press;
                      const area = historySeries.area;

                      server.clients.forEach(function each(client) {
                        /**
                         * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                         *  */
                        const jsonData = JSON.stringify({
                          length: length,
                          time: timeStamp,
                          index: nowIndex,
                          pressArr: press,
                          areaArr: area,
                          // length: csvSitData.length,
                          sitData:
                            file === "bigBed"
                              ? new Array(2048).fill(0)
                              : new Array(1024).fill(0),
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });

                      // if (history) {
                      //   let press = [], area = []
                      //   if (localDataBack.length) {
                      //     for (let i = 0; i < length; i++) {
                      //       let a = JSON.parse(localData[i].data).reduce((a, b) => a + b, 0) + JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                      //       let b = JSON.parse(localData[i].data).filter((a) => a > 10).length + JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                      //       press.push(a)
                      //       area.push(b)
                      //     }

                      //     server.clients.forEach(function each(client) {
                      //       /**
                      //        * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                      //        *  */

                      //       const jsonData = JSON.stringify({
                      //         length: rows.length,
                      //         time: timeStamp,
                      //         index: nowIndex,
                      //         // length: csvSitData.length,
                      //         // sitData: csvSitData[0], backData: csvBackData[0]
                      //         pressArr: press,
                      //         areaArr: area
                      //       });
                      //       if (client.readyState === WebSocket.OPEN) {
                      //         client.send(jsonData);
                      //       }
                      //     });
                      //   }

                      // } else {
                      //   server.clients.forEach(function each(client) {
                      //     /**
                      //      * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                      //      *  */

                      //     const jsonData = JSON.stringify({
                      //       length: rows.length,
                      //       time: timeStamp,
                      //       index: nowIndex,

                      //     });
                      //     if (client.readyState === WebSocket.OPEN) {
                      //       client.send(jsonData);
                      //     }
                      //   });
                      // }
                    }
                  });
                } else {
                  // console.log(rows);
                  localDataBack = rows;
                  length = rows.length
                    ? Math.min(
                      rows.length,
                      localData.length ? localData.length : rows.length
                    )
                    : localData.length;
                  indexArr = [0, length - 2];
                  timeStamp = [];
                  for (let i = 0; i < rows.length; i++) {
                    timeStamp.push(rows[i].timestamp);
                  }
                  historyArr = [0, length];
                  let press = [],
                    area = [];
                  // if (localDataBack.length) {
                  //   for (let i = 0; i < length; i++) {

                  //     let a = localData.length
                  //       ? totalToN(JSON.parse(localData[i].data).reduce((a, b) => a + b, 0))
                  //       : 0 +
                  //       totalToN(JSON.parse(localDataBack[i].data).reduce(
                  //         (a, b) => a + b,
                  //         0
                  //       ), 1.3);
                  //     let b = localData.length
                  //       ? JSON.parse(localData[i].data).filter((a) => a > 10).length
                  //       : 0 +
                  //       JSON.parse(localDataBack[i].data).filter((a) => a > 10)
                  //         .length;
                  //     press.push(a);
                  //     area.push(b);
                  //   }



                  //   // server.clients.forEach(function each(client) {
                  //   //   /**
                  //   //    * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                  //   //    *  */

                  //   //   const jsonData = JSON.stringify({
                  //   //     pressArr: press,
                  //   //     areaArr: area,
                  //   //     length: length,
                  //   //     time: timeStamp,
                  //   //     index: nowIndex,
                  //   //     backData:
                  //   //       file === "car10"
                  //   //         ? new Array(100).fill(0)
                  //   //         : new Array(1024).fill(0),
                  //   //   });
                  //   //   if (client.readyState === WebSocket.OPEN) {
                  //   //     client.send(jsonData);
                  //   //   }
                  //   // });
                  // }

                  db.all(selectQuery, params, (err, rows) => {
                    if (err) {
                      logger.error(err);
                    } else {

                      if (file == 'volvo') {
                        db2.all(selectQuery, params, (err, rows) => {
                          if (err) {
                            logger.error(err);
                          } else {



                            localDataHead = rows;
                            length = rows.length
                              ? Math.min(
                                rows.length,
                                localDataBack.length ? localDataBack.length : rows.length
                              )
                              : localDataBack.length;
                            indexArr = [0, length - 2];
                            timeStamp = [];
                            for (let i = 0; i < rows.length; i++) {
                              timeStamp.push(rows[i].timestamp);
                            }
                            historyArr = [0, length];
                            let press = [],
                              area = [];


                            server.clients.forEach(function each(client) {
                              /**
                               * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                               *  */
                              const jsonData = JSON.stringify({
                                // length: length,
                                // time: timeStamp,
                                // index: nowIndex,
                                // pressArr: press,
                                // areaArr: area,
                                // length: csvSitData.length,
                                headData:
                                  file === "bigBed"
                                    ? new Array(2048).fill(0)
                                    : new Array(100).fill(0),
                              });
                              if (client.readyState === WebSocket.OPEN) {
                                client.send(jsonData);
                              }
                            });


                          }
                        });
                      }

                      localData = rows;
                      const historySeries = getHistorySeries({
                        sitRows: localData,
                        backRows: localDataBack,
                      });
                      length = historySeries.length;
                      indexArr = [0, Math.max(length - 2, 0)];
                      timeStamp = historySeries.time;
                      historyArr = [0, length];
                      const press = historySeries.press;
                      const area = historySeries.area;

                      server.clients.forEach(function each(client) {
                        /**
                         * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                         *  */
                        const jsonData = JSON.stringify({
                          length: length,
                          time: timeStamp,
                          index: nowIndex,
                          pressArr: press,
                          areaArr: area,
                          // length: csvSitData.length,
                          sitData:
                            file === "bigBed"
                              ? new Array(2048).fill(0)
                              : new Array(1024).fill(0),
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });

                      // if (history) {
                      //   let press = [], area = []
                      //   if (localDataBack.length) {
                      //     for (let i = 0; i < length; i++) {
                      //       let a = JSON.parse(localData[i].data).reduce((a, b) => a + b, 0) + JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                      //       let b = JSON.parse(localData[i].data).filter((a) => a > 10).length + JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                      //       press.push(a)
                      //       area.push(b)
                      //     }

                      //     server.clients.forEach(function each(client) {
                      //       /**
                      //        * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                      //        *  */

                      //       const jsonData = JSON.stringify({
                      //         length: rows.length,
                      //         time: timeStamp,
                      //         index: nowIndex,
                      //         // length: csvSitData.length,
                      //         // sitData: csvSitData[0], backData: csvBackData[0]
                      //         pressArr: press,
                      //         areaArr: area
                      //       });
                      //       if (client.readyState === WebSocket.OPEN) {
                      //         client.send(jsonData);
                      //       }
                      //     });
                      //   }

                      // } else {
                      //   server.clients.forEach(function each(client) {
                      //     /**
                      //      * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                      //      *  */

                      //     const jsonData = JSON.stringify({
                      //       length: rows.length,
                      //       time: timeStamp,
                      //       index: nowIndex,

                      //     });
                      //     if (client.readyState === WebSocket.OPEN) {
                      //       client.send(jsonData);
                      //     }
                      //   });
                      // }
                    }
                  });
                }
              });
            }

            if (!isCar(file)) {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  localData = rows;
                  const historySeries = getHistorySeries({
                    sitRows: localData,
                    backRows: localDataBack,
                  });
                  length = historySeries.length;
                  indexArr = [0, Math.max(length - 2, 0)];
                  timeStamp = historySeries.time;
                  historyArr = [0, length];
                  const press = historySeries.press;
                  const area = historySeries.area;

                  server.clients.forEach(function each(client) {
                    /**
                     * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                     *  */
                    const jsonData = JSON.stringify({
                      length: length,
                      time: timeStamp,
                      index: nowIndex,
                      pressArr: press,
                      areaArr: area,
                      // length: csvSitData.length,
                      sitData:
                        file === "bigBed"
                          ? new Array(2048).fill(0)
                          : new Array(1024).fill(0),
                    });
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });

                  // if (history) {
                  //   let press = [], area = []
                  //   if (localDataBack.length) {
                  //     for (let i = 0; i < length; i++) {
                  //       let a = JSON.parse(localData[i].data).reduce((a, b) => a + b, 0) + JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                  //       let b = JSON.parse(localData[i].data).filter((a) => a > 10).length + JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                  //       press.push(a)
                  //       area.push(b)
                  //     }

                  //     server.clients.forEach(function each(client) {
                  //       /**
                  //        * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                  //        *  */

                  //       const jsonData = JSON.stringify({
                  //         length: rows.length,
                  //         time: timeStamp,
                  //         index: nowIndex,
                  //         // length: csvSitData.length,
                  //         // sitData: csvSitData[0], backData: csvBackData[0]
                  //         pressArr: press,
                  //         areaArr: area
                  //       });
                  //       if (client.readyState === WebSocket.OPEN) {
                  //         client.send(jsonData);
                  //       }
                  //     });
                  //   }

                  // } else {
                  //   server.clients.forEach(function each(client) {
                  //     /**
                  //      * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                  //      *  */

                  //     const jsonData = JSON.stringify({
                  //       length: rows.length,
                  //       time: timeStamp,
                  //       index: nowIndex,

                  //     });
                  //     if (client.readyState === WebSocket.OPEN) {
                  //       client.send(jsonData);
                  //     }
                  //   });
                  // }
                }
              });
            }
          }

          if (JSON.parse(message).time != null) {
            saveTime = JSON.parse(message).time;
          }
          if (JSON.parse(message).colName != null) {
            saveTime = JSON.parse(message).colName;
          }

          if (JSON.parse(message).flag === true) {
            flag = true;
          } else if (JSON.parse(message).flag === false) {
            flag = false;
          }

          if (JSON.parse(message).colHZ != null) {
            colHZ = JSON.parse(message).colHZ;
          }

          /**
           * 灏嗗疄鏃跺骇妞呮暟鎹€氶亾鎵撳紑
           */
          if (JSON.parse(message).sitPort != null) {
            sitClose = false
            com = JSON.parse(message).sitPort;
            if (port1?.isOpen) {
              port1.close((e) => {
                logger.debug(e)
              });
            }
            if (com == com1) {
              if (port2?.isOpen) {
                port2.close((e) => {
                  logger.debug(e)
                });
              }
            }
            logger.debug(baudRate)
            if (file != "bigBed") {
              console.log(com);
              try {
                port1 = new SerialPort(
                  {
                    path: JSON.parse(message).sitPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    logger.warn(err, "err");
                  }
                );
                //绠￠亾娣诲姞瑙ｆ瀽鍣?
                // let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
                // parser = new Delimiter({ delimiter: splitBuffer });
                port1.pipe(parser);
              } catch (e) {
                logger.warn(e, "e");
              }
            } else {
              try {
                port1 = new SerialPort(
                  {
                    path: JSON.parse(message).sitPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    logger.warn(err, "err");
                  }
                );
                //绠￠亾娣诲姞瑙ｆ瀽鍣?
                port1.pipe(parser3);
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }


          if (JSON.parse(message).headPort != null) {
            headClose = false
            comhead = JSON.parse(message).headPort;
            if (portHead?.isOpen) {
              portHead.close((e) => {
                logger.debug(e)
              });
            }
            // if (com == com1) {
            //   if (port2?.isOpen) {
            //     port2.close((e) => {
            //       logger.debug(e)
            //     });
            //   }
            // }
            if (file != "bigBed") {
              // console.log(com);
              try {
                portHead = new SerialPort(
                  {
                    path: JSON.parse(message).headPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    console.log(err, baudRate, JSON.parse(message).headPort, "headerr");
                  }
                );
                //绠￠亾娣诲姞瑙ｆ瀽鍣?
                // let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
                // parser = new Delimiter({ delimiter: splitBuffer });
                portHead.pipe(parser4);
              } catch (e) {
                logger.warn(e, "e");
              }
            } else {
              try {
                portHead = new SerialPort(
                  {
                    path: JSON.parse(message).headPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    console.log(err, "headerr");
                  }
                );
                //绠￠亾娣诲姞瑙ｆ瀽鍣?
                portHead.pipe(parser4);
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }

          /**
           * 灏嗗疄鏃堕潬鑳屾暟鎹€氶亾鎵撳紑
           */
          if (JSON.parse(message).backPort != null) {
            backClose = false
            com1 = JSON.parse(message).backPort;
            if (port2?.isOpen) {
              port2.close((e) => {
                console.log(e, 'closeport2')
              });
            }
            if (com == com1) {
              if (port1?.isOpen) {
                port1.close((e) => {

                  console.log(e, 'closeport1')
                });
              }
            }
            try {
              port2 = new SerialPort(
                {
                  path: JSON.parse(message).backPort,

                  baudRate: baudRate,
                  autoOpen: true,
                },
                function (err) {
                  logger.warn(err, "err");
                }
              );
              //绠￠亾娣诲姞瑙ｆ瀽鍣?

              port2.pipe(parser2);
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          /**
           * 灏嗗骇妞呮暟鎹€氶亾鍏抽棴
           */
          if (JSON.parse(message).sitClose === true) {
            sitClose = true
            if (port1?.isOpen) {
              port1.close();
            }
          }

          /**
           * 灏嗛潬鑳屾暟鎹€氶亾鍏抽棴
           */
          if (JSON.parse(message).backClose === true) {
            backClose = true
            if (port2?.isOpen) {
              port2.close();
            }
          }

          if (JSON.parse(message).headClose === true) {
            headClose = true
            if (portHead?.isOpen) {

              portHead.close();
            }
          }
          /**
           * 灏嗚鍙栨湰鍦版暟鎹€氶亾鎵撳紑
           */
          if (JSON.parse(message).local === true) {
            localFlag = true;

            // 浼犻€掓椂闂存埑缁欏墠绔?
            const selectQuery =
              "select DISTINCT date from matrix ORDER BY timestamp DESC LIMIT ?,?";
            const params = [0, 500];

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  // console.log(rows);
                  let jsonData;

                  backTimeArr = rows;

                  // const timeArr = Array.from(new Set([...sitTimeArr, ...backTimeArr]))
                  // console.log(timeArr, 'timeArr')
                  const timeArr = dedupli(sitTimeArr, backTimeArr);
                  if (file == "car") {
                    const jsonData1 = JSON.stringify({
                      timeArr: timeArr,
                      backData: new Array(backTotal).fill(0),
                    });
                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData1);
                      }
                    });
                  }
                  if (file == "car10") {
                    const jsonData1 = JSON.stringify({
                      timeArr: rows,
                      backData: new Array(100).fill(0),
                    });
                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData1);
                      }
                    });
                  }

                  db.all(selectQuery, params, (err, rows) => {
                    if (err) {
                      logger.error(err);
                    } else {
                      console.log(rows);
                      let jsonData;
                      sitTimeArr = rows;
                      // const timeArr = Array.from(new Set([...sitTimeArr, ...backTimeArr]))
                      let timeArr = rows;

                      // if (file == "car10" || file == "car" || file == 'sit10') 
                      timeArr = dedupli(sitTimeArr, backTimeArr);



                      if (file === "bigBed") {
                        jsonData = JSON.stringify({
                          timeArr: rows,
                          index: nowIndex,
                          sitData: new Array(2048).fill(0),
                        });
                      } else {
                        jsonData = JSON.stringify({
                          timeArr: timeArr,
                          index: nowIndex,
                          sitData: new Array(sitTotal).fill(0),
                        });
                      }

                      server.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });

                      // if (file == "car") {
                      const jsonData1 = JSON.stringify({
                        backData: new Array(backTotal).fill(0),
                      });
                      server.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData1);
                        }
                      });
                      // }

                      if (file == "volvo") {
                        const jsonData1 = JSON.stringify({
                          headData: new Array(100).fill(0),
                        });
                        server.clients.forEach(function each(client) {
                          if (client.readyState === WebSocket.OPEN) {
                            client.send(jsonData1);
                          }
                        });
                      }
                    }
                  });
                }
              });
            } else {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  console.log(rows);
                  let jsonData;
                  sitTimeArr = rows;
                  // const timeArr = Array.from(new Set([...sitTimeArr, ...backTimeArr]))
                  let timeArr = rows;

                  // if (file == "car10" || file == "car" || file == 'sit10') 
                  timeArr = dedupli(sitTimeArr, backTimeArr);



                  if (file === "bigBed") {
                    jsonData = JSON.stringify({
                      timeArr: rows,
                      index: nowIndex,
                      sitData: new Array(2048).fill(0),
                    });
                  } else {
                    jsonData = JSON.stringify({
                      timeArr: timeArr,
                      index: nowIndex,
                      sitData: new Array(sitTotal).fill(0),
                    });
                  }

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });

                  if (file == "car") {
                    const jsonData1 = JSON.stringify({
                      backData: new Array(backTotal).fill(0),
                    });
                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData1);
                      }
                    });
                  }
                }
              });
            }


          }
          if (JSON.parse(message).local === false) {
            localFlag = false;
            let jsonData;
            if (file === "bigBed") {
              jsonData = JSON.stringify({
                sitData: new Array(2048).fill(0),
                // backData: new Array(1024).fill(0)
              });
            } else {
              jsonData = JSON.stringify({
                sitData: new Array(sitTotal).fill(0),
                // backData: new Array(1024).fill(0)
              });
            }

            if (isCar(file)) {
              let jsonData1 = JSON.stringify({
                backData: new Array(sitTotal).fill(0),
                // backData: new Array(1024).fill(0)
              });
              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData1);
                }
              });

              if (file == 'volvo') {
                let jsonData2 = JSON.stringify({
                  headData: new Array(sitTotal).fill(0),
                  // backData: new Array(1024).fill(0)
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData2);
                  }
                });
              }
            }

            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });

            // if (com) {
            //   try {
            //     port1 = new SerialPort(
            //       com,
            //       {
            //         baudRate: baudRate,
            //         autoOpen: true,
            //       },
            //       function (err) {
            //         logger.warn(err, "err");
            //       }
            //     );
            //     //绠￠亾娣诲姞瑙ｆ瀽鍣?
            //     // port1.pipe(parser);
            //   } catch (e) {
            //     logger.warn(e, "e");
            //   }
            // }

            // if (com1) {
            //   try {
            //     port2 = new SerialPort(
            //       com1,
            //       {
            //         baudRate: baudRate,
            //         autoOpen: true,
            //       },
            //       function (err) {
            //         logger.warn(err, "err");
            //       }
            //     );
            //     //绠￠亾娣诲姞瑙ｆ瀽鍣?
            //     // port2.pipe(parser2);
            //   } catch (e) {
            //     logger.warn(e, "e");
            //   }
            // }
          }
          if (localFlag) {
            if (JSON.parse(message).value != null) {
              const value = JSON.parse(message).value;
              console.log(
                "received: %s from %s",
                JSON.stringify(message),
                clientName
              );
              nowIndex = Number(value);
              let jsonData, jsonData1;
              if (isCar(file)) {


                const sitObj = {
                  sitData: localData[value]?.data,
                  time: localData[value]?.timestamp,
                  backFlag: localDataBack.length > 0,
                }

                const backObj = {
                  // sitData: localData[value]?.data,
                  backData: localDataBack[value]?.data,
                  time: localDataBack[value]?.timestamp,
                  sitFlag: localData.length > 0,
                }

                if (['hand0205', 'handGlove115200', 'robot1'].includes(file)) {
                  // 兼容新旧数据格式：新版260(256+4)，旧版151(147+4)
                  const sitRaw = JSON.parse(localData[value]?.data || '[]')
                  const backRaw = JSON.parse(localDataBack[value]?.data || '[]')
                  if (sitRaw.length >= 260) {
                    // 新版：前256是原始数据，后4是四元数
                    const sitPressure = sitRaw.slice(0, 256)
                    const sitRotate = sitRaw.slice(256, 260)
                    sitObj.sitData = sitPressure
                    sitObj.newArr147 = handL([...sitPressure])
                    sitObj.rotate = sitRotate
                  } else {
                    // 旧版：前147是newArr147，后4是四元数
                    sitObj.newArr147 = sitRaw.slice(0, sitRaw.length - 4)
                    sitObj.rotate = sitRaw.slice(sitRaw.length - 4)
                  }
                  if (backRaw.length >= 260) {
                    const backPressure = backRaw.slice(0, 256)
                    const backRotate = backRaw.slice(256, 260)
                    backObj.backData = backPressure
                    backObj.newArr147 = handR([...backPressure])
                    backObj.rotate = backRotate
                  } else {
                    backObj.newArr147 = backRaw.slice(0, backRaw.length - 4)
                    backObj.rotate = backRaw.slice(backRaw.length - 4)
                  }
                }

                if (file == 'footVideo') {
                  sitObj.newArr147 = footArrToNormal(localData[nowIndex]?.data || [])
                  backObj.newArr147 = footArrToNormal(localDataBack[nowIndex]?.data || [])
                }

                jsonData = JSON.stringify(sitObj);
                jsonData1 = JSON.stringify(backObj);

                if (file == 'volvo') {
                  let jsonData2 = JSON.stringify({
                    // sitData: localData[value]?.data,
                    headData: localDataHead[value]?.data,
                    time: localDataHead[value]?.timestamp,
                    sitFlag: localData.length > 0,
                  });

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData2);
                    }
                  });
                }

              } else {
                if (file === 'smallBed') {
                  // console.log(JSON.stringify(pressSmallBed({ arr: JSON.parse(localData[value]?.data) })))
                  jsonData = JSON.stringify({
                    // sitData: pressSmallBed({ arr: JSON.parse(localData[value]?.data) }),
                    sitData: localData[value]?.data,
                    time: localData[value]?.timestamp,
                  });
                } else {
                  jsonData = JSON.stringify({
                    sitData: localData[value]?.data,
                    time: localData[value]?.timestamp,
                  });
                }
              }

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
              if (isCar(file)) {
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData1);
                  }
                });
              }
            }
          }
          if (JSON.parse(message).speed != null) {
            const speed = JSON.parse(message).speed;
            interval = parseInt(timeNum / speed);

            if (playFlag) {
              if (timer) {
                clearInterval(timer);
              }
              timer = setInterval(() => {
                nowIndex++;
                // console.log(interval)
                // console.log(localData,nowIndex)
                let jsonData
                if (file === 'smallBed') {
                  jsonData = JSON.stringify({
                    // sitData: pressSmallBed({ arr: JSON.parse(localData[nowIndex]?.data) }),
                    sitData: localData[nowIndex]?.data,
                    // backData: localDataBack[nowIndex]?.data,
                    time: localData[nowIndex]?.timestamp,
                    index: nowIndex,
                  });
                } else {
                  jsonData = JSON.stringify({
                    sitData: localData[nowIndex]?.data,
                    // backData: localDataBack[nowIndex]?.data,
                    time: localData[nowIndex]?.timestamp,
                    index: nowIndex,
                  });
                }


                const jsonData1 = JSON.stringify({
                  // sitData: new Array(sitTotal).fill(0),
                  backData: localDataBack[nowIndex]?.data,
                  index: nowIndex,
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData1);
                  }
                });

                if (file == 'volvo') {
                  let jsonData2 = JSON.stringify({
                    // sitData: localData[value]?.data,
                    headData: localDataHead[nowIndex]?.data,
                    time: localDataHead[nowIndex]?.timestamp,
                    sitFlag: localData.length > 0,
                  });

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData2);
                    }
                  });
                }

                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }, interval);
            } else {
              console.log("clear");
              stopPlaybackTimer();
            }
          }
          if (getMessage.play != null) {
            playFlag = getMessage.play;
            if (playFlag) {
              if (timer) {
                clearInterval(timer);
              }
              timer = setInterval(() => {
                if (nowIndex <= indexArr[1]) {
                  nowIndex++;

                  let jsonData

                  const sitObj = {
                    sitData: localData[nowIndex]?.data,
                    // backData: localDataBack[nowIndex]?.data,
                    time: localData[nowIndex]?.timestamp,
                    index: nowIndex,
                    backFlag: localDataBack.length > 0,
                  }

                  const backObj = {
                    // sitData: new Array(sitTotal).fill(0),
                    index: nowIndex,
                    backData: localDataBack[nowIndex]?.data,
                    sitFlag: localData.length > 0,
                  }

                  if (['hand0205', 'handGlove115200', 'robot1'].includes(file)) {
                    // 兼容新旧数据格式：新版260(256+4)，旧版151(147+4)
                    const sitRaw = JSON.parse(localData[nowIndex]?.data || '[]')
                    const backRaw = JSON.parse(localDataBack[nowIndex]?.data || '[]')
                    if (sitRaw.length >= 260) {
                      const sitPressure = sitRaw.slice(0, 256)
                      const sitRotate = sitRaw.slice(256, 260)
                      sitObj.sitData = sitPressure
                      sitObj.newArr147 = handL([...sitPressure])
                      sitObj.rotate = sitRotate
                    } else {
                      sitObj.newArr147 = sitRaw.slice(0, sitRaw.length - 4)
                      sitObj.rotate = sitRaw.slice(sitRaw.length - 4)
                    }
                    if (backRaw.length >= 260) {
                      const backPressure = backRaw.slice(0, 256)
                      const backRotate = backRaw.slice(256, 260)
                      backObj.backData = backPressure
                      backObj.newArr147 = handR([...backPressure])
                      backObj.rotate = backRotate
                    } else {
                      backObj.newArr147 = backRaw.slice(0, backRaw.length - 4)
                      backObj.rotate = backRaw.slice(backRaw.length - 4)
                    }
                  }

                  if (file == 'footVideo') {
                    sitObj.newArr147 = footArrToNormal(localData[nowIndex]?.data || [])
                    backObj.newArr147 = footArrToNormal(localDataBack[nowIndex]?.data || [])

                  }

                  if (file === 'smallBed') {
                    jsonData = JSON.stringify({
                      // sitData: pressSmallBed({ arr: JSON.parse(localData[nowIndex]?.data) }),
                      sitData: localData[nowIndex]?.data,
                      // backData: localDataBack[nowIndex]?.data,
                      time: localData[nowIndex]?.timestamp,
                      index: nowIndex,
                      backFlag: localDataBack.length > 0,
                    });
                  } else {

                    jsonData = JSON.stringify(sitObj);

                  }


                  const jsonData1 = JSON.stringify(backObj);

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData1);
                    }
                  });

                  if (file == 'volvo') {
                    let jsonData2 = JSON.stringify({
                      // sitData: localData[value]?.data,
                      headData: localDataHead[nowIndex]?.data,
                      index: nowIndex,
                      sitFlag: localData.length > 0,
                    });

                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData2);
                      }
                    });
                  }

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });
                } else {
                  stopPlaybackTimer();
                }
              }, interval);
            } else {
              stopPlaybackTimer();
            }
          }

          if (getMessage.index != null) {
            nowIndex = getMessage.index;
          }

          // 浜ゆ崲涓插彛
          if (getMessage.exchange != null) {
            [com, com1] = [com1, com];
            // port1.close();
            // port2.close();
            if (port1?.isOpen) {
              port1.close();
            }
            if (port2?.isOpen) {
              port2.close();
            }

            setTimeout(() => {
              if (com) {
                try {
                  port1 = new SerialPort(
                    {
                      path: com,

                      baudRate: baudRate,
                      autoOpen: true,
                    },
                    function (err) {
                      logger.warn(err, "err");
                    }
                  );
                  //绠￠亾娣诲姞瑙ｆ瀽鍣?
                  port1.pipe(parser);
                } catch (e) {
                  logger.warn(e, "e");
                }
              }

              if (com1) {
                try {
                  port2 = new SerialPort(
                    {
                      path: com1,

                      baudRate: baudRate,
                      autoOpen: true,
                    },
                    function (err) {
                      logger.warn(err, "err");
                    }
                  );
                  //绠￠亾娣诲姞瑙ｆ瀽鍣?
                  port2.pipe(parser2);
                } catch (e) {
                  logger.warn(e, "e");
                }
              }
            }, 1000);
          }

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


              server.clients.forEach(function each(client) {
                /**
                 * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                 *  */

                const jsonData = JSON.stringify({
                  pressArr: backPressSelect,
                  areaArr: backAreaSelect,
                  length: length,
                  time: timeStamp,
                  index: nowIndex,
                  // backData: file === 'car10' ? new Array(100).fill(0) : new Array(1024).fill(0),
                });
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
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
              if (file === 'smallBed') {
                for (let x = sitArr[0]; x < sitArr[1]; x++) {
                  for (let y = sitArr[2]; y < sitArr[3]; y++) {
                    newsit.push(JSON.parse(localData[i].data)[x * 32 + y]);
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
              sitPressSelect.push(totalToN(a));
              sitAreaSelect.push(b);
            }

            server.clients.forEach(function each(client) {
              /**
               * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
               *  */
              const jsonData = JSON.stringify({
                length: length,
                time: timeStamp,
                index: nowIndex,
                pressArr: sitPressSelect,
                areaArr: sitAreaSelect,
                // length: csvSitData.length,
                // sitData: file === 'bigBed' ? new Array(2048).fill(0) : new Array(1024).fill(0),
              });
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
          }

          // 涓嬭浇csv
          if (getMessage.download) {
            smoothValue = 0;
            const csvWriteData = [];
            const csvWriteBackData = [];
            //鏌ヨ璇彞
            // const selectQuery = 'select * from matrix WHERE timestamp>? and timestamp<? and date=?';
            const selectQuery = "select * from matrix WHERE date=?";
            // const params = [1287154796066,1887154796066,'2023-06-19-14:05'];
            const params = [getMessage.download];

            if (file === "bigBed") {
              let startPressure = 0;
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //鎶婃椂闂?鍘嬪姏闈㈢Н 骞冲潎鍘嬪姏鏁版嵁push杩沜svWriter杩涜姹囨€?
                  for (var i = historyArr[0]; i < historyArr[1]; i++) {
                    // const press = JSON.parse(rows[i][`data`]).reduce(
                    //   (a, b) => a + b,
                    //   0
                    // );
                    wsPointData = JSON.parse(rows[i][`data`]).map((a) =>
                      a < 10 ? 0 : a
                    );
                    const pressValue =
                      wsPointData.reduce((a, b) => a + b, 0) /
                      wsPointData.filter((a) => a > 0).length;
                    const realArr = wsPointData; // press([...wsPointData], 1500);

                    const bodyArr = [];
                    for (let i = 0; i < 64; i++) {
                      let num = 0;
                      for (let j = 0; j < 32; j++) {
                        num += realArr[j * 64 + i];
                      }
                      smoothValue = smoothValue + (num / 32 - smoothValue) / 3;
                      bodyArr.push(smoothValue.toFixed(2));
                    }

                    // const pressure =
                    //   realArr.reduce((a, b) => a + b, 0) /
                    //   realArr.filter((a) => a > 0).length;
                    const total = realArr.reduce((a, b) => a + b, 0);
                    let length = realArr.filter((a) => a > 0).length;
                    length = length ? length : 1;
                    let pressure = calculatePressure(total / length);
                    const newPressure = total / length;
                    const change = objChange(newPressure, startPressure, 4);
                    if (change) {
                      startPressure = newPressure;
                      time = 0;
                    } else {
                      time++;
                      pressure = calculatePressure(
                        calPress(startPressure, newPressure, time)
                      );
                      if (time > 240 * 13) {
                        time = 240 * 13;
                      }
                    }

                    // const pressuremmgH = calculatePressure(pressure);

                    const area = JSON.parse(rows[i][`data`]).filter(
                      (a) => a > 0
                    ).length;
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: area, //鍘熷鐭╅樀
                      pressure: total / length,
                      realData: realArr,
                      pressValue: wsPointData.reduce((a, b) => a + b, 0),
                      pressuremmgH: pressure,
                      pressLine: bodyArr,
                    };
                    csvWriteData.push(newData);
                  }
                  // 灏嗘眹鎬荤殑鍘嬪姏鏁版嵁鍐欏叆 CSV 鏂囦欢
                  // const timeStamp = Date.now()
                  const str = nowGetTime.replace(/[/:]/g, "-");
                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/${file}${str}.csv`, // 鎸囧畾杈撳嚭鏂囦欢鐨勮矾寰勫拰鍚嶇О
                    header: [
                      { id: "time", title: "time" },
                      { id: "pressureArea", title: "area" },
                      { id: "pressValue", title: "pressTotal" },
                      { id: "pressure", title: "press" },
                      { id: "pressuremmgH", title: "pressure" },
                      { id: "realData", title: "data" },
                      { id: "pressLine", title: "pressLine" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv success",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv failed",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });
            } else if (file === 'smallBed' || file === 'smallBed1') {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //鎶婃椂闂?鍘嬪姏闈㈢Н 骞冲潎鍘嬪姏鏁版嵁push杩沜svWriter杩涜姹囨€?

                  if (!rows.length) return;
                  for (var i = historyArr[0], j = 0; i < historyArr[1]; i++, j++) {
                    let sitData = JSON.parse(rows[i][`data`]);
                    let realData = JSON.parse(rows[i][`data`]);
                    // sitData = zeroLine(sitData,32,32)
                    // sitData = pressSmallBed({ arr: sitData })

                    const interpArr = interpSmall(sitData, 32, 32, 1, 2)
                    const dataToInterpGauss = gaussBlur_2(interpArr, 32, 64, 1)

                    const press = sitPressSelect.length
                      ? sitPressSelect[i]
                      : sitData.reduce((a, b) => a + b, 0);
                    // wsPointData = JSON.parse(rows[i][`data`]).map((a) => a < 10 ? 0 : a)
                    // const realArr = press(wsPointData,1500)
                    // const pressure = realArr.reduce((a,b) => a+b , 0) / realArr.filter((a) => a> 0).length
                    const pressuremmgH = calculatePressure(press / realData.filter((a) => a > 0).length)

                    const area = sitAreaSelect.length
                      ? sitAreaSelect[i]
                      : sitData.filter((a) => a > 10).length;

                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: sitAreaSelect.length
                        ? sitAreaSelect[i]
                        : area * 2.1, //鍘熷鐭╅樀
                      pressure: sitPressSelect.length
                        ? sitPressSelect[i]
                        : totalToN(press),
                      realData: sitData,//rows[i][`data`],
                      realInitData: rows[i][`data`],
                      index: (j / 12).toFixed(2),
                      dataToInterpGauss,
                      pressuremmgH: pressuremmgH
                    };
                    csvWriteData.push(newData);
                  }
                  // 灏嗘眹鎬荤殑鍘嬪姏鏁版嵁鍐欏叆 CSV 鏂囦欢
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime; //.replace(/[/:]/g, "-");
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/${file}${str}.csv`, // 鎸囧畾杈撳嚭鏂囦欢鐨勮矾寰勫拰鍚嶇О
                    header: [
                      { id: "index", title: "" },
                      { id: "time", title: "time" },
                      { id: "pressureArea", title: "area" },
                      { id: "pressure", title: "press" },
                      { id: "realInitData", title: "realInitData" },
                      { id: "pressuremmgH", title: "鍘嬪己澶у皬(mmgH)" },
                      { id: "realData", title: "data" },
                      { id: "dataToInterpGauss", title: "algorData" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv success",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv failed",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });
            } else if (file === 'sitCol') {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //鎶婃椂闂?鍘嬪姏闈㈢Н 骞冲潎鍘嬪姏鏁版嵁push杩沜svWriter杩涜姹囨€?
                  const label = getMessage.download.split('_')[1]
                  if (!rows.length) return;
                  for (var i = 0, j = 0; i < rows.length; i++, j++) {
                    const newData = {
                      realData: rows[i][`data`],
                      label: label
                    };
                    csvWriteData.push(newData);
                  }
                  // 灏嗘眹鎬荤殑鍘嬪姏鏁版嵁鍐欏叆 CSV 鏂囦欢
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  // let str = nowGetTime; //.replace(/[/:]/g, "-");
                  let str = getMessage.download
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/${file}${str}.csv`, // 鎸囧畾杈撳嚭鏂囦欢鐨勮矾寰勫拰鍚嶇О
                    header: [
                      { id: "realData", title: "data" },
                      { id: "label", title: "label" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv success",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv failed",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });
            } else if (file === 'matCol') {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //鎶婃椂闂?鍘嬪姏闈㈢Н 骞冲潎鍘嬪姏鏁版嵁push杩沜svWriter杩涜姹囨€?
                  const label = getMessage.download.split('_')[1]
                  if (!rows.length) return;
                  for (var i = 0, j = 0; i < rows.length; i++, j++) {
                    const newData = {
                      realData: rows[i][`data`],
                      label: label
                    };
                    csvWriteData.push(newData);
                  }
                  // 灏嗘眹鎬荤殑鍘嬪姏鏁版嵁鍐欏叆 CSV 鏂囦欢
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  // let str = nowGetTime; //.replace(/[/:]/g, "-");
                  let str = getMessage.download
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/${file}${str}.csv`, // 鎸囧畾杈撳嚭鏂囦欢鐨勮矾寰勫拰鍚嶇О
                    header: [
                      { id: "realData", title: "data" },
                      { id: "label", title: "label" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv success",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv failed",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });
            } else if (file !== "car10") {
              // 判断是否是触觉手套类型，需要分离原始256数据和四元数
              const isHandType = ['hand0205', 'handGlove115200'].includes(file);
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  if (!rows.length) return;
                  console.log(historyArr)
                  for (var i = historyArr[0], j = 0; i < historyArr[1] - 1; i++, j++) {
                    const rawData = JSON.parse(rows[i][`data`]);
                    let pressureData, rotateData;
                    if (isHandType) {
                      // 兼容新旧数据格式
                      if (rawData.length >= 260) {
                        // 新版：前256是原始压力数据，后4是四元数
                        pressureData = rawData.slice(0, 256);
                        rotateData = rawData.slice(256, 260);
                      } else {
                        // 旧版：前147是newArr147，后4是四元数
                        pressureData = rawData.slice(0, rawData.length - 4);
                        rotateData = rawData.slice(rawData.length - 4);
                      }
                    } else {
                      pressureData = rawData;
                      rotateData = [];
                    }
                    console.log(pressureData.length)
                    const press = sitPressSelect.length
                      ? sitPressSelect[i]
                      : pressureData.reduce((a, b) => a + b, 0);

                    const area = sitAreaSelect.length
                      ? sitAreaSelect[i]
                      : pressureData.filter((a) => a > 0).length;

                    const max = findMax(pressureData)
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: sitAreaSelect.length
                        ? sitAreaSelect[i]
                        : area,
                      pressure: sitPressSelect.length
                        ? sitPressSelect[i]
                        : totalToN(press),
                      realData: JSON.stringify(pressureData),
                      index: (j / 12).toFixed(2),
                      max,
                      rotate: rotateData.length ? JSON.stringify(rotateData) : '',
                    };
                    csvWriteData.push(newData);
                  }

                  let str = nowGetTime;
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvHeaders = [
                    { id: "index", title: "" },
                    { id: "max", title: "max" },
                    { id: "time", title: "time" },
                    { id: "pressureArea", title: "area" },
                    { id: "pressure", title: "press" },
                    { id: "realData", title: "data" },
                  ];
                  if (isHandType) {
                    csvHeaders.push({ id: "rotate", title: "quaternion" });
                  }

                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/sit${str}.csv`,
                    header: csvHeaders,
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv success",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv failed",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });
            }

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  // console.log(rows)
                  //鎶婃椂闂?鍘嬪姏闈㈢Н 骞冲潎鍘嬪姏鏁版嵁push杩沜svWriter杩涜姹囨€?
                  if (!rows.length) return;

                  // if()

                  for (var i = historyArr[0], j = 0; i < historyArr[1]; i++, j++) {
                    const backData = JSON.parse(rows[i][`data`]);
                    // const press = calPressArr(backData , backIndex , 32)
                    const press = backPressSelect.length
                      ? backPressSelect[i]
                      : backData.reduce((a, b) => a + b, 0);
                    const area = backAreaSelect.length
                      ? backAreaSelect[i]
                      : backData.filter((a) => a > 10).length;
                    // const newData = {
                    //   time: timeStampToDate(rows[i][`timestamp`]),
                    //   pressureArea: backAreaSelect.length
                    //     ? backAreaSelect[i]
                    //     : area * 2.1, //鍘熷鐭╅樀
                    //   pressure: backPressSelect.length
                    //     ? backPressSelect[i]
                    //     : pressToN(area, press),
                    //   realData: rows[i][`data`],
                    // };
                    const max = findMax(backData);
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: backAreaSelect.length
                        ? backAreaSelect[i]
                        : area, //鍘熷鐭╅樀
                      pressure: backPressSelect.length
                        ? backPressSelect[i]
                        : totalToN(press, 1.3),
                      realData: rows[i][`data`],
                      index: (j / 12).toFixed(2),
                      area1: [...backData].filter(a => a > 1).length,
                      area10: [...backData].filter(a => a > 10).length,
                      total1: backData.reduce((a, b) => a + b, 0),
                      total10: [...backData].filter(a => a > 10).reduce((a, b) => a + b, 0),
                      total10area10: [...backData].filter(a => a > 10).reduce((a, b) => a + b, 0) / [...backData].filter(a => a > 10).length,
                      total1area1: backData.reduce((a, b) => a + b, 0) / [...backData].filter(a => a > 1).length,
                      max
                    };
                    csvWriteBackData.push(newData);
                  }
                  // 灏嗘眹鎬荤殑鍘嬪姏鏁版嵁鍐欏叆 CSV 鏂囦欢

                  // let str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime;
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter1 = createCsvWriter({
                    path: `${csvPath}/back${str}.csv`,
                    // path: `./data/back${str}.csv`, // 鎸囧畾杈撳嚭鏂囦欢鐨勮矾寰勫拰鍚嶇О
                    header: [
                      { id: "index", title: "" },
                      { id: "time", title: "time" },
                      { id: "max", title: "max" },
                      { id: "pressureArea", title: "area" },
                      { id: "pressure", title: "press" },
                      { id: "realData", title: "data" },
                    ],
                  });

                  csvWriter1
                    .writeRecords(csvWriteBackData)
                    .then(() => {
                      console.log("export csv success");
                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv success",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "export csv failed",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });

              if (file == 'volvo') {
                db2.all(selectQuery, params, (err, rows) => {
                  if (err) {
                    logger.error(err);
                  } else {
                    // console.log(rows)
                    //鎶婃椂闂?鍘嬪姏闈㈢Н 骞冲潎鍘嬪姏鏁版嵁push杩沜svWriter杩涜姹囨€?
                    if (!rows.length) return;

                    // if()

                    for (var i = historyArr[0], j = 0; i < historyArr[1]; i++, j++) {
                      const backData = JSON.parse(rows[i][`data`]);
                      // const press = calPressArr(backData , backIndex , 32)
                      const press = backPressSelect.length
                        ? backPressSelect[i]
                        : backData.reduce((a, b) => a + b, 0);
                      const area = backAreaSelect.length
                        ? backAreaSelect[i]
                        : backData.filter((a) => a > 10).length;
                      // const newData = {
                      //   time: timeStampToDate(rows[i][`timestamp`]),
                      //   pressureArea: backAreaSelect.length
                      //     ? backAreaSelect[i]
                      //     : area * 2.1, //鍘熷鐭╅樀
                      //   pressure: backPressSelect.length
                      //     ? backPressSelect[i]
                      //     : pressToN(area, press),
                      //   realData: rows[i][`data`],
                      // };
                      const max = findMax(backData);
                      const newData = {
                        time: timeStampToDate(rows[i][`timestamp`]),
                        pressureArea: backAreaSelect.length
                          ? backAreaSelect[i]
                          : area, //鍘熷鐭╅樀
                        pressure: backPressSelect.length
                          ? backPressSelect[i]
                          : totalToN(press, 1.3),
                        realData: rows[i][`data`],
                        index: (j / 12).toFixed(2),
                        area1: [...backData].filter(a => a > 1).length,
                        area10: [...backData].filter(a => a > 10).length,
                        total1: backData.reduce((a, b) => a + b, 0),
                        total10: [...backData].filter(a => a > 10).reduce((a, b) => a + b, 0),
                        total10area10: [...backData].filter(a => a > 10).reduce((a, b) => a + b, 0) / [...backData].filter(a => a > 10).length,
                        total1area1: backData.reduce((a, b) => a + b, 0) / [...backData].filter(a => a > 1).length,
                        max
                      };
                      csvWriteBackData.push(newData);
                    }
                    // 灏嗘眹鎬荤殑鍘嬪姏鏁版嵁鍐欏叆 CSV 鏂囦欢

                    // let str = nowGetTime.replace(/[/:]/g, "-");
                    let str = nowGetTime;
                    if (str.includes(" ")) {
                      str = str.split(" ")[0];
                    } else {
                      str = timeStampTo_Date(Number(str));
                    }

                    const csvWriter1 = createCsvWriter({
                      path: `${csvPath}/head${str}.csv`,
                      // path: `./data/back${str}.csv`, // 鎸囧畾杈撳嚭鏂囦欢鐨勮矾寰勫拰鍚嶇О
                      header: [
                        { id: "index", title: "" },
                        { id: "time", title: "time" },
                        { id: "max", title: "max" },
                        { id: "pressureArea", title: "area" },
                        { id: "pressure", title: "press" },
                        { id: "realData", title: "data" },

                      ],
                    });

                    csvWriter1
                      .writeRecords(csvWriteBackData)
                      .then(() => {
                        console.log("export csv success");
                        server.clients.forEach(function each(client) {
                          const jsonData = JSON.stringify({
                            download: "export csv success",
                          });
                          if (client.readyState === WebSocket.OPEN) {
                            client.send(jsonData);
                          }
                        });
                      })
                      .catch((err) => {
                        console.error("export csv failed", err);
                        server.clients.forEach(function each(client) {
                          const jsonData = JSON.stringify({
                            download: "export csv failed",
                          });
                          if (client.readyState === WebSocket.OPEN) {
                            client.send(jsonData);
                          }
                        });
                      });
                  }
                });
              }
            }
          }

          if (getMessage.delete) {
            const createTableQuery = `delete from matrix  where date='${getMessage.delete}'`;

            db.run(createTableQuery, function (err) {
              if (err) {
                logger.error(err);
                return;
              } else {
                server.clients.forEach(function each(client) {
                  const jsonData = JSON.stringify({
                    download: "鍒犻櫎鎴愬姛",
                  });
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
            });

            if (file === "car") {
              db1.run(createTableQuery, function (err) {
                if (err) {
                  logger.error(err);
                  return;
                } else {
                  server.clients.forEach(function each(client) {
                    const jsonData = JSON.stringify({
                      download: "鍒犻櫎鎴愬姛",
                    });
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });
                }
              });
            }
          }

          // 璋冩暣楂樻柉
          if (getMessage.gauss != null) {
            gauss = getMessage.gauss;
          }

          // 閲嶆柊璇锋眰涓插彛
          if (getMessage.serialReset != null) {
            SerialPort.list().then((ports) => {
              serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');

              server.clients.forEach(function each(client) {
                /**
                 * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
                 *  */
                const jsonData = JSON.stringify({
                  port: serialport,
                  // length: csvSitData.length,
                  // sitData: csvSitData[0], backData: csvBackData[0]
                });
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            });
          }

          // 鍘嗗彶
          if (getMessage.indexArr != null) {

            historyArr = getMessage.indexArr;
            const historySeries = getHistorySeries({
              sitRows: localData,
              backRows: localDataBack,
              start: getMessage.indexArr[0],
              end: getMessage.indexArr[1],
            });
            const press = historySeries.press;
            const area = historySeries.area;

            server.clients.forEach(function each(client) {
              /**
               * 棣栨璇诲彇涓插彛锛屽皢鏁版嵁闀垮害鍜屼覆鍙ｇ鍙ｆ暟
               *  */
              const jsonData = JSON.stringify({
                pressArr: press,
                areaArr: area,
                // length: csvSitData.length,
                // sitData: csvSitData[0], backData: csvBackData[0]
              });
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });

            indexArr = getMessage.indexArr;
            // localData
            // localDataBack
          }
        }
      });
    })
  }
}

SerialPort.list().then((ports) => {
  logger.info(
    "=========================================================================================\r\n"
  );
  logger.info(
    "hello ,there are serialport lists that we selected from your device\r\n"
  );
  // console.log(ports)
  serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');
  ports.forEach(function (port) {
    logger.info("port:%s\r\n", port.path);
    // try {
    //   const port1 = new SerialPort(
    //     { path: "COM5", baudRate: baudRate, autoOpen: true },
    //     function (err) {
    //       logger.warn(err, "err");
    //     }
    //   );
    //   //绠￠亾娣诲姞瑙ｆ瀽鍣?
    //   port1.pipe(parser);
    // } catch (e) {

    // }
  });
  logger.info(
    "=========================================================================================\r\n"
  );
});
let pointArr, newData, firstBlueData = [], lastBlueData = [], firstBlueData1 = [], lastBlueData1 = [];
let index = 0
parser.on("data", function (data) {
  pointArr = new Array();
  let buffer = Buffer.from(data);
  newData = new Array();
  // console.log(buffer.length)
  if (nowDate < endDate) {
    if (buffer.length === 1024) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }

      let newArr, realArr

      if (file === "car10") {
        pointArr = car10Sit(pointArr);
      }
      else if (file === "car" || file === "foot") {
        pointArr = carSitLine(pointArr);
      }
      else if (file === "sit10") {
        pointArr = sit10Line(pointArr);
      }
      else if (file === "smallBed") {
        // newArr = smallBed([...pointArr]);
        // realArr = smallBed([...pointArr]);
        pointArr = jqbed(pointArr)
        // newArr = [...pointArr]
        // realArr = [...pointArr]
      } else if (file === "smallBed1") {
        // newArr = smallBed1([...pointArr]);
        // realArr = smallBed1([...pointArr]);
        // newArr = [...pointArr]
        // realArr = [...pointArr]
        pointArr = smallBed1(pointArr)
      }
      else if (file === 'smallM') {
        pointArr = smallM1(pointArr)
      } else if (file === 'rect') {
        pointArr = rect(pointArr)
      } else if (file === 'short') {
        pointArr = short(pointArr)
      } else if (file === 'hand') {
        // pointArr = handLine(pointArr)
        // 625
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j],]
          }
        }
        newData = [...pointArr]
        // pointArr = press6sit(pointArr, 32, 32, 'col')
        // pointArr = zeroLine(pointArr)
      } else if (file === 'sit') {
        // pointArr = handLine(pointArr)
        // 625
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j],]
          }
        }
        newData = [...pointArr]
        pointArr = press6sit(pointArr, 32, 32, 'col')
        // pointArr = zeroLine(pointArr)
      } else if (file === 'matCol') {
        pointArr = matColLine(pointArr)
      } else if (file === 'sitCol') {
        // pointArr = handLine(pointArr)
        pointArr = handBlue(pointArr)
      } else if (file === 'yanfeng10') {
        pointArr = yanfeng10sit(pointArr)
      } else if (file === 'handBlue') {
        pointArr = handBlue(pointArr)
      } else if (file === 'volvo') {
        pointArr = wowSitLine(pointArr)
      } else if (file === 'xiyueReal1') {
        pointArr = xiyueReal1(pointArr)
      } else if (file === 'jqbed') {
        pointArr = jqbed(pointArr)
      } else if (file === 'carCol') {
        pointArr = carCol(pointArr)
      } else if (file === 'newHand') {
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j]]
          }
        }
        pointArr = newHand(pointArr)
      } else if (file == 'gloves') {
        pointArr = gloves(pointArr)
      } else if (file == 'gloves1') {
        pointArr = gloves1(pointArr)
      } else if (file == 'gloves2') {
        pointArr = gloves2(pointArr)
      } else if (file == 'sit100') {
        pointArr = pressNew1220({ arr: pointArr, width: 32, height: 32, type: 'col', value: 4096 / 6 })
        pointArr = sit100Line(pointArr)
      } else if (file == 'fast1024sit') {
        pointArr = endiSit1024(pointArr)
      } else if (file == 'fast1024') {
        pointArr = jqbed(pointArr)
        console.log('fast1024')
        // console.log(Math.max(...pointArr))
        pointArr = pressNew1220({ arr: pointArr, height: 32, width: 32, type: 'col', value: 1024 })
        // pointArr = gaussBlur_return(pointArr , 32,32, 0.5)
      } else if (file == 'sofa') {
        pointArr = arrToRealLine(pointArr, [[7, 0], [8, 15]], [[0, 15]], 32)
      }

      pointArr1zeroData = [...pointArr]


      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      // jqbed 调试模式：useMatrixOrigin=true 时用算法返回的 matrix_origin 作为 sitData
      const sitDataToSend = (useMatrixOrigin && file === 'jqbed' && jqbedMatrixOrigin) ? jqbedMatrixOrigin : pointArr;

      let jsonData;

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: sitDataToSend,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? pointArr : sitDataToSend, hz: colHZ });
      }


      // console.log(JSON.stringify(pointArr))
      // if (flag) {
      //   const resDataArr = {
      //     data: JSON.stringify(pointArr),

      //     time: new Date().getTime(),
      //   };

      //   // 1.0
      //   // csvWriter.writeRecords([resDataArr]);

      //   // 2.0
      //   // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
      //   const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
      //   const date = saveTime;
      //   const insertQuery =
      //     "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

      //   console.log(db,)

      //   db.run(
      //     insertQuery,
      //     // [file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify(pointArr), timestamp, date],
      //     [JSON.stringify(pointArr), timestamp, date],
      //     function (err) {
      //       if (err) {
      //         logger.error(err);
      //         return;
      //       }
      //       console.log(`Event inserted with ID ${this.lastID}`);
      //     }
      //   );
      // }

      // if (!localFlag) {
      //   let jsonData;

      //   if (isCar(file)) {
      //     jsonData = JSON.stringify({
      //       sitData: pointArr,
      //       newData: (newData),
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   } else {
      //     // jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? newArr : pointArr, newData: (newData), });

      //     jsonData = JSON.stringify({ sitData: pointArr, newData: (newData), });
      //   }

      //   server.clients.forEach(function each(client) {
      //     if (client.readyState === WebSocket.OPEN) {
      //       client.send(jsonData);
      //     }
      //   });
      // }
      colOrSendData(jsonData)

    }

    if (buffer.length == 72 || buffer.length == 144) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }

      pointArr1zeroData = [...pointArr]


      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      let jsonData;

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }
      colOrSendData(jsonData)
    }

    if (buffer.length == 144) {

    }

    if (buffer.length == 262) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      const length = pointArr.length
      const rotate = pointArr.splice(length - 6, length)
      // console.log(pointArr.length , rotate)
      pointArr = gloves0123Res(pointArr)
      pointArr = gloves0123(pointArr)
      const jsonData = JSON.stringify({
        sitData: pointArr,
        rotate: rotate,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      });
      server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(jsonData);
        }
      });
    }

    if (buffer.length == 130) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]
      let newArr

      firstArr = firstArr.splice(2, length)

      // if (order == 1) {
      firstBlueData = [...firstArr]
      // } else {
      //   lastBlueData = [...firstArr]

      //   pointArr = [...firstBlueData, ...lastBlueData]
      //   const realArr = [...pointArr]
      //   // pointArr = footVideo(pointArr)
      //   newArr = handVideoRealPoint_0506_3([...pointArr])
      //   console.log('handVideo147(pointArr)')
      //   // newArr = handVideoRealPoint([...pointArr])
      //   // newArr = handVideo1470506([...pointArr])
      //   // newArr = handVideoRealPoint_0416_3([...newArr])
      //   // newArr = [...pointArr]
      //   if (file == 'handVideo1') {
      //     pointArr = handVideo1_0416_0506(pointArr)
      //   } else {
      //     pointArr = handVideo1470506(pointArr)
      //   }


      //   // realArr = handVideoRealPoint_0506_3([...pointArr])
      //   if (pointArr1zero.length) {
      //     pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      //   }

      //   let jsonData
      //   if (rotate.every((a) => a == 0)) {
      //     jsonData = JSON.stringify({
      //       rotate: rotate,
      //       sitData: pointArr,
      //       realArr,
      //       newArr147: newArr,
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   } else {
      //     jsonData = JSON.stringify({
      //       rotate: rotate,
      //       sitData: pointArr,
      //       realArr,
      //       newArr147: newArr,
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   }
      //   // const jsonData = JSON.stringify({
      //   //   rotate: rotate,
      //   //   sitData: pointArr,
      //   //   realArr,
      //   //   newArr147: newArr,
      //   //   sitFlag: port1?.isOpen,
      //   //   backFlag: port2?.isOpen,
      //   // });
      //   // server.clients.forEach(function each(client) {
      //   //   if (client.readyState === WebSocket.OPEN) {
      //   //     client.send(jsonData);
      //   //   }
      //   // });


      //   colOrSendData(jsonData, [])
      // }



    }

    if (buffer.length == 146) {

      // console.log(file)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      console.log(pointArr[1])
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // dataItem.next = pointArr
      lastBlueData = [...pointArr]

      pointArr = [...firstBlueData, ...lastBlueData]
      const realArr = [...pointArr]
      let newArr = []


      // newArr = handVideoRealPoint([...pointArr])
      // newArr = handVideo1470506([...pointArr])
      // newArr = handVideoRealPoint_0416_3([...newArr])
      // newArr = [...pointArr]
      console.log(file)
      if (file == 'handVideo1') {
        newArr = handVideoRealPoint_0506_3([...pointArr])
        pointArr = handVideo1_0416_0506(pointArr)
      } else if (file == 'footVideo') {
        // pointArr = new Array(256).fill(50)
        newArr = footL(pointArr)
        pointArr = footVideo(pointArr)

      } else if (file.includes('robot')) {

        // pointArr = press6(pointArr, 16, 16, 'col', 116, 1)
        newArr = [...pointArr]
        // pointArr = robot0401(pointArr)



        // if (pointArr1zero.length) {
        //   pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        // }
      } else if (file == 'smallSample') {
        // 灏忓瀷鏍峰搧 - 鎸変紶鎰熷櫒缂栧彿1-100椤哄簭杈撳嚭10脳10鐭╅樀
        // Excel鏄?6脳16缃戞牸锛屽搴?56瀛楄妭鏁版嵁鐨勯『搴?
        // 浼犳劅鍣ㄧ紪鍙種鍦‥xcel涓殑浣嶇疆(row,col) -> 256瀛楄妭绱㈠紩 = row*16+col
        // 浼犳劅鍣?-100瀵瑰簲鐨?56瀛楄妭绱㈠紩:
        const sensorToByteIndex = [
          223, 222, 221, 220, 219, 218, 217, 216, 215, 214,  // 浼犳劅鍣?-10   (琛?3, 鍒?5鈫?6)
          239, 238, 237, 236, 235, 234, 233, 232, 231, 230,  // 浼犳劅鍣?1-20  (琛?4, 鍒?5鈫?6)
          255, 254, 253, 252, 251, 250, 249, 248, 247, 246,  // 浼犳劅鍣?1-30  (琛?5, 鍒?5鈫?6)
          15, 14, 13, 12, 11, 10, 9, 8, 7, 6,                // 浼犳劅鍣?1-40  (琛?,  鍒?5鈫?6)
          31, 30, 29, 28, 27, 26, 25, 24, 23, 22,            // 浼犳劅鍣?1-50  (琛?,  鍒?5鈫?6)
          207, 206, 205, 204, 203, 202, 201, 200, 199, 198,  // 浼犳劅鍣?1-60  (琛?2, 鍒?5鈫?6)
          191, 190, 189, 188, 187, 186, 185, 184, 183, 182,  // 浼犳劅鍣?1-70  (琛?1, 鍒?5鈫?6)
          175, 174, 173, 172, 171, 170, 169, 168, 167, 166,  // 浼犳劅鍣?1-80  (琛?0, 鍒?5鈫?6)
          159, 158, 157, 156, 155, 154, 153, 152, 151, 150,  // 浼犳劅鍣?1-90  (琛?,  鍒?5鈫?6)
          143, 142, 141, 140, 139, 138, 137, 136, 135, 134,  // 浼犳劅鍣?1-100 (琛?,  鍒?5鈫?6)
        ]
        const mappedArr = []
        for (let i = 0; i < 100; i++) {
          mappedArr.push(pointArr[sensorToByteIndex[i]] || 0)
        }
        pointArr = mappedArr
        newArr = [...mappedArr]
      } else if (file == 'hand0507' || file == 'hand0205' || file == 'handGlove115200' || file == 'Num3D') {
        // left
        // newArr = handVideoRealPoint_0506_3([...pointArr])
        newArr = handL([...pointArr])

        // pointArr = handVideo1470506(pointArr)

        // 
      } else if (file == 'eye') {
        function leftEye(wsPointData) {

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 16; j++) {
              [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j],]
            }
          }

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 16; j++) {
              [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j],]
            }
          }

          const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0]
          const newArr = []
          for (let j = 0; j < 16; j++) {
            for (let i = 0; i < arr.length; i++) {

              newArr.push(wsPointData[j * 16 + arr[i]])
            }
          }
          return newArr



        }
        newArr = leftEye([...pointArr])
        pointArr = [...newArr]
      }
      newArr147 = [...newArr]
      pointArr1zeroData = [...pointArr]
      // newArr = handVideoRealPoint([...pointArr])

      // pointArr = handVideo147(pointArr)




      // stamp = new Date().getTime()
      const rotate = bytes4ToInt10(arr)



      // pointArr = footVideo(pointArr)
      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      if (pointArr147zero.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]))
      }

      let jsonDataObj = {
        sitData: pointArr,
        realArr,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      // console.log(JSON.stringify([pointArr[1] , pointArr[2] , pointArr[3]]))

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj);
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }

      // const jsonData = JSON.stringify({
      //   rotate: rotate,
      //   sitData: pointArr,
      //   realArr,
      //   newArr147: newArr,
      //   sitFlag: port1?.isOpen,
      //   backFlag: port2?.isOpen,
      // });
      // server.clients.forEach(function each(client) {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      // console.log(jsonDataObj.sitData , jsonData)
      colOrSendData(jsonData, [])
    }

    if (buffer.length == 142) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]
      let newArr

      firstArr = firstArr.splice(2, length)

      firstBlueData = [...firstArr]


    }

    if (buffer.length == 158) {

      // console.log(file)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // dataItem.next = pointArr
      lastBlueData = [...pointArr]

      pointArr = [...firstBlueData, ...lastBlueData]

      // for(let i = 0 ; i < 280 ; i++){
      //   pointArr[i] = i
      // }

      const realArr = [...pointArr]
      let newArr = []


      if (file == 'daliegu') {
        newArr = [...pointArr]

      }

      // if (file == 'handVideo1') {
      //   newArr = handVideoRealPoint_0506_3([...pointArr])
      //   pointArr = handVideo1_0416_0506(pointArr)
      // } else if (file == 'footVideo') {
      //   // pointArr = new Array(256).fill(50)
      //   newArr = footL(pointArr)
      //   pointArr = footVideo(pointArr)

      // } else if (file.includes('robot')) {

      //   // pointArr = press6(pointArr, 16, 16, 'col', 116, 1)
      //   newArr = [...pointArr]
      //   // pointArr = robot0401(pointArr)



      //   // if (pointArr1zero.length) {
      //   //   pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      //   // }
      // } else if (file == 'hand0507' || file == 'hand0205' || file == 'handGlove115200' || file == 'Num3D') {
      //   // left
      //   // newArr = handVideoRealPoint_0506_3([...pointArr])
      //   newArr = handL([...pointArr])

      //   // pointArr = handVideo1470506(pointArr)

      //   // 
      // } else if (file == 'eye') {
      //   function leftEye(wsPointData) {

      //     for (let i = 0; i < 4; i++) {
      //       for (let j = 0; j < 16; j++) {
      //         [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j],]
      //       }
      //     }

      //     for (let i = 0; i < 4; i++) {
      //       for (let j = 0; j < 16; j++) {
      //         [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j],]
      //       }
      //     }

      //     const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0]
      //     const newArr = []
      //     for (let j = 0; j < 16; j++) {
      //       for (let i = 0; i < arr.length; i++) {

      //         newArr.push(wsPointData[j * 16 + arr[i]])
      //       }
      //     }
      //     return newArr



      //   }
      //   newArr = leftEye([...pointArr])
      //   pointArr = [...newArr]
      // }
      newArr147 = [...newArr]
      pointArr1zeroData = [...pointArr]
      // newArr = handVideoRealPoint([...pointArr])

      // pointArr = handVideo147(pointArr)




      // stamp = new Date().getTime()
      const rotate = bytes4ToInt10(arr)



      // pointArr = footVideo(pointArr)
      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      if (pointArr147zero.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]))
      }

      let jsonDataObj = {
        sitData: pointArr,
        realArr,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      // console.log(JSON.stringify([pointArr[1] , pointArr[2] , pointArr[3]]))

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj);
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }

      // const jsonData = JSON.stringify({
      //   rotate: rotate,
      //   sitData: pointArr,
      //   realArr,
      //   newArr147: newArr,
      //   sitFlag: port1?.isOpen,
      //   backFlag: port2?.isOpen,
      // });
      // server.clients.forEach(function each(client) {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      // console.log(jsonDataObj.sitData , jsonData)
      colOrSendData(jsonData, [])
    }







    // console.log(buffer.length)
    if (buffer.length == 256) {


      // console.log(file , baudRate)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }



      // const index = Math.floor(Math.random() * 4096)
      // let arr = new Array(4096).fill(0)
      // // for (let i = 0; i < 4096; i++) {
      // //   arr[i] = i
      // // }
      // if (index < 4096) {
      //   index++
      // } else {
      //   index = 0
      // }
      // arr[index] = 100
      let jsonData;
      // pointArr = arr

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }

      colOrSendData(jsonData)
    }

    if (file.includes('bed4096') && buffer.length == 4096) {
      if (buffer.length != 4096) {
        console.log('bufferLength : ', baudRate, buffer.length)
      }

      // console.log(file , baudRate)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }



      // const index = Math.floor(Math.random() * 4096)
      // let arr = new Array(4096).fill(0)
      // // for (let i = 0; i < 4096; i++) {
      // //   arr[i] = i
      // // }
      // if (index < 4096) {
      //   index++
      // } else {
      //   index = 0
      // }
      // arr[index] = 100
      let jsonData;
      // pointArr = arr

      // for (let i = 0; i < 16; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     [pointArr[(33 + i) * 64 + j], pointArr[(33 + 30 - i) * 64 + j]] = [pointArr[(33 + 30 - i) * 64 + j], pointArr[(33 + i) * 64 + j],]
      //   }
      // }

      // for (let i = 0; i < 64; i++) {
      //   for (let j = 0; j < 16; j++) {
      //     [pointArr[(i) * 64 + j], pointArr[(31 - i) * 64 + j]] = [pointArr[(31 - i) * 64 + j], pointArr[(i) * 64 + j],]
      //   }
      // }

      // const newArr = new Array(64).fill(0)
      // for (let i = 2; i <= 32; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     newArr.push(pointArr[i * 64 + j])
      //   }
      // }

      // for (let j = 0; j < 64; j++) {
      //   newArr.push(pointArr[0 * 64 + j])
      // }

      // for (let i = 33; i < 64; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     newArr.push(pointArr[i * 64 + j])
      //   }
      // }

      pointArr = zeroLineMatrix(pointArr, 64)

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }

      // console.log(jsonData)

      colOrSendData(jsonData)

    }

    if (buffer.length == 1) {
      console.log(buffer.readUInt8(i))
      if (buffer.readUInt8(i) == 3) {
        server.clients.forEach(function each(client) {
          const jsonData = JSON.stringify({
            handReset: true,
          });
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }
    }

    // 
  }
});

function colOrSendData(jsonData) {
  // console.log(JSON.stringify(JSON.parse(jsonData).sitData) , 'jsonData')
  const nowDate = new Date().getTime()
  if (flag
    // && nowDate - oldTimeStamp > 1000 / colHZ

  ) {
    oldTimeStamp = nowDate
    const resDataArr = {
      data: JSON.stringify(pointArr),
      time: new Date().getTime(),
    };

    // 1.0
    // csvWriter.writeRecords([resDataArr]);

    // 2.0
    // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
    const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    // 1.0 鏈哄櫒浜轰箣鍓?
    // db.run(
    //   insertQuery,
    //   [(file.includes('hand0205') || file == 'handGlove115200') ? JSON.stringify([...pointArr, ...rotate]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify(pointArr), timestamp, date],
    //   function (err) {
    //     if (err) {
    //       logger.error(err);
    //       return;
    //     }
    //     console.log(`Event inserted with ID ${this.lastID}`);
    //   }
    // );

    db.run(
      insertQuery,
      [(file.includes('hand0205') || file == 'handGlove115200') ? JSON.stringify([...JSON.parse(jsonData).realArr, ...(JSON.parse(jsonData).rotate || [])]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify([...JSON.parse(jsonData).sitData]), timestamp, date],
      function (err) {
        if (err) {
          logger.error(err);
          return;
        }
        console.log(`Event inserted with ID ${this.lastID}`);
      }
    );
  }

  if (!localFlag) {

    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonData);
      }
    });
  }
}

// 澶勭悊涓插彛鏁版嵁

var pointArr2;
parser2.on("data", function (data) {
  pointArr2 = new Array();
  let buffer = Buffer.from(data);
  if (nowDate < endDate) {
    console.log(buffer.length)
    if (buffer.length === 1024) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr2[i] = buffer.readUInt8(i);
      }

      if (file === "car10") {
        pointArr2 = car10Back(pointArr2);
      } else if (file === 'yanfeng10') {
        pointArr2 = yanfeng10back(pointArr2);
      } else if (file === 'volvo') {
        pointArr2 = wowBackLine(pointArr2)
      } else if (file == 'carQX') {

      } else if (file == 'sofa') {
        pointArr2 = arrToRealLine(pointArr2, [[7, 0], [8, 15]], [[0, 15]], 32)
      } else {
        pointArr2 = carBackLine(pointArr2);
      }

      pointArr2zeroData = [...pointArr2]

      if (pointArr2zero.length) {
        pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]))
      }

      // pointArr2 = carBackLine(pointArr2);
      if (flag) {
        const resDataArr = {
          data: JSON.stringify(pointArr2),
          time: new Date().getTime(),
        };
        // csvWriterback.writeRecords([resDataArr]);

        const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
        const date = saveTime;
        const insertQuery =
          "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

        db1.run(
          insertQuery,
          [JSON.stringify(pointArr2), timestamp, date],
          function (err) {
            if (err) {
              logger.error(err);
              return;
            }
            console.log(`Event inserted with ID ${this.lastID}`);
          }
        );
      }

      if (!localFlag) {
        let jsonData = JSON.stringify({ backData: pointArr2 });
        if (isCar(file)) {
          jsonData = JSON.stringify({
            backData: pointArr2,
            sitFlag: port1?.isOpen,
            backFlag: port2?.isOpen,
          });
        } else {
          jsonData = JSON.stringify({ backData: pointArr2 });
        }

        server.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }


    }

    if (buffer.length == 130) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]

      firstArr = firstArr.splice(2, length)

      if (order == 1) {
        firstBlueData1 = [...firstArr]
      } else {
        lastBlueData1 = [...firstArr]
        pointArr = [...firstBlueData1, ...lastBlueData1]
        pointArr = footVideo1(pointArr)

        if (pointArr1zero.length) {
          pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        }
        const arr = [...pointArr]
        const jsonData = JSON.stringify({
          rotate: rotate,
          backData: arr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        });
        // server.clients.forEach(function each(client) {
        //   if (client.readyState === WebSocket.OPEN) {
        //     client.send(jsonData);
        //   }
        // });

        colOrSendData1(jsonData, [])
      }



    }

    if (buffer.length == 146) {
      let pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // pointArr = [...arr]
      // dataItem.next = pointArr
      lastBlueData1 = [...pointArr]
      let newArr = []

      pointArr2 = [...firstBlueData1, ...lastBlueData1]

      const realArr = [...pointArr2]

      if (file == 'footVideo') {
        // pointArr2 = new Array(256).fill(50)
        newArr = footR(pointArr2)
        pointArr2 = footVideo1(pointArr2)

      } else if (file == 'hand0507' || file == 'hand0205' || file == 'handGlove115200') {
        newArr = handR(pointArr2)

        pointArr2 = handRVideo1470506(pointArr2)

      } else if (file == 'eye') {
        function rightEye(wsPointData) {
          const newArr = []
          let lastArr = wsPointData.splice(128, 128)
          wsPointData = lastArr.concat(wsPointData)
          const arr = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse()

          for (let j = 0; j < 16; j++) {
            for (let i = 0; i < arr.length; i++) {

              newArr.push(wsPointData[j * 16 + arr[i]])
            }
          }
          return newArr
        }
        newArr = rightEye([...pointArr2])
        pointArr2 = [...newArr]

      }

      newArr147_2 = [...newArr]
      pointArr2zeroData = [...pointArr2]
      // console.log(pointArr2zero)
      if (pointArr2zero.length) {
        pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]))
      }

      if (pointArr147zero_2.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]))
      }
      // arr = [...pointArr]
      const rotate = bytes4ToInt10(arr)


      let jsonDataObj = {
        backData: pointArr2,
        realArr,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj)
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     backData: pointArr2,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     backData: pointArr2,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }
      // server.clients.forEach(function each(client) {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      colOrSendData1(jsonData, [])

    }

    if (buffer.length == 1) {
      console.log(buffer.readUInt8(i))
      if (buffer.readUInt8(i) == 3) {
        server.clients.forEach(function each(client) {
          const jsonData = JSON.stringify({
            handReset: true,
          });
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }
    }
  }
});

function colOrSendData1(jsonData) {

  const nowDate = new Date().getTime()
  if (flag
    // && nowDate - oldTimeStamp > 1000 / colHZ
  ) {
    oldTimeStamp = nowDate
    const resDataArr = {
      data: JSON.stringify(pointArr),
      time: new Date().getTime(),
    };

    // 1.0
    // csvWriter.writeRecords([resDataArr]);

    // 2.0
    // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
    const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    db1.run(
      insertQuery,
      [(file.includes('hand0205') || file == 'handGlove115200') ? JSON.stringify([...JSON.parse(jsonData).realArr, ...(JSON.parse(jsonData).rotate || [])]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify([...JSON.parse(jsonData).backData]), timestamp, date],
      function (err) {
        if (err) {
          logger.error(err);
          return;
        }
        console.log(`Event inserted with ID ${this.lastID}`);
      }
    );
  }

  if (!localFlag) {

    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonData);
      }
    });
  }
}

var pointArr3;
parser3.on("data", function (data) {
  if (file == "bigBed") {
    pointArr3 = new Array();
    let buffer = Buffer.from(data);

    let res = [];
    if (nowDate < endDate) {
      if (buffer.length === 1025) {
        for (var i = 0; i < buffer.length; i++) {
          pointArr3[i] = buffer.readUInt8(i);
        }

        if (pointArr3[pointArr3.length - 1] == 0) {
          firstData = [...pointArr3];
          firstData.pop();
          // 鍙宠竟绾垮簭

        }
        if (pointArr3[pointArr3.length - 1] == 1) {
          lastData = [...pointArr3];
          lastData.pop();
          // 娣诲姞
          let a = [];
          for (let i = 0; i < 32; i++) {
            for (let j = 0; j < 32; j++) {
              a.push(firstData[i * 32 + j]);
            }
            for (let j = 0; j < 32; j++) {
              a.push(lastData[i * 32 + j]);
            }
          }
          res = a;
          if (!localFlag) {
            let jsonData = JSON.stringify({ sitData: res });
            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
          }

          if (flag) {
            const resDataArr = {
              data: JSON.stringify(res),
              time: new Date().getTime(),
            };
            dataFalg++;
            // 1.0
            // csvWriter.writeRecords([resDataArr]);xai
            // 2.0
            // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
            if (dataFalg % 10 == 0) {
              const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
              const date = saveTime;
              const insertQuery =
                "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";
              db.run(
                insertQuery,
                [JSON.stringify(res), timestamp, date],
                function (err) {
                  if (err) {
                    logger.error(err);
                    return;
                  }
                  console.log(`Event inserted with ID ${this.lastID}`);
                }
              );
            }
            if (dataFalg >= 10) {
              dataFalg = 0;
            }
          }
        }
      }




    }
  }
});

var pointArr4;

parser4.on("data", function (data) {
  pointArr4 = new Array();
  let buffer = Buffer.from(data);
  if (nowDate < endDate) {
    if (buffer.length === 1024) {

      for (var i = 0; i < buffer.length; i++) {
        pointArr4[i] = buffer.readUInt8(i);
      }
      if (file == 'volvo') {
        pointArr4 = wowhead(pointArr4);
      }


      pointArr4zeroData = [...pointArr4]

      if (pointArr4zero.length) {
        pointArr4 = pointArr4.map((a, index) => numLessZeroToZero(a - pointArr4zero[index]))
      }

      if (flag) {
        const resDataArr = {
          data: JSON.stringify(pointArr4),
          time: new Date().getTime(),
        };
        // csvWriterback.writeRecords([resDataArr]);

        const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
        const date = saveTime;
        const insertQuery =
          "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

        db2.run(
          insertQuery,
          [JSON.stringify(pointArr4), timestamp, date],
          function (err) {
            if (err) {
              logger.error(err);
              return;
            }
            console.log(`Event inserted with ID ${this.lastID}`);
          }
        );
      }

      if (!localFlag) {
        let jsonData = JSON.stringify({ headData: pointArr4 });
        if (isCar(file)) {
          jsonData = JSON.stringify({
            headData: pointArr4,
            sitFlag: port1?.isOpen,
            backFlag: port2?.isOpen,
          });
        } else {
          jsonData = JSON.stringify({ headData: pointArr4 });
        }

        server.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }


    }


    if (buffer.length == 130) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]

      firstArr = firstArr.splice(2, length)

      if (order == 1) {
        firstBlueData2 = [...firstArr]
      } else {
        lastBlueData2 = [...firstArr]
        pointArr = [...firstBlueData2, ...lastBlueData2]
        pointArr = footVideo1(pointArr)

        if (pointArr1zero.length) {
          pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        }
        const arr = [...pointArr]
        const jsonData = JSON.stringify({
          rotate: rotate,
          backData: arr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        });
        // server.clients.forEach(function each(client) {
        //   if (client.readyState === WebSocket.OPEN) {
        //     client.send(jsonData);
        //   }
        // });

        colOrSendData1(jsonData, [])
      }



    }

    if (buffer.length == 146) {
      let pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // pointArr = [...arr]
      // dataItem.next = pointArr
      lastBlueData2 = [...pointArr]
      let newArr = []

      pointArr4 = [...firstBlueData2, ...lastBlueData2]

      const realArr = [...pointArr4]

      if (file == 'footVideo') {
        newArr = footR(pointArr4)
        pointArr4 = footVideo1(pointArr4)

      } else if (file == 'hand0507' || file == 'hand0205' || file == 'handGlove115200') {
        newArr = handR(pointArr4)

        pointArr4 = handRVideo1470506(pointArr4)

      }

      newArr147_2 = [...newArr]

      pointArr4zeroData = [...pointArr4]

      if (pointArr4zero.length) {
        pointArr4 = pointArr4.map((a, index) => numLessZeroToZero(a - pointArr4zero[index]))
      }

      if (pointArr147zero_2.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]))
      }
      // arr = [...pointArr]
      const rotate = bytes4ToInt10(arr)


      let jsonDataObj = {
        headData: pointArr4,
        realArr,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj)

      colOrSendData2(jsonData, [])

    }

  }
});


function colOrSendData2(jsonData) {

  const nowDate = new Date().getTime()
  if (flag && nowDate - oldTimeStamp > 1000 / colHZ) {
    oldTimeStamp = nowDate
    const resDataArr = {
      data: JSON.stringify(pointArr),
      time: new Date().getTime(),
    };

    // 1.0
    // csvWriter.writeRecords([resDataArr]);

    // 2.0
    // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
    const timestamp = Date.now(); // 鑾峰彇褰撳墠鏃堕棿鐨勬椂闂存埑
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    db2.run(
      insertQuery,
      [(file.includes('hand0205') || file == 'handGlove115200') ? JSON.stringify([...JSON.parse(jsonData).realArr, ...(JSON.parse(jsonData).rotate || [])]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify([...JSON.parse(jsonData).backData]), timestamp, date],
      function (err) {
        if (err) {
          logger.error(err);
          return;
        }
        console.log(`Event inserted with ID ${this.lastID}`);
      }
    );
  }

  if (!localFlag) {

    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonData);
      }
    });
  }
}

// 閲嶈繛
setInterval(() => {
  if (com && !port1.isOpen && sitClose == false) {
    // if()
    console.log(com)
    if (file != "bigBed") {
      try {
        port1 = new SerialPort(
          {
            path: com,
            baudRate: baudRate,
            autoOpen: true,
          },
          function (err) {
            logger.warn(err, "err");
          }
        );
        //绠￠亾娣诲姞瑙ｆ瀽鍣?
        port1.pipe(parser);
      } catch (e) {
        logger.warn(e, "e");
      }
    } else {
      try {
        port1 = new SerialPort(
          // com,
          {
            path: com,
            baudRate: baudRate,
            autoOpen: true,
          },
          function (err) {
            logger.warn(err, "err");
          }
        );
        //绠￠亾娣诲姞瑙ｆ瀽鍣?
        port1.pipe(parser3);
      } catch (e) {
        logger.warn(e, "e");
      }
    }

  }

  if (com1 && !port2.isOpen && backClose == false) {
    try {
      port2 = new SerialPort(
        // com1,
        {
          path: com1,
          baudRate: baudRate,
          autoOpen: true,
        },
        function (err) {
          logger.warn(err, "err");
        }
      );
      //绠￠亾娣诲姞瑙ｆ瀽鍣?
      port2.pipe(parser2);
    } catch (e) {
      logger.warn(e, "e");
    }
  }
}, 3000);

// jqbed 数据翻转变换（供 callPy 使用）
function jqbedOppo(arr) {
  let wsPointData = [...arr];
  let b = wsPointData.splice(0, 17 * 32);
  wsPointData = wsPointData.concat(b);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 32; j++) {
      [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
        wsPointData[(14 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }
  return wsPointData;
}

// jqbed 健康监测算法定时调用（125ms）
setInterval(async () => {
  if (pointArr&&pointArr.length  && pointArr.every((a) => typeof a == 'number') && file == 'jqbed' && port1 && port1.isOpen) {
    const newArr = jqbedOppo(pointArr);
    console.log(newArr.reduce((a,b) => a+b , 0),pointArr.length,'nweArr')
    try {
      const data = await callPy('getData', { data: newArr });
      if (data && data.rate != -1) {
        console.log('[jqbed] pyResult:', data,data.matrix_origin.reduce((a,b) => a+b , 0));

        // 缓存算法返回的 matrix_origin（供 useMatrixOrigin flag 使用）
        if (data.matrix_origin && Array.isArray(data.matrix_origin)) {
          jqbedMatrixOrigin = data.matrix_origin;
        }

        if (onbedArr.length < 2) {
          onbedArr.push(data.stateInBbed);
        } else {
          onbedArr.shift();
          onbedArr.push(data.stateInBbed);
        }

        if (onbedArr.every((a) => a == 1)) {
          onBedTime += 2;
          data.onBedTime = onBedTime;
        } else if (onbedArr.every((a) => a == 0)) {
          onBedTime += 2;
          data.onBedTime = onBedTime;
        } else {
          onBedTime = 0;
          data.onBedTime = 0;
        }

        const jsonData = JSON.stringify({ rate: data });
        server.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }
    } catch (e) {
      console.error('[jqbed] callPy error:', e.message);
    }
  }
}, 125);
