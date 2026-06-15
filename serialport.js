/**
 * https://serialport.io/docs/guide-errors  you can find serialport document from the url
 * npm install -g @serialport/list or @serialport/terminal or  serialport-repl  you can install a software that make you get serialport list
 * @author icezhang
 */
const { SerialPort } = require('serialport');
const WebSocket = require('ws');
var dgram = require('dgram');
var udp_client = dgram.createSocket('udp4');
const { DelimiterParser } = require("@serialport/parser-delimiter");
/**
 * there are serveral Parsers that parse the serialport data
 *
 * const Readline = require('@serialport/parser-readline')
 * const parser = new Readline()
 * const ByteLength = require('@serialport/parser-byte-length')
 * const parser = new ByteLength({length: 1025})
 * const Delimiter = require('@serialport/parser-delimiter')
 * let splitBuffer = Buffer.from([0x68, 0x65 ,0x6C,0x6C ,0x6F ,0x77 ,0x6F ,0x72 ,0x6C ,0x64]);
 * @author icezhang
 */

//声明串口数据  分行解析器
var pointArr = new Array();
var pointArr2 = new Array();
// const Readline = require('@serialport/parser-readline')
// const parser = new Readline()

let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
const parser = new DelimiterParser({ delimiter: splitBuffer });
//串口初始化
// const SerialPort = require('serialport')

SerialPort.list().then((ports) => {
  console.info(
    '=========================================================================================\r\n'
  );
  console.info(
    'hello ,there are serialport lists that we selected from your device\r\n'
  );
  ports.forEach(function (port) {
    console.info('port:%s\r\n', port.path);
    try {
      const port1 = new SerialPort(
        { path: 'COM5', baudRate: 1000000, autoOpen: true },
        function (err) {
          console.log(err, 'err');
        }
      );
      //管道添加解析器
      port1.pipe(parser);
    } catch (e) {
      console.log(e, 'e');
    }
  });
  console.info(
    '=========================================================================================\r\n'
  );
});


parser.on('data', function (data) {
  let buffer = Buffer.from(data);

  console.info(buffer.length);
  if (buffer.length === buffer.length) {
    for (var i = 0; i < buffer.length; i++) {
      pointArr[i] = buffer.readUInt8(i);
    }
    let jsonData = JSON.stringify({ data: pointArr });
    console.log(jsonData)
  }
});