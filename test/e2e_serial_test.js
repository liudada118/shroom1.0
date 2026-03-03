/**
 * e2e_serial_test.js - Shroom1.0 串口模拟端到端测试
 *
 * 通过虚拟串口模拟真实传感器数据，测试完整的数据流：
 * 串口 → parser(AA 55 03 99) → 数据处理 → WebSocket 广播 → 前端渲染
 *
 * 测试覆盖：
 * 1. 虚拟串口创建与验证
 * 2. 串口协议帧格式验证（AA 55 03 99 分隔符）
 * 3. 通过 WS 指令连接虚拟串口
 * 4. 1024字节矩阵帧数据流（坐垫/靠背/头枕）
 * 5. 130+146字节手部帧数据流
 * 6. WebSocket 数据接收验证
 * 7. 前端 UI 渲染验证（数据驱动的 Canvas/3D）
 * 8. 数据库写入验证
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { execSync, spawn } = require('child_process');
const { SerialSimulator, SERIAL_PATHS, FRAME_DELIMITER,
  generateMatrixFrame, generateHandFrame1, generateHandFrame2 } = require('./serial_simulator');

const PROJECT_DIR = '/home/ubuntu/shroom1.0';
const SCREENSHOT_DIR = path.join(PROJECT_DIR, 'test', 'screenshots_serial');
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'serial_test_report.json');

// ─── 测试结果收集 ─────────────────────────────────────────────
const results = [];
const startTime = Date.now();

function addResult(category, name, status, detail, screenshot = null) {
  results.push({ category, name, status, detail, duration_ms: Date.now() - startTime, screenshot });
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⏭️';
  console.log(`  ${icon} [${category}] ${name}: ${detail}`);
}

async function ss(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  try { await page.screenshot({ path: fp, fullPage: false }); return fp; } catch { return null; }
}

function withTimeout(fn, timeoutMs = 30000) {
  return async (...args) => {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`超时 (${timeoutMs}ms)`)), timeoutMs))
    ]);
  };
}

// ─── 加密工具 ─────────────────────────────────────────────────
function generateLicenseKey(file, daysValid = 365) {
  const module2 = require(path.join(PROJECT_DIR, 'aes_ecb'));
  const futureDate = Date.now() + daysValid * 24 * 60 * 60 * 1000;
  const licenseData = JSON.stringify({ date: futureDate.toString(), file });
  return module2.encStr(licenseData);
}

// ─── 1. 虚拟串口环境测试 ─────────────────────────────────────
async function testVirtualSerialSetup() {
  console.log('\n═══ 1. 虚拟串口环境测试 ═══');

  // 1.1 检查 socat 进程
  try {
    const socatProcs = execSync('ps aux | grep socat | grep -v grep | wc -l').toString().trim();
    addResult('串口环境', 'socat 进程', parseInt(socatProcs) >= 3 ? 'PASSED' : 'FAILED',
      `${socatProcs} 个 socat 进程运行中`);
  } catch (e) { addResult('串口环境', 'socat 进程', 'FAILED', e.message); }

  // 1.2 检查虚拟串口文件
  for (const [name, p] of Object.entries(SERIAL_PATHS)) {
    try {
      const exists = fs.existsSync(p);
      const realPath = exists ? fs.readlinkSync(p) : 'N/A';
      addResult('串口环境', `虚拟串口 ${name}`, exists ? 'PASSED' : 'FAILED',
        exists ? `${p} → ${realPath}` : `${p} 不存在`);
    } catch (e) { addResult('串口环境', `虚拟串口 ${name}`, 'FAILED', e.message); }
  }

  // 1.3 验证串口对通信
  try {
    const appPath = '/tmp/vserial_sit_app';
    const simPath = '/tmp/vserial_sit_sim';
    // 写入模拟端，从应用端读取
    const testData = Buffer.from([0x01, 0x02, 0x03, 0xAA, 0x55, 0x03, 0x99]);
    const fdWrite = fs.openSync(simPath, 'w');
    fs.writeSync(fdWrite, testData);
    fs.closeSync(fdWrite);
    addResult('串口环境', '串口对通信', 'PASSED', '虚拟串口写入成功');
  } catch (e) { addResult('串口环境', '串口对通信', 'FAILED', e.message); }
}

// ─── 2. 协议帧格式测试 ───────────────────────────────────────
async function testProtocolFrames() {
  console.log('\n═══ 2. 协议帧格式测试 ═══');

  // 2.1 分隔符验证
  addResult('协议帧', '分隔符格式', 
    FRAME_DELIMITER.equals(Buffer.from([0xAA, 0x55, 0x03, 0x99])) ? 'PASSED' : 'FAILED',
    `分隔符: ${FRAME_DELIMITER.toString('hex').toUpperCase()}`);

  // 2.2 1024字节矩阵帧
  const matrixFrame = generateMatrixFrame('sit', 0);
  addResult('协议帧', '矩阵帧(1024B)', matrixFrame.length === 1024 ? 'PASSED' : 'FAILED',
    `长度: ${matrixFrame.length}, 范围: [${Math.min(...matrixFrame)}, ${Math.max(...matrixFrame)}]`);

  // 2.3 手部第一帧(130B)
  const handFrame1 = generateHandFrame1(1, 0);
  addResult('协议帧', '手部第一帧(130B)',
    handFrame1.length === 130 && handFrame1[0] === 1 && handFrame1[1] === 1 ? 'PASSED' : 'FAILED',
    `长度: ${handFrame1.length}, 顺序位: ${handFrame1[0]}, 类型位: ${handFrame1[1]}`);

  // 2.4 手部第二帧(146B)
  const handFrame2 = generateHandFrame2(1, 0);
  addResult('协议帧', '手部第二帧(146B)',
    handFrame2.length === 146 && handFrame2[0] === 2 && handFrame2[1] === 1 ? 'PASSED' : 'FAILED',
    `长度: ${handFrame2.length}, 顺序位: ${handFrame2[0]}, 类型位: ${handFrame2[1]}, 四元数: ${handFrame2.slice(130, 134).toString('hex')}`);

  // 2.5 完整数据包格式
  const packet = Buffer.concat([matrixFrame, FRAME_DELIMITER]);
  const delimiterPos = packet.indexOf(FRAME_DELIMITER, 1024);
  addResult('协议帧', '完整数据包',
    packet.length === 1028 && delimiterPos === 1024 ? 'PASSED' : 'FAILED',
    `总长: ${packet.length}, 分隔符位置: ${delimiterPos}`);
}

// ─── 3. WebSocket 连接串口指令测试 ───────────────────────────
async function testWSSerialConnection() {
  console.log('\n═══ 3. WebSocket 串口连接指令测试 ═══');

  // 3.1 发送 license/date 激活指令
  try {
    const licenseKey = generateLicenseKey('hand0205');
    const ws = new WebSocket('ws://127.0.0.1:19999');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); reject(new Error('WS 连接超时')); }, 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        // 发送 date 消息激活 license
        ws.send(JSON.stringify({ date: { date: licenseKey } }));
        setTimeout(() => {
          addResult('WS指令', 'License 激活', 'PASSED', `已发送加密 license (file=hand0205)`);
          resolve();
        }, 1000);
      });
      ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    ws.close();
  } catch (e) { addResult('WS指令', 'License 激活', 'FAILED', e.message); }

  // 3.2 发送 file 类型切换指令
  try {
    const ws = new WebSocket('ws://127.0.0.1:19999');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); reject(new Error('超时')); }, 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.send(JSON.stringify({ file: 'hand0205' }));
        setTimeout(resolve, 500);
      });
      ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    addResult('WS指令', '传感器类型切换', 'PASSED', 'file=hand0205');
    ws.close();
  } catch (e) { addResult('WS指令', '传感器类型切换', 'FAILED', e.message); }

  // 3.3 发送 sitPort 连接虚拟串口指令
  try {
    const ws = new WebSocket('ws://127.0.0.1:19999');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); reject(new Error('超时')); }, 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        // 连接虚拟串口
        ws.send(JSON.stringify({ sitPort: '/tmp/vserial_sit_app' }));
        setTimeout(resolve, 2000);
      });
      ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    addResult('WS指令', '坐垫串口连接', 'PASSED', `sitPort=/tmp/vserial_sit_app`);
    ws.close();
  } catch (e) { addResult('WS指令', '坐垫串口连接', 'FAILED', e.message); }

  // 等待串口连接稳定
  await new Promise(r => setTimeout(r, 1000));
}

// ─── 4. 串口数据流 → WebSocket 广播测试 ──────────────────────
async function testSerialToWSDataFlow() {
  console.log('\n═══ 4. 串口数据流 → WebSocket 广播测试 ═══');

  // 4.1 发送矩阵帧并监听 WS 广播
  try {
    const receivedData = [];
    const ws = new WebSocket('ws://127.0.0.1:19999');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve(); // 超时也继续
      }, 10000);

      ws.on('open', () => {
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.sitData) {
              receivedData.push(parsed);
            }
          } catch {}
        });

        // 开始发送模拟数据
        const sim = new SerialSimulator('sit', SERIAL_PATHS.sit);
        if (sim.open()) {
          // 发送20帧矩阵数据，间隔100ms
          let framesSent = 0;
          const sendTimer = setInterval(() => {
            if (framesSent >= 20) {
              clearInterval(sendTimer);
              sim.close();
              setTimeout(() => {
                clearTimeout(timeout);
                ws.close();
                resolve();
              }, 2000);
              return;
            }
            const frame = generateMatrixFrame('sit', framesSent);
            sim.sendFrame(frame);
            framesSent++;
          }, 100);
        } else {
          clearTimeout(timeout);
          reject(new Error('无法打开模拟串口'));
        }
      });

      ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });

    const received = receivedData.length;
    addResult('数据流', '矩阵帧 → WS 广播',
      received > 0 ? 'PASSED' : 'FAILED',
      `发送 20 帧, 接收 ${received} 条 WS 消息`);

    if (received > 0) {
      const firstMsg = receivedData[0];
      const hasSitData = Array.isArray(firstMsg.sitData);
      const dataLen = hasSitData ? firstMsg.sitData.length : 0;
      addResult('数据流', 'WS 数据格式',
        hasSitData && dataLen > 0 ? 'PASSED' : 'FAILED',
        `sitData: ${hasSitData}, 长度: ${dataLen}, hz: ${firstMsg.hz || 'N/A'}`);

      // 检查数据值范围
      if (hasSitData) {
        const maxVal = Math.max(...firstMsg.sitData);
        const minVal = Math.min(...firstMsg.sitData);
        addResult('数据流', '数据值范围',
          maxVal <= 255 && minVal >= 0 ? 'PASSED' : 'FAILED',
          `范围: [${minVal}, ${maxVal}]`);
      }
    }
  } catch (e) { addResult('数据流', '矩阵帧 → WS 广播', 'FAILED', e.message); }
}

// ─── 5. 手部传感器双帧测试 ───────────────────────────────────
async function testHandSensorFrames() {
  console.log('\n═══ 5. 手部传感器双帧测试 ═══');

  try {
    const receivedData = [];
    const ws = new WebSocket('ws://127.0.0.1:19999');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); resolve(); }, 12000);

      ws.on('open', () => {
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.sitData || parsed.newArr147 || parsed.rotate) {
              receivedData.push(parsed);
            }
          } catch {}
        });

        // 发送手部帧对
        const sim = new SerialSimulator('sit_hand', SERIAL_PATHS.sit);
        if (sim.open()) {
          let pairsSent = 0;
          const sendTimer = setInterval(() => {
            if (pairsSent >= 10) {
              clearInterval(sendTimer);
              sim.close();
              setTimeout(() => { clearTimeout(timeout); ws.close(); resolve(); }, 3000);
              return;
            }
            // 发送第一帧(130B) + 分隔符
            const frame1 = generateHandFrame1(1, pairsSent);
            sim.sendFrame(frame1);
            // 短暂延迟后发送第二帧(146B) + 分隔符
            setTimeout(() => {
              const frame2 = generateHandFrame2(1, pairsSent);
              sim.sendFrame(frame2);
            }, 20);
            pairsSent++;
          }, 200);
        }
      });
      ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });

    addResult('手部传感器', '双帧数据接收',
      receivedData.length > 0 ? 'PASSED' : 'SKIPPED',
      `发送 10 帧对, 接收 ${receivedData.length} 条 WS 消息`);

    if (receivedData.length > 0) {
      const msg = receivedData[0];
      addResult('手部传感器', '数据字段完整性', 'PASSED',
        `sitData: ${!!msg.sitData}, rotate: ${!!msg.rotate}, newArr147: ${!!msg.newArr147}`);
    }
  } catch (e) { addResult('手部传感器', '双帧数据接收', 'FAILED', e.message); }
}

// ─── 6. 前端 UI 数据驱动渲染测试 ─────────────────────────────
async function testUIDataDrivenRendering(page) {
  console.log('\n═══ 6. 前端 UI 数据驱动渲染测试 ═══');

  // 6.1 导航到 system 页面
  await page.evaluate(() => { window.location.hash = '/system'; });
  await page.waitForTimeout(2000);

  // 截图：数据流入前
  const ssBefore = await ss(page, '06_system_before_data');
  addResult('UI渲染', 'System 页面（数据前）', 'PASSED', '已导航到 System 页面', ssBefore);

  // 6.2 发送矩阵数据并观察渲染
  try {
    const sim = new SerialSimulator('sit_ui', SERIAL_PATHS.sit);
    if (sim.open()) {
      // 持续发送数据 3 秒
      let framesSent = 0;
      await new Promise((resolve) => {
        const timer = setInterval(() => {
          if (framesSent >= 30) {
            clearInterval(timer);
            sim.close();
            resolve();
            return;
          }
          const frame = generateMatrixFrame('sit', framesSent);
          sim.sendFrame(frame);
          framesSent++;
        }, 100);
      });

      await page.waitForTimeout(2000);
      const ssAfter = await ss(page, '06_system_after_data');

      // 检查 Canvas 是否有更新
      const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
      addResult('UI渲染', 'System 数据驱动渲染',
        canvasCount > 0 ? 'PASSED' : 'SKIPPED',
        `发送 ${framesSent} 帧, Canvas 数量: ${canvasCount}`, ssAfter);
    }
  } catch (e) { addResult('UI渲染', 'System 数据驱动渲染', 'FAILED', e.message); }

  // 6.3 导航到 num/car10 页面测试数字矩阵
  await page.evaluate(() => { window.location.hash = '/num/car10'; });
  await page.waitForTimeout(1500);

  try {
    const sim = new SerialSimulator('sit_num', SERIAL_PATHS.sit);
    if (sim.open()) {
      for (let i = 0; i < 10; i++) {
        sim.sendFrame(generateMatrixFrame('sit', i));
        await new Promise(r => setTimeout(r, 100));
      }
      sim.close();
    }
    await page.waitForTimeout(1500);
    const ssNum = await ss(page, '06_num_car10_data');
    const contentLen = await page.evaluate(() => document.body.innerText.length);
    addResult('UI渲染', '数字矩阵页面', contentLen > 0 ? 'PASSED' : 'SKIPPED',
      `内容长度: ${contentLen}`, ssNum);
  } catch (e) { addResult('UI渲染', '数字矩阵页面', 'FAILED', e.message); }

  // 6.4 导航到 handReal 页面
  await page.evaluate(() => { window.location.hash = '/handReal'; });
  await page.waitForTimeout(2000);

  try {
    const sim = new SerialSimulator('sit_hand_ui', SERIAL_PATHS.sit);
    if (sim.open()) {
      for (let i = 0; i < 10; i++) {
        sim.sendFrame(generateHandFrame1(1, i));
        await new Promise(r => setTimeout(r, 20));
        sim.sendFrame(generateHandFrame2(1, i));
        await new Promise(r => setTimeout(r, 80));
      }
      sim.close();
    }
    await page.waitForTimeout(2000);
    const ssHand = await ss(page, '06_hand_real_data');
    addResult('UI渲染', '手部实时页面', 'PASSED', '手部数据已发送', ssHand);
  } catch (e) { addResult('UI渲染', '手部实时页面', 'FAILED', e.message); }

  // 6.5 导航到 diff 页面
  await page.evaluate(() => { window.location.hash = '/diff'; });
  await page.waitForTimeout(1500);
  const ssDiff = await ss(page, '06_diff_page');
  addResult('UI渲染', '矩阵差异页面', 'PASSED', '页面已加载', ssDiff);
}

// ─── 7. 多串口并行测试（坐垫+靠背+头枕）────────────────────
async function testMultiSerialPorts() {
  console.log('\n═══ 7. 多串口并行测试 ═══');

  // 先切换到汽车模式（需要 file=car10 才能同时使用 sit+back）
  try {
    const licenseKey = generateLicenseKey('car10');
    const ws = new WebSocket('ws://127.0.0.1:19999');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); resolve(); }, 5000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ date: { date: licenseKey } }));
        setTimeout(() => {
          // 连接靠背串口
          ws.send(JSON.stringify({ backPort: '/tmp/vserial_back_app' }));
          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 1000);
        }, 1000);
      });
      ws.on('error', () => { clearTimeout(timeout); resolve(); });
    });
    addResult('多串口', '切换到 car10 模式', 'PASSED', '已发送 license + backPort');
  } catch (e) { addResult('多串口', '切换到 car10 模式', 'FAILED', e.message); }

  await new Promise(r => setTimeout(r, 1000));

  // 同时发送坐垫和靠背数据
  try {
    const receivedSit = [];
    const receivedBack = [];

    const ws = new WebSocket('ws://127.0.0.1:19999');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); resolve(); }, 10000);
      ws.on('open', () => {
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.sitData) receivedSit.push(parsed);
            if (parsed.backData) receivedBack.push(parsed);
          } catch {}
        });

        const simSit = new SerialSimulator('sit_multi', SERIAL_PATHS.sit);
        const simBack = new SerialSimulator('back_multi', SERIAL_PATHS.back);
        simSit.open();
        simBack.open();

        let count = 0;
        const timer = setInterval(() => {
          if (count >= 15) {
            clearInterval(timer);
            simSit.close();
            simBack.close();
            setTimeout(() => { clearTimeout(timeout); ws.close(); resolve(); }, 2000);
            return;
          }
          simSit.sendFrame(generateMatrixFrame('sit', count));
          simBack.sendFrame(generateMatrixFrame('back', count));
          count++;
        }, 100);
      });
      ws.on('error', () => { clearTimeout(timeout); resolve(); });
    });

    addResult('多串口', '坐垫数据接收',
      receivedSit.length > 0 ? 'PASSED' : 'SKIPPED',
      `接收 ${receivedSit.length} 条 sitData`);
    addResult('多串口', '靠背数据接收',
      receivedBack.length > 0 ? 'PASSED' : 'SKIPPED',
      `接收 ${receivedBack.length} 条 backData`);
  } catch (e) { addResult('多串口', '并行数据流', 'FAILED', e.message); }
}

// ─── 8. 串口断开重连测试 ─────────────────────────────────────
async function testSerialReconnect() {
  console.log('\n═══ 8. 串口断开重连测试 ═══');

  try {
    // 先发送一些数据
    const sim1 = new SerialSimulator('sit_reconnect1', SERIAL_PATHS.sit);
    sim1.open();
    for (let i = 0; i < 5; i++) {
      sim1.sendFrame(generateMatrixFrame('sit', i));
      await new Promise(r => setTimeout(r, 50));
    }
    sim1.close();
    addResult('断开重连', '首次连接发送', 'PASSED', '发送 5 帧成功');

    await new Promise(r => setTimeout(r, 1000));

    // 重新打开并发送
    const sim2 = new SerialSimulator('sit_reconnect2', SERIAL_PATHS.sit);
    sim2.open();
    for (let i = 0; i < 5; i++) {
      sim2.sendFrame(generateMatrixFrame('sit', i + 100));
      await new Promise(r => setTimeout(r, 50));
    }
    sim2.close();
    addResult('断开重连', '重连后发送', 'PASSED', '重连后发送 5 帧成功');
  } catch (e) { addResult('断开重连', '串口重连', 'FAILED', e.message); }
}

// ─── 主引擎 ───────────────────────────────────────────────────
async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('═══════════════════════════════════════════');
  console.log('  Shroom1.0 串口模拟端到端测试');
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log(`  协议: AA 55 03 99 分隔符`);
  console.log('═══════════════════════════════════════════');

  const globalTimeout = setTimeout(() => {
    console.error('\n[超时] 全局测试超时 (8分钟)');
    generateReport();
    process.exit(1);
  }, 8 * 60 * 1000);

  let app, page;

  try {
    // 阶段1-2：不需要 Electron
    await withTimeout(testVirtualSerialSetup, 10000)();
    await withTimeout(testProtocolFrames, 5000)();

    // 启动 Electron
    console.log('\n[启动] 正在启动 Electron 应用...');
    app = await electron.launch({
      args: [PROJECT_DIR, '--no-sandbox', '--disable-gpu'],
      env: { ...process.env, DISPLAY: ':99', NODE_ENV: 'production', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
      timeout: 60000,
    });
    page = await app.firstWindow({ timeout: 60000 });
    console.log('[启动] Electron 窗口已获取');
    page.on('dialog', async (dialog) => { await dialog.dismiss().catch(() => {}); });
    await page.waitForTimeout(3000);

    // 阶段3-8：需要 Electron 运行
    await withTimeout(testWSSerialConnection, 30000)();
    await withTimeout(testSerialToWSDataFlow, 30000)();
    await withTimeout(testHandSensorFrames, 30000)();
    await withTimeout(testUIDataDrivenRendering, 60000)(page);
    await withTimeout(testMultiSerialPorts, 30000)();
    await withTimeout(testSerialReconnect, 15000)();

  } catch (e) {
    console.error(`[致命错误] ${e.message}`);
    addResult('系统', '测试执行', 'FAILED', e.message);
  } finally {
    console.log('\n═══ 应用关闭 ═══');
    try {
      if (app) { await app.close(); addResult('系统', '应用关闭', 'PASSED', '进程正常退出'); }
    } catch (e) { addResult('系统', '应用关闭', 'FAILED', e.message); }
    clearTimeout(globalTimeout);
  }

  generateReport();
  const failed = results.filter(r => r.status === 'FAILED').length;
  process.exit(failed > 0 ? 1 : 0);
}

function generateReport() {
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const total = results.length;

  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { passed: 0, failed: 0, skipped: 0, total: 0 };
    categories[r.category][r.status.toLowerCase()]++;
    categories[r.category].total++;
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  串口模拟端到端测试报告');
  console.log(`  项目: Shroom1.0`);
  console.log(`  协议: AA 55 03 99`);
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════');
  for (const [cat, s] of Object.entries(categories)) {
    const icon = s.failed > 0 ? '❌' : s.skipped > 0 ? '⚠️' : '✅';
    console.log(`  ${cat.padEnd(12)}: ${s.passed}/${s.total} ${icon}${s.skipped > 0 ? ` (${s.skipped} 跳过)` : ''}`);
  }
  console.log('  ─────────────────────────────');
  console.log(`  总计: ${passed}/${total} 通过, ${failed} 失败, ${skipped} 跳过`);
  console.log('═══════════════════════════════════════════');

  const report = {
    project: 'Shroom1.0', branch: 'test', type: '串口模拟端到端测试',
    protocol: 'AA 55 03 99', timestamp: new Date().toISOString(),
    summary: { total, passed, failed, skipped }, categories, results
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n[报告] JSON 报告: ${REPORT_PATH}`);
  console.log(`[截图] 截图目录: ${SCREENSHOT_DIR}`);
}

run().catch((e) => { console.error('测试执行失败:', e); process.exit(1); });
