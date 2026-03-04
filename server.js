const WebSocket = require("ws");
const { app } = require('electron')
const path = require('path');
var os = require('os');
const fs = require('fs');
const { SerialPort } = require("serialport");
const { DelimiterParser } = require("@serialport/parser-delimiter");
const sqlite3 = require("sqlite3").verbose();
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

var serialport = { a: 1, b: 2 }
const timeNum = 1000 / 12;
var port2,
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
let lastData = new Array(1024).fill(0),
  firstData = new Array(1024).fill(0);
const backTotal = backnum1 * backnum2;
const sitTotal = sitnum1 * sitnum2;
let length, history, nowGetTime;
var serialport;

let nowDate = 0
let endDate = 0

const https = require('https')
const request = require('request');
request('http://sensor.bodyta.com:8080/rcv/login/getSystemTime', {
  json: true, method: 'get', headers: {
    'content-type': 'application/json; charset=utf-8;',
  }
}, (err, res, body) => {
  if (err) {
    return console.log(err);
  }
  console.log(body.time, 'body');
  nowDate = parseInt(body.time)
});

let filePath = __dirname + "/db";
let csvPath = __dirname + "/data";
let nameTxt = __dirname + "/config.txt";

console.log(__dirname, app.getAppPath(), path.join(__dirname, '../db'), '__dirname')

if (app.isPackaged) {
  if (os.platform() == 'darwin') {
    // filePath = '../..' + '/db'
    // filePath = path.join(app.getAppPath(), 'Resources/db',);
    filePath = path.join(__dirname, '../db')
    csvPath = path.join(__dirname, '../data')
    nameTxt = path.join(__dirname, '../config.txt')
    // nameTxt = 
    // csvPath = '../..' + '/data'
    // nameTxt = '../..' + "/config.txt";
  } else {
    filePath = 'resources' + '/db'
    csvPath = 'resources' + '/data'
    nameTxt = 'resources' + "/config.txt";
  }

}



const defauleFile = 'hand0205'
let date, sysStartTime, file = defauleFile, selectFlag
try {
  const dateRes = fs.readFileSync(nameTxt, 'utf8');
  const parsedData = JSON.parse(module2.decryptStr(dateRes));
  endDate = parseFloat(parsedData.date);
  const rawFile = parsedData.file;
  selectFlag = rawFile; // 保留原始值发送给前端（可能是 'all'、字符串、或数组）

  // 解析 file 字段：支持 'all'、单个字符串、数组三种格式
  if (rawFile === 'all') {
    file = defauleFile;
  } else if (Array.isArray(rawFile)) {
    // 多类型模式：使用数组中的第一个作为默认启动类型
    file = rawFile[0] || defauleFile;
  } else {
    file = rawFile || defauleFile;
  }
} catch (err) {
  console.error(err);
}

// let db = new sqlite3.Database(`${filePath}/foot.db`);
// let db1 = new sqlite3.Database(`${filePath}/back.db`);
// let db2 = new sqlite3.Database(`${filePath}/volvohead.db`);
let sitTimeArr = [],
  backTimeArr = [];
let dataFalg = 0;

// const createCsvWriter = require("csv-writer").createObjectCsvWriter;

var saveTime,
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
//   console.error(err);
// }




const dbObj = initDb(file)
db = dbObj.db
db1 = dbObj.db1
db2 = dbObj.db2

var flag = false;
var colHZ = 12, oldTimeStamp = new Date().getTime();
let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
// let splitBuffer1 = Buffer.from([0xaa, 0x55, 0x03, 0x09]);
let parser2 = new DelimiterParser({ delimiter: splitBuffer });
let parser = new DelimiterParser({ delimiter: splitBuffer });
let parser3 = new DelimiterParser({ delimiter: splitBuffer });
let parser4 = new DelimiterParser({ delimiter: splitBuffer });
var server, server1, server2;
var localData = [],
  localDataBack = [],
  localDataHead = [],
  indexArr = [0, 0];
let up = 1245, down = 2
var pointArr1zero = []
var pointArr147zero = []
var pointArr147zero_2 = []
var pointArr2zero = []
var pointArr3zero = []
var pointArr4zero = []

var pointArr1zeroData = []
var pointArr2zeroData = []
var pointArr3zeroData = []
var pointArr4zeroData = [], newArr147 = [], newArr147_2 = [],

  server = new WebSocket.Server({ port: 19999 });
server1 = new WebSocket.Server({ port: 19998 });
server2 = new WebSocket.Server({ port: 19997 });

module.exports = {
  openServer() {

    server1.on("open", function open() {
      console.log("connected");
    });

    server1.on("close", function close() {
      console.log("disconnected");
    });

    server1.on("connection", function connection(ws, req) {
      ws.on("message", function incoming(message) {
        console.log("received: %s from %s", message, clientName, localFlag);

        const getMessage = JSON.parse(message);

        /**
         * 将实时靠背数据通道打开
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
                  console.log(err, "err");
                }
              );
              //管道添加解析器
              port2.pipe(parser2);
            } catch (e) {
              console.log(e, "e");
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
                    console.log(err, "err");
                  }
                );
                //管道添加解析器
                // port2.pipe(parser2);
              } catch (e) {
                console.log(e, "e");
              }
            }
          }

          /**
           * 将靠背数据通道关闭
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
          //       console.error(err);
          //     } else {
          //       localDataBack = rows;
          //     }
          //   });
          // }
        }
      });
    });

    server.on("open", function open() {
      console.log("connected");
    });

    server.on("close", function close() {
      console.log("disconnected");
    });

    server.on("connection", function connection(ws, req) {

      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = ip + port;
      console.log("%s is connected", clientName);

      server.clients.forEach(function each(client) {
        /**
         * 首次读取串口，将数据长度和串口端口数
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
           * 首次读取串口，将数据长度和串口端口数
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
              console.error(err);
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
          selectFlag = rawFile; // 保留原始值（'all'、字符串、或数组）发送给前端

          // 解析 file 字段：支持 'all'、单个字符串、数组三种格式
          if (rawFile === 'all') {
            file = defauleFile;
          } else if (Array.isArray(rawFile)) {
            file = rawFile[0] || defauleFile;
          } else {
            file = rawFile || defauleFile;
          }
          endDate = parseFloat(parsedLicense.date);


          server.clients.forEach(function each(client) {
            /**
             * 首次读取串口，将数据长度和串口端口数
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
        //      * 首次读取串口，将数据长度和串口端口数
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

          // 置零
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

            if (['hand0205', 'footVideo', 'eye', 'daliegu', 'smallSample'].includes(receiveFile) || receiveFile.includes('robot')) {
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
           * 将本地保存数据通道打开
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
                      console.error(err);
                    } else {
                      localData = rows;
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
                      for (let i = 0; i < rows.length; i++) {
                        let a =
                          totalToN(JSON.parse(localData[i].data).reduce((a, b) => a + b, 0)) +
                          (isCar(file) && localDataBack[i]
                            ? totalToN(JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0), 1.3)
                            : 0);
                        let b =
                          JSON.parse(localData[i].data).filter((a) => a > 10).length +
                          (isCar(file) && localDataBack[i]
                            ? JSON.parse(localDataBack[i].data).filter((a) => a > 10)
                              .length
                            : 0);
                        // press.push(a);
                        press.push(a);
                        area.push(b);
                      }

                      server.clients.forEach(function each(client) {
                        /**
                         * 首次读取串口，将数据长度和串口端口数
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
                      //        * 首次读取串口，将数据长度和串口端口数
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
                      //      * 首次读取串口，将数据长度和串口端口数
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
                  //   //    * 首次读取串口，将数据长度和串口端口数
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
                      console.error(err);
                    } else {

                      if (file == 'volvo') {
                        db2.all(selectQuery, params, (err, rows) => {
                          if (err) {
                            console.error(err);
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
                               * 首次读取串口，将数据长度和串口端口数
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
                      for (let i = 0; i < rows.length; i++) {
                        let a =
                          totalToN(JSON.parse(localData[i].data).reduce((a, b) => a + b, 0)) +
                          (isCar(file) && localDataBack[i]
                            ? totalToN(JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0), 1.3)
                            : 0);
                        let b =
                          JSON.parse(localData[i].data).filter((a) => a > 10).length +
                          (isCar(file) && localDataBack[i]
                            ? JSON.parse(localDataBack[i].data).filter((a) => a > 10)
                              .length
                            : 0);
                        // press.push(a);
                        press.push(a);
                        area.push(b);
                      }

                      server.clients.forEach(function each(client) {
                        /**
                         * 首次读取串口，将数据长度和串口端口数
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
                      //        * 首次读取串口，将数据长度和串口端口数
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
                      //      * 首次读取串口，将数据长度和串口端口数
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
                  console.error(err);
                } else {
                  localData = rows;
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
                  for (let i = 0; i < rows.length; i++) {
                    let a =
                      totalToN(JSON.parse(localData[i].data).reduce((a, b) => a + b, 0)) +
                      (isCar(file) && localDataBack[i]
                        ? totalToN(JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0), 1.3)
                        : 0);
                    let b =
                      JSON.parse(localData[i].data).filter((a) => a > 10).length +
                      (isCar(file) && localDataBack[i]
                        ? JSON.parse(localDataBack[i].data).filter((a) => a > 10)
                          .length
                        : 0);
                    // press.push(a);
                    press.push(a);
                    area.push(b);
                  }

                  server.clients.forEach(function each(client) {
                    /**
                     * 首次读取串口，将数据长度和串口端口数
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
                  //        * 首次读取串口，将数据长度和串口端口数
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
                  //      * 首次读取串口，将数据长度和串口端口数
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
           * 将实时座椅数据通道打开
           */
          if (JSON.parse(message).sitPort != null) {
            sitClose = false
            com = JSON.parse(message).sitPort;
            if (port1?.isOpen) {
              port1.close((e) => {
                console.log(e)
              });
            }
            if (com == com1) {
              if (port2?.isOpen) {
                port2.close((e) => {
                  console.log(e)
                });
              }
            }
            console.log(baudRate)
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
                    console.log(err, "err");
                  }
                );
                //管道添加解析器
                // let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
                // parser = new Delimiter({ delimiter: splitBuffer });
                port1.pipe(parser);
              } catch (e) {
                console.log(e, "e");
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
                    console.log(err, "err");
                  }
                );
                //管道添加解析器
                port1.pipe(parser3);
              } catch (e) {
                console.log(e, "e");
              }
            }
          }


          if (JSON.parse(message).headPort != null) {
            headClose = false
            comhead = JSON.parse(message).headPort;
            if (portHead?.isOpen) {
              portHead.close((e) => {
                console.log(e)
              });
            }
            // if (com == com1) {
            //   if (port2?.isOpen) {
            //     port2.close((e) => {
            //       console.log(e)
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
                //管道添加解析器
                // let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
                // parser = new Delimiter({ delimiter: splitBuffer });
                portHead.pipe(parser4);
              } catch (e) {
                console.log(e, "e");
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
                //管道添加解析器
                portHead.pipe(parser4);
              } catch (e) {
                console.log(e, "e");
              }
            }
          }

          /**
           * 将实时靠背数据通道打开
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
                  console.log(err, "err");
                }
              );
              //管道添加解析器

              port2.pipe(parser2);
            } catch (e) {
              console.log(e, "e");
            }
          }

          /**
           * 将座椅数据通道关闭
           */
          if (JSON.parse(message).sitClose === true) {
            sitClose = true
            if (port1?.isOpen) {
              port1.close();
            }
          }

          /**
           * 将靠背数据通道关闭
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
           * 将读取本地数据通道打开
           */
          if (JSON.parse(message).local === true) {
            localFlag = true;

            // 传递时间戳给前端
            const selectQuery =
              "select DISTINCT date from matrix ORDER BY timestamp DESC LIMIT ?,?";
            const params = [0, 500];

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  console.error(err);
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
                      console.error(err);
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
                  console.error(err);
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
            //         console.log(err, "err");
            //       }
            //     );
            //     //管道添加解析器
            //     // port1.pipe(parser);
            //   } catch (e) {
            //     console.log(e, "e");
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
            //         console.log(err, "err");
            //       }
            //     );
            //     //管道添加解析器
            //     // port2.pipe(parser2);
            //   } catch (e) {
            //     console.log(e, "e");
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

                if (['hand0205', 'robot1'].includes(file)) {
                  sitObj.newArr147 = localData[value]?.data
                  backObj.newArr147 = localData[value]?.data
                }

                if (file == 'footVideo') {
                  sitObj.newArr147 = footArrToNormal(localData[nowIndex]?.data)
                  backObj.newArr147 = footArrToNormal(localDataBack[nowIndex]?.data)
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
              clearInterval(timer);
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

                  if (['hand0205', 'robot1'].includes(file)) {
                    sitObj.newArr147 = localData[nowIndex]?.data
                    backObj.newArr147 = localDataBack[nowIndex]?.data
                  }

                  if (file == 'footVideo') {
                    sitObj.newArr147 = footArrToNormal(localData[nowIndex]?.data)
                    backObj.newArr147 = footArrToNormal(localDataBack[nowIndex]?.data)

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
                  playFlag = false;
                  clearInterval(timer);
                }
              }, interval);
            } else {
              clearInterval(timer);
            }
          }

          if (getMessage.index != null) {
            nowIndex = getMessage.index;
          }

          // 交换串口
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
                      console.log(err, "err");
                    }
                  );
                  //管道添加解析器
                  port1.pipe(parser);
                } catch (e) {
                  console.log(e, "e");
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
                      console.log(err, "err");
                    }
                  );
                  //管道添加解析器
                  port2.pipe(parser2);
                } catch (e) {
                  console.log(e, "e");
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
                 * 首次读取串口，将数据长度和串口端口数
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
               * 首次读取串口，将数据长度和串口端口数
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

          // 下载csv
          if (getMessage.download) {
            smoothValue = 0;
            const csvWriteData = [];
            const csvWriteBackData = [];
            //查询语句
            // const selectQuery = 'select * from matrix WHERE timestamp>? and timestamp<? and date=?';
            const selectQuery = "select * from matrix WHERE date=?";
            // const params = [1287154796066,1887154796066,'2023-06-19-14:05'];
            const params = [getMessage.download];

            if (file === "bigBed") {
              let startPressure = 0;
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  console.error(err);
                } else {
                  //把时间 压力面积 平均压力数据push进csvWriter进行汇总
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
                      pressureArea: area, //原始矩阵
                      pressure: total / length,
                      realData: realArr,
                      pressValue: wsPointData.reduce((a, b) => a + b, 0),
                      pressuremmgH: pressure,
                      pressLine: bodyArr,
                    };
                    csvWriteData.push(newData);
                  }
                  // 将汇总的压力数据写入 CSV 文件
                  // const timeStamp = Date.now()
                  const str = nowGetTime.replace(/[/:]/g, "-");
                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/${file}${str}.csv`, // 指定输出文件的路径和名称
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
                      console.log("导出csv成功！");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv成功！",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("导出csv失败：", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv失败!",
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
                  console.error(err);
                } else {
                  //把时间 压力面积 平均压力数据push进csvWriter进行汇总

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
                        : area * 2.1, //原始矩阵
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
                  // 将汇总的压力数据写入 CSV 文件
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime; //.replace(/[/:]/g, "-");
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/${file}${str}.csv`, // 指定输出文件的路径和名称
                    header: [
                      { id: "index", title: "" },
                      { id: "time", title: "time" },
                      { id: "pressureArea", title: "area" },
                      { id: "pressure", title: "press" },
                      { id: "realInitData", title: "realInitData" },
                      { id: "pressuremmgH", title: "压强大小(mmgH)" },
                      { id: "realData", title: "data" },
                      { id: "dataToInterpGauss", title: "algorData" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("导出csv成功！");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv成功！",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("导出csv失败：", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv失败!",
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
                  console.error(err);
                } else {
                  //把时间 压力面积 平均压力数据push进csvWriter进行汇总
                  const label = getMessage.download.split('_')[1]
                  if (!rows.length) return;
                  for (var i = 0, j = 0; i < rows.length; i++, j++) {
                    const newData = {
                      realData: rows[i][`data`],
                      label: label
                    };
                    csvWriteData.push(newData);
                  }
                  // 将汇总的压力数据写入 CSV 文件
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
                    path: `${csvPath}/${file}${str}.csv`, // 指定输出文件的路径和名称
                    header: [
                      { id: "realData", title: "data" },
                      { id: "label", title: "label" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("导出csv成功！");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv成功！",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("导出csv失败：", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv失败!",
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
                  console.error(err);
                } else {
                  //把时间 压力面积 平均压力数据push进csvWriter进行汇总
                  const label = getMessage.download.split('_')[1]
                  if (!rows.length) return;
                  for (var i = 0, j = 0; i < rows.length; i++, j++) {
                    const newData = {
                      realData: rows[i][`data`],
                      label: label
                    };
                    csvWriteData.push(newData);
                  }
                  // 将汇总的压力数据写入 CSV 文件
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
                    path: `${csvPath}/${file}${str}.csv`, // 指定输出文件的路径和名称
                    header: [
                      { id: "realData", title: "data" },
                      { id: "label", title: "label" },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("导出csv成功！");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv成功！",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("导出csv失败：", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv失败!",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    });
                }
              });
            } else if (file !== "car10") {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  console.error(err);
                } else {
                  //把时间 压力面积 平均压力数据push进csvWriter进行汇总

                  if (!rows.length) return;
                  console.log(historyArr)
                  for (var i = historyArr[0], j = 0; i < historyArr[1] - 1; i++, j++) {
                    const sitData = JSON.parse(rows[i][`data`]);
                    console.log(sitData.length)
                    const press = sitPressSelect.length
                      ? sitPressSelect[i]
                      : sitData.reduce((a, b) => a + b, 0);
                    // wsPointData = JSON.parse(rows[i][`data`]).map((a) => a < 10 ? 0 : a)
                    // const realArr = press(wsPointData,1500)
                    // const pressure = realArr.reduce((a,b) => a+b , 0) / realArr.filter((a) => a> 0).length
                    // const pressuremmgH = calculatePressure(pressure)

                    const area = sitAreaSelect.length
                      ? sitAreaSelect[i]
                      : sitData.filter((a) => a > 0).length;

                    const max = findMax(sitData)
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: sitAreaSelect.length
                        ? sitAreaSelect[i]
                        : area, //原始矩阵
                      pressure: sitPressSelect.length
                        ? sitPressSelect[i]
                        : totalToN(press),
                      realData: rows[i][`data`],
                      index: (j / 12).toFixed(2),
                      max
                      // pressuremmgH :pressuremmgH
                    };
                    csvWriteData.push(newData);
                  }
                  // 将汇总的压力数据写入 CSV 文件
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime; //.replace(/[/:]/g, "-");
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter = createCsvWriter({
                    path: `${csvPath}/sit${str}.csv`, // 指定输出文件的路径和名称
                    header: [
                      { id: "index", title: "" },
                      { id: "max", title: "max" },
                      { id: "time", title: "time" },
                      { id: "pressureArea", title: "area" },
                      { id: "pressure", title: "press" },
                      // { id: "pressuremmgH", title: "压强大小(mmgH)" },
                      { id: "realData", title: "data" },

                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("导出csv成功！");

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv成功！",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("导出csv失败：", err);

                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv失败!",
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
                  console.error(err);
                } else {
                  // console.log(rows)
                  //把时间 压力面积 平均压力数据push进csvWriter进行汇总
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
                    //     : area * 2.1, //原始矩阵
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
                        : area, //原始矩阵
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
                  // 将汇总的压力数据写入 CSV 文件

                  // let str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime;
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvWriter1 = createCsvWriter({
                    path: `${csvPath}/back${str}.csv`,
                    // path: `./data/back${str}.csv`, // 指定输出文件的路径和名称
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
                      console.log("导出csv成功！");
                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv成功！",
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("导出csv失败：", err);
                      server.clients.forEach(function each(client) {
                        const jsonData = JSON.stringify({
                          download: "导出csv失败！",
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
                    console.error(err);
                  } else {
                    // console.log(rows)
                    //把时间 压力面积 平均压力数据push进csvWriter进行汇总
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
                      //     : area * 2.1, //原始矩阵
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
                          : area, //原始矩阵
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
                    // 将汇总的压力数据写入 CSV 文件

                    // let str = nowGetTime.replace(/[/:]/g, "-");
                    let str = nowGetTime;
                    if (str.includes(" ")) {
                      str = str.split(" ")[0];
                    } else {
                      str = timeStampTo_Date(Number(str));
                    }

                    const csvWriter1 = createCsvWriter({
                      path: `${csvPath}/head${str}.csv`,
                      // path: `./data/back${str}.csv`, // 指定输出文件的路径和名称
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
                        console.log("导出csv成功！");
                        server.clients.forEach(function each(client) {
                          const jsonData = JSON.stringify({
                            download: "导出csv成功！",
                          });
                          if (client.readyState === WebSocket.OPEN) {
                            client.send(jsonData);
                          }
                        });
                      })
                      .catch((err) => {
                        console.error("导出csv失败：", err);
                        server.clients.forEach(function each(client) {
                          const jsonData = JSON.stringify({
                            download: "导出csv失败！",
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
                console.error(err);
                return;
              } else {
                server.clients.forEach(function each(client) {
                  const jsonData = JSON.stringify({
                    download: "删除成功",
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
                  console.error(err);
                  return;
                } else {
                  server.clients.forEach(function each(client) {
                    const jsonData = JSON.stringify({
                      download: "删除成功",
                    });
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });
                }
              });
            }
          }

          // 调整高斯
          if (getMessage.gauss != null) {
            gauss = getMessage.gauss;
          }

          // 重新请求串口
          if (getMessage.serialReset != null) {
            SerialPort.list().then((ports) => {
              serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');

              server.clients.forEach(function each(client) {
                /**
                 * 首次读取串口，将数据长度和串口端口数
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

          // 历史
          if (getMessage.indexArr != null) {

            let press = [],
              area = [];
            historyArr = getMessage.indexArr;
            for (let i = getMessage.indexArr[0]; i < getMessage.indexArr[1]; i++) {
              let a = localData.length
                ? JSON.parse(localData[i].data).reduce((a, b) => a + b, 0)
                : 0 +
                (file === "car"
                  ? JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                  : 0);
              let b = localData.length
                ? JSON.parse(localData[i].data).filter((a) => a > 10).length
                : 0 +
                (file === "car"
                  ? JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                  : 0);
              press.push(a);
              area.push(b);
            }

            server.clients.forEach(function each(client) {
              /**
               * 首次读取串口，将数据长度和串口端口数
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
  console.info(
    "=========================================================================================\r\n"
  );
  console.info(
    "hello ,there are serialport lists that we selected from your device\r\n"
  );
  // console.log(ports)
  serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');
  ports.forEach(function (port) {
    console.info("port:%s\r\n", port.path);
    // try {
    //   const port1 = new SerialPort(
    //     { path: "COM5", baudRate: baudRate, autoOpen: true },
    //     function (err) {
    //       console.log(err, "err");
    //     }
    //   );
    //   //管道添加解析器
    //   port1.pipe(parser);
    // } catch (e) {

    // }
  });
  console.info(
    "=========================================================================================\r\n"
  );
});

function gaussBlur_return(scl, w, h, r) {
  const res = new Array(scl.length).fill(1)
  var rs = Math.ceil(r * 2.57); // significant radius
  for (var i = 0; i < h; i++) {
    for (var j = 0; j < w; j++) {
      var val = 0,
        wsum = 0;
      for (var iy = i - rs; iy < i + rs + 1; iy++)
        for (var ix = j - rs; ix < j + rs + 1; ix++) {
          var x = Math.min(w - 1, Math.max(0, ix));
          var y = Math.min(h - 1, Math.max(0, iy));
          var dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          var wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
          val += scl[y * w + x] * wght;
          wsum += wght;
        }
      res[i * w + j] = Math.round(val / wsum);
    }
  }
  return res
}

var pointArr, newData, firstBlueData = [], lastBlueData = [], firstBlueData1 = [], lastBlueData1 = [];
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

      let jsonData;

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? pointArr : pointArr, hz: colHZ });
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
      //   const timestamp = Date.now(); // 获取当前时间的时间戳
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
      //         console.error(err);
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
        // 小型样品 - 按传感器编号1-100顺序输出10×10矩阵
        // Excel是16×16网格，对应256字节数据的顺序
        // 传感器编号N在Excel中的位置(row,col) -> 256字节索引 = row*16+col
        // 传感器1-100对应的256字节索引:
        const sensorToByteIndex = [
          223, 222, 221, 220, 219, 218, 217, 216, 215, 214,  // 传感器1-10   (行13, 刕15→06)
          239, 238, 237, 236, 235, 234, 233, 232, 231, 230,  // 传感器11-20  (行14, 刕15→06)
          255, 254, 253, 252, 251, 250, 249, 248, 247, 246,  // 传感器21-30  (行15, 刕15→06)
          15, 14, 13, 12, 11, 10, 9, 8, 7, 6,                // 传感器31-40  (行0,  刕15→06)
          31, 30, 29, 28, 27, 26, 25, 24, 23, 22,            // 传感器41-50  (行1,  刕15→06)
          207, 206, 205, 204, 203, 202, 201, 200, 199, 198,  // 传感器51-60  (行12, 刕15→06)
          191, 190, 189, 188, 187, 186, 185, 184, 183, 182,  // 传感器61-70  (行11, 刕15→06)
          175, 174, 173, 172, 171, 170, 169, 168, 167, 166,  // 传感器71-80  (行10, 刕15→06)
          159, 158, 157, 156, 155, 154, 153, 152, 151, 150,  // 传感器81-90  (行9,  刕15→06)
          143, 142, 141, 140, 139, 138, 137, 136, 135, 134,  // 传感器91-100 (行8,  刕15→06)
        ]
        const mappedArr = []
        for (let i = 0; i < 100; i++) {
          mappedArr.push(pointArr[sensorToByteIndex[i]] || 0)
        }
        pointArr = mappedArr
        newArr = [...mappedArr]
      } else if (file == 'hand0507' || file == 'hand0205' || file == 'Num3D') {
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
      // } else if (file == 'hand0507' || file == 'hand0205' || file == 'Num3D') {
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
    const timestamp = Date.now(); // 获取当前时间的时间戳
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    // 1.0 机器人之前
    // db.run(
    //   insertQuery,
    //   [file.includes('hand0205') ? JSON.stringify([...pointArr, ...rotate]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify(pointArr), timestamp, date],
    //   function (err) {
    //     if (err) {
    //       console.error(err);
    //       return;
    //     }
    //     console.log(`Event inserted with ID ${this.lastID}`);
    //   }
    // );

    db.run(
      insertQuery,
      [file.includes('hand0205') ? JSON.stringify([...JSON.parse(jsonData).newArr147, ...JSON.parse(jsonData).rotate]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify([...JSON.parse(jsonData).sitData]), timestamp, date],
      function (err) {
        if (err) {
          console.error(err);
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

// 处理串口数据

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

        const timestamp = Date.now(); // 获取当前时间的时间戳
        const date = saveTime;
        const insertQuery =
          "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

        db1.run(
          insertQuery,
          [JSON.stringify(pointArr2), timestamp, date],
          function (err) {
            if (err) {
              console.error(err);
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

      } else if (file == 'hand0507' || file == 'hand0205') {
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
    const timestamp = Date.now(); // 获取当前时间的时间戳
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    db1.run(
      insertQuery,
      [file.includes('hand0205') ? JSON.stringify([...JSON.parse(jsonData).newArr147, ...JSON.parse(jsonData).rotate]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify([...JSON.parse(jsonData).backData]), timestamp, date],
      function (err) {
        if (err) {
          console.error(err);
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
          // 右边线序

        }
        if (pointArr3[pointArr3.length - 1] == 1) {
          lastData = [...pointArr3];
          lastData.pop();
          // 添加
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
              const timestamp = Date.now(); // 获取当前时间的时间戳
              const date = saveTime;
              const insertQuery =
                "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";
              db.run(
                insertQuery,
                [JSON.stringify(res), timestamp, date],
                function (err) {
                  if (err) {
                    console.error(err);
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

        const timestamp = Date.now(); // 获取当前时间的时间戳
        const date = saveTime;
        const insertQuery =
          "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

        db2.run(
          insertQuery,
          [JSON.stringify(pointArr4), timestamp, date],
          function (err) {
            if (err) {
              console.error(err);
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

      } else if (file == 'hand0507' || file == 'hand0205') {
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
    const timestamp = Date.now(); // 获取当前时间的时间戳
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    db2.run(
      insertQuery,
      [file.includes('hand0205') ? JSON.stringify([...JSON.parse(jsonData).newArr147, ...JSON.parse(jsonData).rotate]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify([...JSON.parse(jsonData).backData]), timestamp, date],
      function (err) {
        if (err) {
          console.error(err);
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

// 重连
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
            console.log(err, "err");
          }
        );
        //管道添加解析器
        port1.pipe(parser);
      } catch (e) {
        console.log(e, "e");
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
            console.log(err, "err");
          }
        );
        //管道添加解析器
        port1.pipe(parser3);
      } catch (e) {
        console.log(e, "e");
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
          console.log(err, "err");
        }
      );
      //管道添加解析器
      port2.pipe(parser2);
    } catch (e) {
      console.log(e, "e");
    }
  }
}, 3000);

function gaussBlur_2(scl, w, h, r) {
  const tcl = new Array(scl.length).fill(1)
  var rs = Math.ceil(r * 2.57); // significant radius
  for (var i = 0; i < h; i++)
    for (var j = 0; j < w; j++) {
      var val = 0,
        wsum = 0;
      for (var iy = i - rs; iy < i + rs + 1; iy++)
        for (var ix = j - rs; ix < j + rs + 1; ix++) {
          var x = Math.min(w - 1, Math.max(0, ix));
          var y = Math.min(h - 1, Math.max(0, iy));
          var dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          var wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
          val += scl[y * w + x] * wght;
          wsum += wght;
        }
      tcl[i * w + j] = Math.round(val / wsum);
    }
  return tcl
}


function interpSmall(smallMat, width, height, interp1, interp2) {
  // for (let x = 1; x <= Length; x++) {
  //   for (let y = 1; y <= Length; y++) {
  //     bigMat[
  //       Length * num * (num * (y - 1)) +
  //       (Length * num * num) / 2 +
  //       num * (x - 1) +
  //       num / 2
  //     ] = smallMat[Length * (y - 1) + x - 1] * 10;
  //   }
  // }
  // 32, 10, 4, 5
  const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      bigMat[(width * interp1) * i * interp2 + (j * interp1)

        // + (width * interp1) * Math.floor(interp2/2)

        // + Math.floor(interp1/2)
      ] = smallMat[i * width + j] * 10
    }
  }
  // console.log(bigMat.length)
  return bigMat
}


function findMax(arr) {
  let max = 0;
  arr.forEach((item) => {
    max = max > item ? max : item;
  });
  return max;
}

function numLessZeroToZero(num) {
  return num < 0 ? 0 : num
}

// 初始化db
/**
 * 
 * @param {string} fileStr 传感器类型 
 * @returns db数据库
 */
function initDb(fileStr) {
  file = fileStr;
  let db, db1, db2
  console.log(isCar(file))
  if (isCar(file)) {
    db = genDb(`${filePath}/${file}sit.db`)
    db1 = genDb(`${filePath}/${file}back.db`)
  } else if (file == 'volvo') {
    db = genDb(`${filePath}/${file}sit.db`)
    db1 = genDb(`${filePath}/${file}back.db`)
    db2 = genDb(`${filePath}/${file}head.db`)
  }
  else {
    db = genDb(`${filePath}/${file}.db`)
  }
  return { db, db1, db2 }
}

// 当没有db文件的时候拷贝一个以init.db为原型的db文件

/**
 * 
 * @param {string} file 文件名 
 * @returns 返回db文件
 */
function genDb(file) {
  try {
    const fileExist = fs.accessSync(file)
    return db = new sqlite3.Database(file);
  } catch (err) {
    console.log(err)
    let data = fs.readFileSync(`${filePath}/init.db`);
    fs.writeFileSync(file, data);
    return db = new sqlite3.Database(file);
  }
}

function press6(arr, width, height, type = "row", value = (1245),) {
  let wsPointData = [...arr];

  if (type == "row") {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[i * width + j];
      }
      colArr.push(total);
    }

    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[i * width + j] = parseInt(
          (wsPointData[i * width + j] * 3 / 4 /
            (value - colArr[i] * 3 / 4 <= 0 ? 1 : value - colArr[i] * 3 / 4)) *
          1
        );
      }
    }
  } else {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[j * height + i];
      }
      colArr.push(total);
    }

    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] * 3 / 4 /
            (value - colArr[i] * 3 / 4 <= 0 ? 1 : value - colArr[i] * 3 / 4)) *
          1
        );
      }
    }
  }

  //////

  // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
  return wsPointData;
}

// 分压公式
function pressNew1220({ arr, width, height, type = "row", value }) {
  let wsPointData = [...arr];

  if (type == "row") {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[i * width + j];
      }
      colArr.push(total);
    }
    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {

        let den = wsPointData[i * width + j] + value - colArr[i]
        if (den <= 0) {
          den = 1
        }

        wsPointData[i * width + j] = parseInt(
          wsPointData[i * width + j] * value / den
        );
      }
    }
  } else {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[j * height + i];
      }
      colArr.push(total);
    }
    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let den = wsPointData[j * height + i] + value - colArr[i]
        if (den <= 0) {
          den = 1
        }

        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] * value / den) / 2
        );
      }
    }
  }

  //////

  // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
  return wsPointData;
}

function press6sit(arr, width, height, type = "row", value = (480),) {
  let wsPointData = [...arr];

  const props = 4

  // console.log(up, down)

  if (type == "row") {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[i * width + j];
      }
      colArr.push(total);
    }

    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[i * width + j] = parseInt(
          (wsPointData[i * width + j] * props / 4 /
            (value - colArr[i] * props / 4 <= 0 ? 1 : value - colArr[i] * props / 4)) *
          1000
        );
      }
    }
  } else {
    let colArr = [];
    for (let i = 0; i < height; i++) {
      let total = 0;
      for (let j = 0; j < width; j++) {
        total += wsPointData[j * height + i];
      }
      colArr.push(total);
    }
    // console.log(colArr)
    // //////okok
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        wsPointData[j * height + i] = parseInt(
          (wsPointData[j * height + i] * props / 4 /
            (value - colArr[i] * props / 4 <= 0 ? 1 : value - colArr[i] * props / 4)) *
          600
        );
      }
    }
  }

  //////

  // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
  return wsPointData;
}


function bytes4ToInt10(buffers) {
  // 示例：四个字节的数组 
  // const fourBytes = [0x40, 0x48, 0xF5, 0xC3];
  const res = []
  for (let i = 0; i < buffers.length / 4; i++) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    for (let j = 0; j < 4; j++) {
      // 创建一个 ArrayBuffer 并将四个字节写入其中 

      // 将四个字节写入 DataView 
      // for (let k = 0; k < 4; k++) {
      view.setUint8(j, buffers[i * 4 + j]);
      // }
      // 从 DataView 中读取浮点数 

    }
    const floatValue = view.getFloat32(0, true);
    // console.log(floatValue);
    res.push(floatValue)
  }
  return res
}

function arrToRealLine(arr, arrX, arrY, matrixLength) {
  const realX = [], realY = []
  arrX.forEach((a) => {
    if (Array.isArray(a)) {
      // for(let i = )
      if (a[0] > a[1]) {
        for (let i = a[0]; i >= a[1]; i--) {
          realX.push(i)
        }
      } else {
        for (let i = a[0]; i <= a[1]; i++) {
          realX.push(i)
        }
      }
    } else {
      realX.push(a)
    }
  })

  arrY.forEach((a) => {
    if (Array.isArray(a)) {
      // for(let i = )
      if (a[0] > a[1]) {
        for (let i = a[0]; i >= a[1]; i--) {
          realY.push(i)
        }
      } else {
        for (let i = a[0]; i <= a[1]; i++) {
          realY.push(i)
        }
      }
    } else {
      realY.push(a)
    }
  })

  let newArr = []
  for (let i = 0; i < realY.length; i++) {
    for (let j = 0; j < realX.length; j++) {
      const realXCoo = realY[i]
      const realYCoo = realX[j]
      newArr.push(arr[realXCoo * matrixLength + realYCoo])
    }
  }

  return newArr
}