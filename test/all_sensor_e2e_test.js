/**
 * 全传感器类型模拟串口端到端测试
 * 对每种传感器类型：切换传感器 → 连接虚拟串口 → 发送模拟数据 → 验证 WS 接收 → 截图
 */
const { _electron: electron } = require('playwright');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { sendData, SENSOR_CONFIG } = require('./all_sensor_simulator');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_all_sensors');
const REPORT_FILE = path.join(SCREENSHOT_DIR, 'all_sensor_report.json');
const WS_PORT = 19999;
const SERIAL_PORT_SIM = '/tmp/vserial_sit_sim';
const SERIAL_PORT_APP = '/tmp/vserial_sit_app';

// 要测试的传感器列表
const SENSORS_TO_TEST = [
  'hand0205',    // 触觉手套
  'robot1',      // 宇树G1触觉上衣
  'robotSY',     // 松延N2触觉上衣
  'robotLCF',    // 零次方H1触觉上衣
  'footVideo',   // 触觉足底
  'bed4096num',  // 4096数字
  'jqbed',       // 小床监测
  'bed4096',     // 4096
  'fast256',     // 16×16高速
  'fast1024',    // 32×32高速
  'daliegu',     // 14×20高速
  'normal',      // 正常测试
];

let results = [];
let electronApp, mainWindow;

function log(msg) {
  console.log(`[TEST ${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} timeout (${ms}ms)`)), ms))
  ]);
}

function record(name, pass, detail = '') {
  const r = { name, pass, detail, time: new Date().toISOString() };
  results.push(r);
  log(`${pass ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
  return r;
}

// 通过 WS 发送消息
function wsSend(ws, msg) {
  return new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WS not open'));
      return;
    }
    ws.send(msg, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 等待 WS 收到包含指定 key 的消息
function wsWaitForMessage(ws, key, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`WS wait for "${key}" timeout`));
    }, timeoutMs);

    function handler(data) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[key] !== undefined) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (e) { /* ignore non-JSON */ }
    }
    ws.on('message', handler);
  });
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, timeout: 5000 });
    log(`📸 ${name}.png`);
  } catch (e) {
    log(`⚠️ Screenshot failed: ${name} - ${e.message}`);
  }
}

async function startElectron() {
  log('Starting Electron...');
  electronApp = await electron.launch({
    args: ['--no-sandbox', '--disable-gpu', '.'],
    cwd: path.join(__dirname, '..'),
    timeout: 30000,
  });

  mainWindow = await electronApp.firstWindow({ timeout: 20000 });
  await mainWindow.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await sleep(3000);
  log('Electron started');
}

async function activateLicense(ws) {
  log('Activating license...');
  const module2 = require(path.join(__dirname, '..', 'aes_ecb'));
  const futureDate = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  const dateStr = futureDate.toISOString().split('T')[0];
  const encrypted = module2.encrypt(dateStr);
  await wsSend(ws, JSON.stringify({ date: encrypted }));
  await sleep(1000);
  log('License activated');
}

async function testSensor(ws, sensorType) {
  const config = SENSOR_CONFIG[sensorType];
  const label = config.label;
  const testPrefix = `[${sensorType}] ${label}`;

  log(`\n========== Testing: ${testPrefix} ==========`);

  // 1. 切换传感器类型
  try {
    await wsSend(ws, JSON.stringify({ file: sensorType }));
    await sleep(1500);
    record(`${testPrefix} - 切换传感器`, true, `file: ${sensorType}`);
  } catch (e) {
    record(`${testPrefix} - 切换传感器`, false, e.message);
    return;
  }

  // 2. 截图 - 切换后初始状态
  await screenshot(mainWindow, `${sensorType}_01_initial`);

  // 3. 连接虚拟串口
  try {
    await wsSend(ws, JSON.stringify({ sitPort: SERIAL_PORT_APP }));
    await sleep(2000);
    record(`${testPrefix} - 连接串口`, true, SERIAL_PORT_APP);
  } catch (e) {
    record(`${testPrefix} - 连接串口`, false, e.message);
    return;
  }

  // 4. 发送模拟数据并验证 WS 接收
  try {
    const dataPromise = wsWaitForMessage(ws, 'sitData', 15000);
    
    // 异步发送数据
    const sendPromise = sendData(SERIAL_PORT_SIM, sensorType, 15, 100);

    const received = await withTimeout(dataPromise, 15000, 'WS receive');
    
    if (received.sitData && received.sitData.length > 0) {
      const dataLen = received.sitData.length;
      const maxVal = Math.max(...received.sitData);
      record(`${testPrefix} - 数据接收`, true, `len=${dataLen}, max=${maxVal}`);
    } else {
      record(`${testPrefix} - 数据接收`, false, 'Empty sitData');
    }

    await sendPromise.catch(() => {});
  } catch (e) {
    record(`${testPrefix} - 数据接收`, false, e.message);
  }

  // 5. 等待 UI 渲染
  await sleep(2000);

  // 6. 截图 - 数据渲染后
  await screenshot(mainWindow, `${sensorType}_02_data`);

  // 7. 对于有蓝牙帧的传感器，验证手部数据
  if (config.frames.includes('130') && config.frames.includes('146')) {
    try {
      const handPromise = wsWaitForMessage(ws, 'handData', 5000);
      // 再发一轮数据
      await sendData(SERIAL_PORT_SIM, sensorType, 5, 100);
      const handMsg = await withTimeout(handPromise, 5000, 'hand data');
      if (handMsg.handData) {
        record(`${testPrefix} - 手部蓝牙数据`, true, `handData received`);
      } else {
        record(`${testPrefix} - 手部蓝牙数据`, false, 'No handData');
      }
    } catch (e) {
      record(`${testPrefix} - 手部蓝牙数据`, false, e.message);
    }
  }

  // 8. 断开串口
  try {
    await wsSend(ws, JSON.stringify({ sitPort: 'close' }));
    await sleep(1000);
    record(`${testPrefix} - 断开串口`, true);
  } catch (e) {
    record(`${testPrefix} - 断开串口`, false, e.message);
  }

  log(`========== Done: ${testPrefix} ==========\n`);
}

async function main() {
  // 准备截图目录
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  try {
    // 启动 Electron
    await startElectron();
    await screenshot(mainWindow, '00_startup');

    // 连接 WS
    log('Connecting to WS...');
    const ws = await withTimeout(
      new Promise((resolve, reject) => {
        const w = new WebSocket(`ws://localhost:${WS_PORT}`);
        w.on('open', () => resolve(w));
        w.on('error', reject);
      }),
      10000,
      'WS connect'
    );
    log('WS connected');
    await sleep(1000);

    // 激活 License
    await activateLicense(ws);

    // 逐个测试每种传感器
    for (const sensorType of SENSORS_TO_TEST) {
      try {
        await testSensor(ws, sensorType);
      } catch (e) {
        record(`[${sensorType}] 测试异常`, false, e.message);
      }
      await sleep(1000);
    }

    // 关闭 WS
    ws.close();

  } catch (e) {
    log(`Fatal error: ${e.message}`);
    record('测试框架', false, e.message);
  } finally {
    // 关闭 Electron
    if (electronApp) {
      try { await electronApp.close(); } catch (e) {}
    }
  }

  // 生成报告
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const report = {
    summary: { total: results.length, passed, failed },
    results,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  log('\n============================');
  log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  log('============================');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
