#!/usr/bin/env node
/**
 * quickstart.js - 新项目最短可跑路径：串口 → 采集 → 导出 CSV
 *
 * 这个例子只用 `@shroom/backend` 一个依赖，走完二次开发最常要的那条链：
 *
 * ```text
 * 串口字节 → 协议解码 → 线序映射 → 清零 → 采集入库 → 导出 CSV
 * ```
 *
 * ## 怎么跑
 *
 * ```bash
 * # 没硬件也能跑完整条链（造假帧）
 * node sdk/backend/examples/quickstart.js --mock
 * npm run sdk:quickstart -- --mock            # 在仓库根上
 *
 * # 有硬件
 * node sdk/backend/examples/quickstart.js --list-ports
 * node sdk/backend/examples/quickstart.js --port COM3 --sensor hand0205 --frames 50
 *
 * # 落盘到 SQLite 而不是内存（要装 better-sqlite3）
 * node sdk/backend/examples/quickstart.js --mock --db ./tmp/quickstart-db
 * ```
 *
 * ## 想换传感器怎么办
 *
 * `--sensor` 接的是 `@shroom/backend/sensors` 注册表里的类型。矩阵多大、走哪几个通道、
 * 波特率多少都从那里读，不用自己写 if：
 *
 * ```bash
 * node -e "console.log(Object.keys(require('@shroom/backend/sensors').SENSOR_DEFINITIONS))"
 * ```
 *
 * 如果你的硬件不在注册表里，走 `@shroom/backend/protocol` 的预设或自己写一份
 * `protocol` 声明（波特率 / 分帧 / 解码三段），见 `protocol/presets/README.md`。
 */

const path = require('node:path');

const { ShroomSensorSDK } = require('@shroom/backend/session');
const { MemoryCaptureStore } = require('@shroom/backend/storage');
const { getSensorDefinition } = require('@shroom/backend/sensors');
const { findMax } = require('@shroom/backend/processing');

function parseArgs(argv) {
  const options = {
    sensorType: 'hand0205',
    channel: 'sit',
    port: '',
    frames: 20,
    mock: false,
    listPorts: false,
    dbDir: '',
    exportDir: path.join(process.cwd(), 'tmp', 'quickstart-export'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[index += 1];
    if (arg === '--mock') options.mock = true;
    else if (arg === '--list-ports') options.listPorts = true;
    else if (arg === '--sensor') options.sensorType = next();
    else if (arg === '--channel') options.channel = next();
    else if (arg === '--port') options.port = next();
    else if (arg === '--frames') options.frames = Number(next());
    else if (arg === '--db') options.dbDir = next();
    else if (arg === '--export-dir') options.exportDir = next();
  }

  return options;
}

/**
 * 造一帧假数据。
 *
 * 长度按传感器档案里的 `pressureLength` 来，中间画一个亮点，
 * 这样导出的 CSV 里 max 不是 0，看得出链路真的通了。
 */
function buildMockFrame(profile) {
  const length = profile.pressureLength || 256;
  const total = length + (profile.rotateLength || 0);
  const frame = Buffer.alloc(total);
  const center = Math.floor(length / 2);
  for (let offset = -3; offset <= 3; offset += 1) {
    const index = center + offset;
    if (index >= 0 && index < length) frame[index] = 180 - Math.abs(offset) * 20;
  }
  return frame;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  // 采集库：默认内存，给了 --db 才落 SQLite。
  // 两者接口一样，所以下面的代码不用分叉。
  const store = options.dbDir
    ? undefined // 交给 SDK 自己按 dbDir 建 CaptureStore
    : new MemoryCaptureStore();

  const sdk = new ShroomSensorSDK({
    store,
    dbDir: options.dbDir || undefined,
    exportDir: options.exportDir,
  });

  if (options.listPorts) {
    const ports = await sdk.listPorts({ onlyLikelySensorPorts: true });
    console.log('[quickstart] 可能是传感器的串口：');
    ports.forEach((port) => console.log(`  ${port.path}  ${port.manufacturer || ''}`));
    if (!ports.length) console.log('  （一个都没找到）');
    sdk.close();
    return;
  }

  const definition = getSensorDefinition(options.sensorType);
  const profile = sdk.registry.getProfile(options.sensorType);
  console.log('[quickstart] 传感器：', {
    type: options.sensorType,
    matrix: definition.matrix,
    channels: definition.channels,
    baudRate: profile.baudRate,
  });

  const capture = sdk.getStore().createCapture({
    name: `quickstart_${options.sensorType}`,
    sensorType: options.sensorType,
    hz: 12,
    metadata: { mode: options.mock ? 'mock' : 'serial', channel: options.channel },
  });

  let stored = 0;

  function handleFrame(rawFrame) {
    // registry.parse 干三件事：按档案解码字节、套线序、算统计；
    // zeroCalibrator.apply 再减掉零点基准。
    const frame = sdk.zeroCalibrator.apply(
      sdk.registry.parse(options.sensorType, rawFrame, { channel: options.channel, profile }),
    );
    sdk.getStore().insertFrame({
      captureId: capture.id,
      sensorType: options.sensorType,
      channel: options.channel,
      rawFrame,
      frame,
    });
    stored += 1;
    if (stored === 1 || stored % 10 === 0) {
      console.log(`[quickstart] 第 ${stored} 帧，峰值 ${findMax(frame.pressureData || [])}`);
    }
  }

  if (options.mock) {
    for (let index = 0; index < options.frames; index += 1) {
      handleFrame(buildMockFrame(profile));
    }
  } else {
    if (!options.port) {
      console.error('[quickstart] 要么给 --port COM3，要么加 --mock。先跑 --list-ports 看有哪些口。');
      process.exitCode = 1;
      sdk.close();
      return;
    }

    const session = await sdk.open({
      sensorType: options.sensorType,
      port: options.port,
      channels: { [options.channel]: options.port },
    });

    await new Promise((resolve) => {
      session.on('frame', (frame) => {
        // 真串口路径下 session 已经解码过了，这里只负责入库。
        sdk.getStore().insertFrame({
          captureId: capture.id,
          sensorType: options.sensorType,
          channel: options.channel,
          rawFrame: frame.rawFrame,
          frame,
        });
        stored += 1;
        if (stored === 1 || stored % 10 === 0) {
          console.log(`[quickstart] 第 ${stored} 帧，峰值 ${findMax(frame.pressureData || [])}`);
        }
        if (stored >= options.frames) resolve();
      });
    });

    await session.close();
  }

  sdk.getStore().finishCapture(capture.id);

  const csvPath = await sdk.exportCsv({ captureId: capture.id, exportDir: options.exportDir });
  console.log('[quickstart] 完成：', { storedFrames: stored, csv: csvPath });

  sdk.close();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[quickstart] 失败：', error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildMockFrame, parseArgs };
