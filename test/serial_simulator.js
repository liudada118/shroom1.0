/**
 * serial_simulator.js - 虚拟串口数据模拟器
 *
 * 通过 socat 创建的虚拟串口对，模拟真实传感器设备发送数据。
 * 协议格式：[数据帧] + [分隔符 AA 55 03 99]
 *
 * 支持模拟的传感器类型：
 * - 1024字节矩阵帧（坐垫/靠背/头枕 32x32 压力矩阵）
 * - 130+146字节手部帧对（hand0205 双帧协议）
 * - 72字节小矩阵帧
 */
const fs = require('fs');
const path = require('path');

// ─── 协议常量 ─────────────────────────────────────────────────
const FRAME_DELIMITER = Buffer.from([0xAA, 0x55, 0x03, 0x99]);

// ─── 虚拟串口路径 ─────────────────────────────────────────────
const SERIAL_PATHS = {
  sit: '/tmp/vserial_sit_sim',    // 坐垫模拟端
  back: '/tmp/vserial_back_sim',  // 靠背模拟端
  head: '/tmp/vserial_head_sim',  // 头枕模拟端
};

// ─── 数据生成器 ───────────────────────────────────────────────

/**
 * 生成 1024 字节的 32x32 压力矩阵数据
 * 模拟真实压力分布：中心区域压力高，边缘低
 * @param {string} type - 'sit'|'back'|'head' 不同区域的压力分布
 * @param {number} frameIndex - 帧序号，用于模拟动态变化
 * @returns {Buffer} 1024字节数据
 */
function generateMatrixFrame(type, frameIndex) {
  const data = Buffer.alloc(1024);
  const centerX = 16, centerY = 16;
  const maxPressure = type === 'sit' ? 200 : type === 'back' ? 150 : 100;
  const spread = type === 'sit' ? 10 : type === 'back' ? 12 : 8;

  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      const dx = row - centerX;
      const dy = col - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 高斯分布压力 + 随时间微小波动
      let pressure = maxPressure * Math.exp(-(dist * dist) / (2 * spread * spread));

      // 添加随机噪声（模拟真实传感器噪声）
      pressure += (Math.random() - 0.5) * 10;

      // 添加时间波动（模拟呼吸/微动）
      pressure += Math.sin(frameIndex * 0.1 + row * 0.2) * 5;

      // 根据类型添加特征
      if (type === 'sit') {
        // 坐垫：两个臀部压力中心
        const leftCenterX = 12, leftCenterY = 10;
        const rightCenterX = 12, rightCenterY = 22;
        const dxL = row - leftCenterX, dyL = col - leftCenterY;
        const dxR = row - rightCenterX, dyR = col - rightCenterY;
        const distL = Math.sqrt(dxL * dxL + dyL * dyL);
        const distR = Math.sqrt(dxR * dxR + dyR * dyR);
        pressure += 80 * Math.exp(-(distL * distL) / 50);
        pressure += 80 * Math.exp(-(distR * distR) / 50);
      } else if (type === 'back') {
        // 靠背：脊柱区域压力较高
        const spineX = col - 16;
        pressure += 60 * Math.exp(-(spineX * spineX) / 20);
      }

      data[row * 32 + col] = Math.max(0, Math.min(255, Math.round(pressure)));
    }
  }
  return data;
}

/**
 * 生成手部传感器第一帧（130字节）
 * 格式：[顺序位(1)][类型位(1)][数据(128)]
 * @param {number} handType - 1=左手, 2=右手
 * @param {number} frameIndex - 帧序号
 * @returns {Buffer}
 */
function generateHandFrame1(handType, frameIndex) {
  const data = Buffer.alloc(130);
  data[0] = 1;          // 顺序位：第一帧
  data[1] = handType;   // 类型位：1=左手, 2=右手

  // 128字节手部压力数据（16x8矩阵的前半部分）
  for (let i = 2; i < 130; i++) {
    const row = Math.floor((i - 2) / 16);
    const col = (i - 2) % 16;
    // 模拟手指和手掌的压力分布
    let pressure = 0;
    // 手指区域（前4行）
    if (row < 4) {
      pressure = 100 + Math.random() * 80;
      // 手指间隔
      if (col % 4 === 3) pressure *= 0.3;
    }
    // 手掌区域
    else {
      const palmCenter = 8;
      const dist = Math.abs(col - palmCenter);
      pressure = 120 * Math.exp(-(dist * dist) / 30) + Math.random() * 20;
    }
    pressure += Math.sin(frameIndex * 0.15) * 8;
    data[i] = Math.max(0, Math.min(255, Math.round(pressure)));
  }
  return data;
}

/**
 * 生成手部传感器第二帧（146字节）
 * 格式：[顺序位(1)][类型位(1)][数据(128)][四元数(16)]
 * @param {number} handType - 1=左手, 2=右手
 * @param {number} frameIndex - 帧序号
 * @returns {Buffer}
 */
function generateHandFrame2(handType, frameIndex) {
  const data = Buffer.alloc(146);
  data[0] = 2;          // 顺序位：第二帧
  data[1] = handType;   // 类型位

  // 128字节手部压力数据（后半部分）
  for (let i = 2; i < 130; i++) {
    const row = Math.floor((i - 2) / 16) + 8;
    const col = (i - 2) % 16;
    let pressure = 80 * Math.exp(-((col - 8) * (col - 8)) / 40) + Math.random() * 15;
    pressure += Math.sin(frameIndex * 0.15 + row * 0.1) * 5;
    data[i] = Math.max(0, Math.min(255, Math.round(pressure)));
  }

  // 16字节四元数数据（模拟手部姿态）
  // 四元数 [w, x, y, z] 各4字节（float32）
  const angle = frameIndex * 0.05;
  const quat = [
    Math.cos(angle / 2),           // w
    Math.sin(angle / 2) * 0.1,     // x
    Math.sin(angle / 2) * 0.2,     // y
    Math.sin(angle / 2) * 0.3,     // z
  ];
  for (let q = 0; q < 4; q++) {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(quat[q], 0);
    buf.copy(data, 130 + q * 4);
  }
  return data;
}

// ─── 串口写入器 ───────────────────────────────────────────────

class SerialSimulator {
  constructor(name, serialPath) {
    this.name = name;
    this.serialPath = serialPath;
    this.fd = null;
    this.running = false;
    this.frameCount = 0;
  }

  open() {
    try {
      this.fd = fs.openSync(this.serialPath, 'w');
      console.log(`[模拟器] ${this.name} 串口已打开: ${this.serialPath}`);
      return true;
    } catch (e) {
      console.error(`[模拟器] ${this.name} 串口打开失败: ${e.message}`);
      return false;
    }
  }

  /**
   * 发送一帧数据（数据 + 分隔符）
   * @param {Buffer} frameData - 帧数据
   */
  sendFrame(frameData) {
    if (!this.fd) return false;
    try {
      // 数据帧 + 分隔符
      const packet = Buffer.concat([frameData, FRAME_DELIMITER]);
      fs.writeSync(this.fd, packet);
      return true;
    } catch (e) {
      // 写入失败可能是因为读端还没打开
      return false;
    }
  }

  /**
   * 开始持续发送矩阵数据
   * @param {string} type - 'sit'|'back'|'head'
   * @param {number} intervalMs - 发送间隔（毫秒）
   * @param {number} totalFrames - 总帧数
   */
  startMatrixStream(type, intervalMs = 50, totalFrames = 100) {
    this.running = true;
    this.frameCount = 0;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (!this.running || this.frameCount >= totalFrames) {
          clearInterval(timer);
          resolve(this.frameCount);
          return;
        }
        const frame = generateMatrixFrame(type, this.frameCount);
        this.sendFrame(frame);
        this.frameCount++;
      }, intervalMs);
    });
  }

  /**
   * 开始持续发送手部数据（交替发送第一帧和第二帧）
   * @param {number} handType - 1=左手, 2=右手
   * @param {number} intervalMs - 每对帧的间隔
   * @param {number} totalPairs - 总帧对数
   */
  startHandStream(handType, intervalMs = 100, totalPairs = 50) {
    this.running = true;
    this.frameCount = 0;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (!this.running || this.frameCount >= totalPairs) {
          clearInterval(timer);
          resolve(this.frameCount);
          return;
        }
        // 发送第一帧
        const frame1 = generateHandFrame1(handType, this.frameCount);
        this.sendFrame(frame1);

        // 短暂延迟后发送第二帧
        setTimeout(() => {
          const frame2 = generateHandFrame2(handType, this.frameCount);
          this.sendFrame(frame2);
        }, 10);

        this.frameCount++;
      }, intervalMs);
    });
  }

  /**
   * 发送指定数量的矩阵帧（同步方式，用于快速测试）
   */
  sendMatrixFrames(type, count) {
    let sent = 0;
    for (let i = 0; i < count; i++) {
      const frame = generateMatrixFrame(type, i);
      if (this.sendFrame(frame)) sent++;
    }
    return sent;
  }

  /**
   * 发送指定数量的手部帧对
   */
  sendHandFramePairs(handType, count) {
    let sent = 0;
    for (let i = 0; i < count; i++) {
      const frame1 = generateHandFrame1(handType, i);
      const frame2 = generateHandFrame2(handType, i);
      if (this.sendFrame(frame1) && this.sendFrame(frame2)) sent++;
    }
    return sent;
  }

  stop() {
    this.running = false;
  }

  close() {
    this.running = false;
    if (this.fd) {
      try { fs.closeSync(this.fd); } catch {}
      this.fd = null;
    }
    console.log(`[模拟器] ${this.name} 串口已关闭`);
  }
}

// ─── 导出 ─────────────────────────────────────────────────────
module.exports = {
  FRAME_DELIMITER,
  SERIAL_PATHS,
  SerialSimulator,
  generateMatrixFrame,
  generateHandFrame1,
  generateHandFrame2,
};

// ─── 独立运行模式 ─────────────────────────────────────────────
if (require.main === module) {
  console.log('═══ 串口模拟器独立测试 ═══');
  console.log(`分隔符: ${FRAME_DELIMITER.toString('hex').toUpperCase()}`);
  console.log(`虚拟串口路径:`);
  for (const [name, p] of Object.entries(SERIAL_PATHS)) {
    console.log(`  ${name}: ${p}`);
  }

  // 测试数据生成
  const matrixFrame = generateMatrixFrame('sit', 0);
  console.log(`\n矩阵帧: ${matrixFrame.length} 字节`);
  console.log(`  前16字节: ${matrixFrame.slice(0, 16).toString('hex')}`);
  console.log(`  最大值: ${Math.max(...matrixFrame)}`);
  console.log(`  最小值: ${Math.min(...matrixFrame)}`);

  const handFrame1 = generateHandFrame1(1, 0);
  console.log(`\n手部第一帧: ${handFrame1.length} 字节`);
  console.log(`  顺序位: ${handFrame1[0]}, 类型位: ${handFrame1[1]}`);

  const handFrame2 = generateHandFrame2(1, 0);
  console.log(`手部第二帧: ${handFrame2.length} 字节`);
  console.log(`  顺序位: ${handFrame2[0]}, 类型位: ${handFrame2[1]}`);
  console.log(`  四元数区域: ${handFrame2.slice(130).toString('hex')}`);

  // 测试虚拟串口写入
  const sim = new SerialSimulator('sit', SERIAL_PATHS.sit);
  if (sim.open()) {
    const sent = sim.sendMatrixFrames('sit', 5);
    console.log(`\n发送 ${sent} 帧矩阵数据到 ${SERIAL_PATHS.sit}`);
    sim.close();
  }

  console.log('\n═══ 模拟器测试完成 ═══');
}
