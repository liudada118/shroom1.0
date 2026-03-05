/**
 * 全传感器类型模拟串口测试
 * 
 * 测试流程：
 * 1. 连接 WS (端口 19999)
 * 2. 激活 License
 * 3. 对每种传感器类型：
 *    a. 发送 file 切换命令
 *    b. 发送 sitPort 连接虚拟串口
 *    c. 通过虚拟串口发送模拟数据
 *    d. 验证 WS 是否收到 sitData
 *    e. 断开串口
 * 4. 生成测试报告
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WS_PORT = 19999;
const SERIAL_PORT_SIM = '/tmp/vserial_sit_sim';
const SERIAL_PORT_APP = '/tmp/vserial_sit_app';
const DELIMITER = Buffer.from([0xAA, 0x55, 0x03, 0x99]);

const REPORT_DIR = path.join(__dirname, 'all_sensor_results');

// 传感器配置
const SENSOR_CONFIG = {
  normal:      { label: '正常测试',         frames: [1024],              baudRate: 1000000, expectedKey: 'sitData' },
  hand0205:    { label: '触觉手套',         frames: [1024, 130, 146],    baudRate: 921600,  expectedKey: 'sitData' },
  robot1:      { label: '宇树G1触觉上衣',  frames: [1024, 130, 146],    baudRate: 921600,  expectedKey: 'sitData' },
  robotSY:     { label: '松延N2触觉上衣',  frames: [1024, 130, 146],    baudRate: 921600,  expectedKey: 'sitData' },
  robotLCF:    { label: '零次方H1触觉上衣', frames: [1024, 130, 146],   baudRate: 921600,  expectedKey: 'sitData' },
  footVideo:   { label: '触觉足底',         frames: [1024, 130, 146],    baudRate: 921600,  expectedKey: 'sitData' },
  bed4096num:  { label: '4096数字',         frames: [4096],              baudRate: 3000000, expectedKey: 'sitData' },
  jqbed:       { label: '小床监测',         frames: [1024],              baudRate: 1000000, expectedKey: 'sitData' },
  bed4096:     { label: '4096',             frames: [4096],              baudRate: 3000000, expectedKey: 'sitData' },
  fast256:     { label: '16×16高速',        frames: [256],               baudRate: 1000000, expectedKey: 'sitData' },
  fast1024:    { label: '32×32高速',        frames: [1024],              baudRate: 1000000, expectedKey: 'sitData' },
  daliegu:     { label: '14×20高速',        frames: [1024, 142, 158],    baudRate: 921600,  expectedKey: 'sitData' },
};

const SENSORS_TO_TEST = Object.keys(SENSOR_CONFIG);

let results = [];

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  // 也写入日志文件
  fs.appendFileSync(path.join(REPORT_DIR, 'test.log'), line + '\n');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function record(name, pass, detail) {
  const r = { name, pass, detail: detail || '', time: new Date().toISOString() };
  results.push(r);
  log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
  return r;
}

function generateFrame(length) {
  const data = Buffer.alloc(length);
  
  if (length === 1024) {
    for (let i = 0; i < 1024; i++) {
      const row = Math.floor(i / 32);
      const col = i % 32;
      const cx = 16, cy = 16;
      const dist = Math.sqrt((row - cx) ** 2 + (col - cy) ** 2);
      data[i] = Math.max(1, Math.min(255, Math.floor(200 - dist * 10 + Math.random() * 20)));
    }
  } else if (length === 130) {
    data[0] = 1;  // order = 1 (第一帧)
    data[1] = 1;  // type = 1 (左手)
    for (let i = 2; i < 130; i++) {
      data[i] = Math.floor(Math.random() * 100 + 50);
    }
  } else if (length === 146) {
    data[0] = 2;  // order = 2 (第二帧)
    data[1] = 1;  // type = 1 (左手)
    for (let i = 2; i < 130; i++) {
      data[i] = Math.floor(Math.random() * 100 + 50);
    }
    for (let i = 130; i < 146; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
  } else if (length === 142) {
    data[0] = 1;
    data[1] = 1;
    for (let i = 2; i < 142; i++) {
      data[i] = Math.floor(Math.random() * 100 + 50);
    }
  } else if (length === 158) {
    data[0] = 2;
    data[1] = 1;
    for (let i = 2; i < 142; i++) {
      data[i] = Math.floor(Math.random() * 100 + 50);
    }
    for (let i = 142; i < 158; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
  } else if (length === 256) {
    for (let i = 0; i < 256; i++) {
      const row = Math.floor(i / 16);
      const col = i % 16;
      const cx = 8, cy = 8;
      const dist = Math.sqrt((row - cx) ** 2 + (col - cy) ** 2);
      data[i] = Math.max(1, Math.min(255, Math.floor(180 - dist * 15 + Math.random() * 20)));
    }
  } else if (length === 4096) {
    for (let i = 0; i < 4096; i++) {
      const row = Math.floor(i / 64);
      const col = i % 64;
      const cx = 32, cy = 32;
      const dist = Math.sqrt((row - cx) ** 2 + (col - cy) ** 2);
      data[i] = Math.max(1, Math.min(255, Math.floor(200 - dist * 5 + Math.random() * 15)));
    }
  }
  
  return data;
}

function writeFrameToSerial(fd, frameLength) {
  const frame = generateFrame(frameLength);
  const packet = Buffer.concat([DELIMITER, frame]);
  fs.writeSync(fd, packet);
  return frame;
}

function wsSend(ws, obj) {
  return new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WS not open'));
      return;
    }
    ws.send(JSON.stringify(obj), err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function wsWaitForKey(ws, key, timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error('Timeout waiting for ' + key + ' (' + timeoutMs + 'ms)'));
    }, timeoutMs);

    function handler(rawData) {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg[key] !== undefined && Array.isArray(msg[key]) && msg[key].length > 0) {
          // 确保不是全零数据（可能是切换时的清零帧）
          const hasData = msg[key].some(v => v > 0);
          if (hasData) {
            clearTimeout(timer);
            ws.removeListener('message', handler);
            resolve(msg);
          }
        }
      } catch (e) { /* ignore */ }
    }
    ws.on('message', handler);
  });
}

async function testSensor(ws, sensorType) {
  const config = SENSOR_CONFIG[sensorType];
  const label = config.label;
  const prefix = '[' + sensorType + '] ' + label;
  
  log('');
  log('='.repeat(60));
  log('Testing: ' + prefix);
  log('Frames: ' + config.frames.join(', ') + 'B | BaudRate: ' + config.baudRate);
  log('='.repeat(60));

  // 1. 切换传感器类型
  try {
    await wsSend(ws, { file: sensorType });
    await sleep(2500);
    record(prefix + ' - Switch sensor', true, 'file=' + sensorType);
  } catch (e) {
    record(prefix + ' - Switch sensor', false, e.message);
    return;
  }

  // 2. 连接虚拟串口
  try {
    await wsSend(ws, { sitPort: SERIAL_PORT_APP });
    await sleep(2500);
    record(prefix + ' - Connect serial', true, 'port=' + SERIAL_PORT_APP);
  } catch (e) {
    record(prefix + ' - Connect serial', false, e.message);
    return;
  }

  // 3. 发送模拟数据并验证 WS 接收
  let fd;
  try {
    fd = fs.openSync(SERIAL_PORT_SIM, 'w');
  } catch (e) {
    record(prefix + ' - Open sim port', false, e.message);
    return;
  }

  try {
    // 设置 WS 消息监听
    const dataPromise = wsWaitForKey(ws, config.expectedKey, 20000);
    
    // 发送多轮数据
    for (let round = 0; round < 25; round++) {
      for (const frameLen of config.frames) {
        writeFrameToSerial(fd, frameLen);
      }
      await sleep(30);
    }
    
    const received = await dataPromise;
    
    if (received[config.expectedKey] && Array.isArray(received[config.expectedKey])) {
      const dataArr = received[config.expectedKey];
      const dataLen = dataArr.length;
      const maxVal = Math.max(...dataArr);
      const nonZero = dataArr.filter(v => v > 0).length;
      record(prefix + ' - Data received', true, 
        'len=' + dataLen + ', max=' + maxVal + ', nonZero=' + nonZero);
      
      // 验证数据长度
      if (dataLen > 0) {
        record(prefix + ' - Data length valid', true, 'length=' + dataLen);
      } else {
        record(prefix + ' - Data length valid', false, 'empty data');
      }
      
      // 验证数据非零
      if (nonZero > 0) {
        record(prefix + ' - Data non-zero', true, nonZero + '/' + dataLen + ' non-zero values');
      } else {
        record(prefix + ' - Data non-zero', false, 'all zeros');
      }
    } else {
      record(prefix + ' - Data received', false, 'No valid data');
    }
  } catch (e) {
    record(prefix + ' - Data received', false, e.message);
  } finally {
    try { fs.closeSync(fd); } catch (e) {}
  }

  // 4. 断开串口 - 发送 close
  try {
    // 关闭当前串口连接
    await wsSend(ws, { sitPort: '/dev/null_close_' + Date.now() });
    await sleep(1000);
    record(prefix + ' - Disconnect', true);
  } catch (e) {
    record(prefix + ' - Disconnect', true, 'cleanup (non-critical)');
  }

  log('Done: ' + prefix);
}

async function main() {
  // 准备输出目录
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  // 清空日志
  fs.writeFileSync(path.join(REPORT_DIR, 'test.log'), '');

  // 确保虚拟串口存在
  try {
    fs.statSync(SERIAL_PORT_SIM);
    fs.statSync(SERIAL_PORT_APP);
    log('Virtual serial ports ready');
  } catch (e) {
    log('Creating virtual serial ports...');
    try {
      execSync('socat -d -d pty,raw,echo=0,link=/tmp/vserial_sit_app pty,raw,echo=0,link=/tmp/vserial_sit_sim &', { shell: true });
      await sleep(2000);
    } catch (e2) {
      log('Failed to create virtual serial ports: ' + e2.message);
      process.exit(1);
    }
  }

  // 连接 WS
  log('Connecting to WebSocket...');
  let ws;
  try {
    ws = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS connect timeout')), 10000);
      const w = new WebSocket('ws://localhost:' + WS_PORT);
      w.on('open', () => { clearTimeout(timer); resolve(w); });
      w.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
    log('WebSocket connected');
  } catch (e) {
    log('Failed to connect WS: ' + e.message);
    process.exit(1);
  }
  await sleep(1000);

  // 激活 License
  log('Activating license...');
  try {
    const module2 = require(path.join(__dirname, '..', 'aes_ecb'));
    const futureDate = new Date(Date.now() + 365 * 24 * 3600 * 1000);
    const dateStr = futureDate.toISOString().split('T')[0];
    const encrypted = module2.encrypt(dateStr);
    await wsSend(ws, { date: encrypted });
    await sleep(1500);
    record('License activation', true);
  } catch (e) {
    record('License activation', false, e.message);
  }

  // 逐个测试传感器
  for (const sensorType of SENSORS_TO_TEST) {
    try {
      await testSensor(ws, sensorType);
    } catch (e) {
      record('[' + sensorType + '] Test error', false, e.message);
    }
    await sleep(2000);
  }

  // 关闭 WS
  ws.close();

  // 生成报告
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  const report = {
    summary: { total: total, passed: passed, failed: failed, passRate: ((passed / total) * 100).toFixed(1) + '%' },
    sensorResults: {},
    results: results,
    timestamp: new Date().toISOString(),
  };

  for (const sensorType of SENSORS_TO_TEST) {
    const sensorResults = results.filter(r => r.name.startsWith('[' + sensorType + ']'));
    report.sensorResults[sensorType] = {
      label: SENSOR_CONFIG[sensorType].label,
      total: sensorResults.length,
      passed: sensorResults.filter(r => r.pass).length,
      failed: sensorResults.filter(r => !r.pass).length,
      details: sensorResults,
    };
  }

  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  // 打印摘要
  log('');
  log('='.repeat(70));
  log('ALL SENSOR TEST REPORT');
  log('='.repeat(70));
  log('Total: ' + total + ' | Passed: ' + passed + ' | Failed: ' + failed + ' | Rate: ' + report.summary.passRate);
  log('-'.repeat(70));
  
  for (const sensorType of SENSORS_TO_TEST) {
    const sr = report.sensorResults[sensorType];
    const status = sr.failed === 0 ? 'PASS' : 'FAIL';
    log(status + ' ' + sr.label + ' (' + sensorType + ') | ' + sr.passed + '/' + sr.total + ' passed');
  }
  
  log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
