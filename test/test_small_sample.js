const WebSocket = require('ws');
const fs = require('fs');
const net = require('net');

const WS_URL = 'ws://127.0.0.1:19999';
const SERIAL_A = '/tmp/vserial_sit_a';  // app 端
const SERIAL_B = '/tmp/vserial_sit_b';  // 模拟端

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 构造 smallSample 的蓝牙帧数据 (与 hand0205 协议相同)
// 帧头: AA 55 03 99, order(1byte), type(1byte), data(128bytes)
// 第一帧 130 字节: order=01, type=06
// 第二帧 146 字节: order=02, type=06, data(128bytes) + 四元数(16bytes)
function buildSmallSampleFrames() {
  // 第一帧: AA 55 03 99 01 06 + 128字节数据 = 134字节 (帧头4 + 130)
  const frame1 = Buffer.alloc(134, 0);
  frame1[0] = 0xAA; frame1[1] = 0x55; frame1[2] = 0x03; frame1[3] = 0x99;
  frame1[4] = 0x01; // order
  frame1[5] = 0x06; // type
  // 填充 128 字节测试数据 (前半部分)
  for (let i = 0; i < 128; i++) {
    frame1[6 + i] = (i % 50) + 1; // 1-50 循环
  }

  // 第二帧: AA 55 03 99 02 06 + 128字节数据 + 16字节四元数 = 150字节 (帧头4 + 146)
  const frame2 = Buffer.alloc(150, 0);
  frame2[0] = 0xAA; frame2[1] = 0x55; frame2[2] = 0x03; frame2[3] = 0x99;
  frame2[4] = 0x02; // order
  frame2[5] = 0x06; // type
  // 填充 128 字节测试数据 (后半部分)
  for (let i = 0; i < 128; i++) {
    frame2[6 + i] = (i % 30) + 5; // 5-34 循环
  }
  // 四元数 16 字节 (4个float32)
  const quat = Buffer.alloc(16);
  quat.writeFloatLE(0.0, 0);
  quat.writeFloatLE(0.0, 4);
  quat.writeFloatLE(0.0, 8);
  quat.writeFloatLE(1.0, 12);
  quat.copy(frame2, 134);

  return Buffer.concat([frame1, frame2]);
}

async function runTest() {
  console.log('=== 小型样品 (smallSample) 模拟串口测试 ===\n');
  const results = [];

  // Step 1: 连接 WS
  console.log('[1] 连接 WebSocket...');
  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('WS连接超时')), 5000);
  });
  console.log('    ✅ WS 连接成功');
  results.push({ test: 'WS连接', pass: true });

  // Step 2: 切换到 smallSample 传感器类型
  console.log('[2] 切换传感器类型为 smallSample...');
  ws.send(JSON.stringify({ file: 'smallSample' }));
  await sleep(1000);
  console.log('    ✅ 已发送切换指令');
  results.push({ test: '切换传感器类型', pass: true });

  // Step 3: 连接串口
  console.log('[3] 连接虚拟串口...');
  ws.send(JSON.stringify({ sitPort: SERIAL_A }));
  await sleep(2000);
  console.log('    ✅ 已发送串口连接指令');
  results.push({ test: '连接串口', pass: true });

  // Step 4: 发送模拟数据并接收
  console.log('[4] 发送模拟数据...');
  
  let receivedSitData = null;
  let dataReceived = false;

  const dataPromise = new Promise((resolve) => {
    const handler = (msg) => {
      try {
        const json = JSON.parse(msg.toString());
        if (json.sitData && Array.isArray(json.sitData) && json.sitData.length > 0) {
          receivedSitData = json.sitData;
          dataReceived = true;
          ws.removeListener('message', handler);
          resolve();
        }
      } catch (e) {}
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.removeListener('message', handler);
      resolve();
    }, 10000);
  });

  // 通过虚拟串口 B 端发送数据
  const serialFd = fs.openSync(SERIAL_B, 'w');
  const frameData = buildSmallSampleFrames();
  
  // 发送多次以确保数据被接收
  for (let i = 0; i < 10; i++) {
    fs.writeSync(serialFd, frameData);
    await sleep(100);
  }
  fs.closeSync(serialFd);
  console.log('    已发送 10 帧数据');

  await dataPromise;

  if (dataReceived && receivedSitData) {
    console.log(`    ✅ 收到 sitData, 长度: ${receivedSitData.length}`);
    results.push({ test: '数据接收', pass: true });

    // 验证数据长度是否为 100 (10×10)
    if (receivedSitData.length === 100) {
      console.log('    ✅ 数据长度正确: 100 (10×10)');
      results.push({ test: '数据长度验证(100)', pass: true });
    } else {
      console.log(`    ❌ 数据长度错误: ${receivedSitData.length}, 期望: 100`);
      results.push({ test: '数据长度验证(100)', pass: false, detail: `实际长度: ${receivedSitData.length}` });
    }

    // 打印 10×10 矩阵
    console.log('\n    10×10 数字矩阵:');
    for (let i = 0; i < 10; i++) {
      const row = receivedSitData.slice(i * 10, (i + 1) * 10);
      console.log('    ' + row.map(v => String(v).padStart(4)).join(' '));
    }

    // 验证数据非全零
    const nonZero = receivedSitData.filter(v => v > 0).length;
    if (nonZero > 0) {
      console.log(`\n    ✅ 非零数据点: ${nonZero}/100`);
      results.push({ test: '数据非全零', pass: true });
    } else {
      console.log('\n    ❌ 数据全为零');
      results.push({ test: '数据非全零', pass: false });
    }
  } else {
    console.log('    ❌ 未收到 sitData');
    results.push({ test: '数据接收', pass: false });
    results.push({ test: '数据长度验证(100)', pass: false });
    results.push({ test: '数据非全零', pass: false });
  }

  // Step 5: 断开串口
  console.log('\n[5] 断开串口...');
  ws.send(JSON.stringify({ sitClose: true }));
  await sleep(1000);
  console.log('    ✅ 已断开串口');
  results.push({ test: '断开串口', pass: true });

  // 汇总
  ws.close();
  await sleep(500);

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log('\n=== 测试结果汇总 ===');
  console.log(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed}`);
  results.forEach(r => {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.test}${r.detail ? ' (' + r.detail + ')' : ''}`);
  });

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(e => {
  console.error('测试异常:', e.message);
  process.exit(1);
});
