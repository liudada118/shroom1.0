/**
 * 全传感器类型串口模拟器
 * 根据传感器类型生成对应协议的数据帧并写入虚拟串口
 */
const fs = require('fs');

const DELIMITER = Buffer.from([0xAA, 0x55, 0x03, 0x99]);

// 传感器配置
const SENSOR_CONFIG = {
  hand0205:    { label: '触觉手套',       frames: ['1024', '130', '146'], baudRate: 921600 },
  robot1:      { label: '宇树G1触觉上衣', frames: ['1024', '130', '146'], baudRate: 921600 },
  robotSY:     { label: '松延N2触觉上衣', frames: ['1024'],              baudRate: 921600 },
  robotLCF:    { label: '零次方H1触觉上衣', frames: ['1024'],            baudRate: 921600 },
  footVideo:   { label: '触觉足底',       frames: ['1024', '130', '146'], baudRate: 921600 },
  bed4096num:  { label: '4096数字',       frames: ['4096'],              baudRate: 3000000 },
  jqbed:       { label: '小床监测',       frames: ['1024'],              baudRate: 1000000 },
  bed4096:     { label: '4096',           frames: ['4096'],              baudRate: 3000000 },
  fast256:     { label: '16×16高速',      frames: ['256'],               baudRate: 1000000 },
  fast1024:    { label: '32×32高速',      frames: ['1024'],              baudRate: 1000000 },
  daliegu:     { label: '14×20高速',      frames: ['1024'],              baudRate: 921600 },
  normal:      { label: '正常测试',       frames: ['1024'],              baudRate: 1000000 },
};

/**
 * 生成指定长度的模拟数据帧
 */
function generateFrame(length, frameIndex) {
  const len = parseInt(length);
  const data = Buffer.alloc(len);

  if (len === 1024) {
    // 32×32 矩阵数据 - 生成渐变压力值
    for (let i = 0; i < 1024; i++) {
      const row = Math.floor(i / 32);
      const col = i % 32;
      // 中心区域压力较高
      const cx = 16, cy = 16;
      const dist = Math.sqrt((row - cx) ** 2 + (col - cy) ** 2);
      data[i] = Math.max(0, Math.min(255, Math.floor(200 - dist * 10 + Math.random() * 20)));
    }
  } else if (len === 130) {
    // 手部蓝牙第一帧: order + type + 128字节数据
    data[0] = 1;  // order = 1 (第一帧)
    data[1] = 1;  // type = 1 (左手)
    for (let i = 2; i < 130; i++) {
      data[i] = Math.floor(Math.random() * 100 + 50);
    }
  } else if (len === 146) {
    // 手部蓝牙第二帧: order + type + 128字节数据 + 16字节四元数
    data[0] = 2;  // order = 2 (第二帧)
    data[1] = 1;  // type = 1 (左手)
    for (let i = 2; i < 130; i++) {
      data[i] = Math.floor(Math.random() * 100 + 50);
    }
    // 四元数数据 (16字节 = 4个float的高低字节)
    for (let i = 130; i < 146; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
  } else if (len === 256) {
    // 16×16 矩阵数据
    for (let i = 0; i < 256; i++) {
      const row = Math.floor(i / 16);
      const col = i % 16;
      const cx = 8, cy = 8;
      const dist = Math.sqrt((row - cx) ** 2 + (col - cy) ** 2);
      data[i] = Math.max(0, Math.min(255, Math.floor(180 - dist * 15 + Math.random() * 20)));
    }
  } else if (len === 4096) {
    // 64×64 矩阵数据
    for (let i = 0; i < 4096; i++) {
      const row = Math.floor(i / 64);
      const col = i % 64;
      const cx = 32, cy = 32;
      const dist = Math.sqrt((row - cx) ** 2 + (col - cy) ** 2);
      data[i] = Math.max(0, Math.min(255, Math.floor(200 - dist * 5 + Math.random() * 15)));
    }
  }

  return data;
}

/**
 * 构建完整的帧（分隔符 + 数据）
 */
function buildPacket(frameData) {
  return Buffer.concat([DELIMITER, frameData]);
}

/**
 * 向虚拟串口发送数据
 * @param {string} portPath - 虚拟串口路径
 * @param {string} sensorType - 传感器类型
 * @param {number} frameCount - 发送帧数
 * @param {number} intervalMs - 帧间隔(ms)
 */
function sendData(portPath, sensorType, frameCount = 10, intervalMs = 100) {
  return new Promise((resolve, reject) => {
    const config = SENSOR_CONFIG[sensorType];
    if (!config) {
      reject(new Error(`Unknown sensor type: ${sensorType}`));
      return;
    }

    const fd = fs.openSync(portPath, 'w');
    let sent = 0;

    console.log(`[SIM] Sending ${frameCount} frames for ${config.label} (${sensorType}) to ${portPath}`);

    const timer = setInterval(() => {
      if (sent >= frameCount) {
        clearInterval(timer);
        fs.closeSync(fd);
        console.log(`[SIM] Done: ${sent} frames sent for ${sensorType}`);
        resolve(sent);
        return;
      }

      // 发送该传感器类型的所有帧类型
      for (const frameLen of config.frames) {
        const frame = generateFrame(frameLen, sent);
        const packet = buildPacket(frame);
        try {
          fs.writeSync(fd, packet);
        } catch (e) {
          console.error(`[SIM] Write error: ${e.message}`);
        }
      }
      sent++;
    }, intervalMs);
  });
}

// 如果直接运行
if (require.main === module) {
  const sensorType = process.argv[2] || 'hand0205';
  const portPath = process.argv[3] || '/tmp/vserial_sit_sim';
  const frameCount = parseInt(process.argv[4]) || 10;

  console.log(`[SIM] Sensor: ${sensorType}, Port: ${portPath}, Frames: ${frameCount}`);
  sendData(portPath, sensorType, frameCount, 100).then(() => {
    console.log('[SIM] Complete');
    process.exit(0);
  }).catch(e => {
    console.error('[SIM] Error:', e.message);
    process.exit(1);
  });
}

module.exports = { sendData, SENSOR_CONFIG, DELIMITER, generateFrame, buildPacket };
