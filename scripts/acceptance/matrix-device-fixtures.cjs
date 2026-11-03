'use strict';

const assert = require('node:assert/strict');

const STANDARD_TAIL = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
const BED_TAIL = Buffer.from([0xaa, 0x00, 0x55, 0x00, 0x03, 0x00, 0x99, 0x00]);
const SAMPLE_OFFSETS = { topLeft: [0, 0], topRight: [0, 1], bottomLeft: [1, 0], bottomRight: [1, 1] };

/** 固定接线规格：显示前17行来自原始15..31行，其余来自原始14..0行。 */
function wireRow(displayRow) { return displayRow < 17 ? displayRow + 15 : 31 - displayRow; }

/** 为手部检测产生原始字节及独立线序期望，不调用受测 jqbed。 */
function handFixture(frameIndex) {
  const bytes = Buffer.from(Array.from({ length: 1024 }, (_, index) =>
    20 + ((Math.floor(index / 32) * 17 + index % 32 * 29 + frameIndex * 43) % 180)));
  const expected = Array.from({ length: 1024 }, (_, index) => bytes[wireRow(Math.floor(index / 32)) * 32 + index % 32]);
  return { bytes, expected, realtimeExpected: expected };
}

/** 生成有线序的ADC零点，覆盖先扣零再做全帧标定的约束。 */
function bedBaseline() {
  return Array.from({ length: 1024 }, (_, index) => 40 + (Math.floor(index / 32) * 3 + index % 32 * 5) % 29);
}

/** 按已确认V2.7.54公式独立计算期望；参数刻意固定，不读取受测标定函数。 */
function expectedPressure(adc) {
  const valid = adc.filter(value => value > 30);
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  if (!valid.length) return adc.map(() => 0);
  const averagePressure = 25 / (1 + Math.exp(-0.010637 * (average - 438.05))) * 2;
  return adc.map(value => value <= 30 ? 0 : Number((averagePressure * (value / average)).toFixed(1)));
}

/** 将已知显示ADC反向编码到硬件线序，16位值覆盖高字节、阈值边界和负零点差。 */
function bedFixture(frameIndex, side, samplePoint) {
  const baseline = bedBaseline();
  const orderedAdc = baseline.map((zero, index) => {
    const pattern = (index + frameIndex * 7) % 47;
    const value = pattern === 0 ? -8 : pattern === 1 ? 29 : pattern === 2 ? 30 : pattern === 3 ? 31
      : 50 + ((Math.floor(index / 32) * 97 + index % 32 * 53 + frameIndex * 127) % 3500);
    return zero + value;
  });
  const bytes = Buffer.alloc(2048);
  orderedAdc.forEach((value, index) => bytes.writeUInt16LE(value, (wireRow(Math.floor(index / 32)) * 32 + index % 32) * 2));
  const pressure = expectedPressure(orderedAdc.map((value, index) => Math.max(0, value - baseline[index])));
  const [rowOffset, colOffset] = SAMPLE_OFFSETS[samplePoint];
  const expected = side === 32 ? pressure : Array.from({ length: 256 }, (_, index) => {
    // 16×16显示先转置再取2×2采样点；原矩阵坐标直接推导，禁止调用生产转置/降采样。
    const sourceRow = (index % 16) * 2 + colOffset;
    const sourceCol = Math.floor(index / 16) * 2 + rowOffset;
    return pressure[sourceRow * 32 + sourceCol];
  });
  return { bytes, expected, realtimeExpected: expected, orderedAdc, baseline, pressure };
}

/** 检查显示/回放共同依赖的维度和方向元数据，避免数值正确但点图翻转。 */
function assertBedPayload(payload, fixture, side, samplePoint) {
  assert.deepEqual(payload.sitData, fixture.realtimeExpected);
  if (payload.zeroApplied === true) assert.deepEqual(payload.rawData, fixture.orderedAdc);
  assert.equal(payload.matrixWidth, side); assert.equal(payload.matrixHeight, side);
  if (side === 16) {
    assert.equal(payload.matrixOrientation, 'transposed');
    assert.deepEqual(payload.matrixDownsample, { enabled: true, samplePoint, displaySamplePoint: samplePoint, blockWidth: 2, blockHeight: 2 });
    assert.equal(payload.sourceMatrixWidth, 32); assert.equal(payload.sourceMatrixHeight, 32);
  } else {
    assert.equal(payload.matrixOrientation, undefined);
    assert.equal(payload.matrixDownsample, undefined);
  }
}

/** 构造手部和小床12B验收配置；受测处理器、标定与转置均由目标产物提供。 */
function createMatrixDeviceProfiles(m) {
  const calibration = { estimatePointPressure: m.pressureCalibration.estimatePointPressure,
    filterThreshold: m.pressureCalibration.FILTER_THRESHOLD };
  assert.equal(typeof calibration.estimatePointPressure, 'function', 'Target pressure calibration must exist');
  assert.equal(calibration.filterThreshold, 30, '12B fixture pins the documented ADC threshold');
  const hand = {
    id: 'hand', sensorType: 'hand', side: 32, delimiter: STANDARD_TAIL, parserChannel: 'sit', baudRate: 1000000,
    fixture: handFixture,
    /** 使用目标包的手部1024字节处理器和正式线序。 */
    createProcessor(target) {
      const processor = target.createSit1024FrameProcessor({ ...target.processing, ...target.sensors,
        isCar: target.isCar, isPetCareSystem: () => false });
      /** 返回正式处理器的完整payload；短帧不产生输出。 */
      return (bytes, context) => {
        const result = processor.processFrame(bytes, context);
        return result ? JSON.parse(result.jsonData) : null;
      };
    },
    /** 手部原始矩阵存储与独立线序期望逐点一致。 */
    assertStored(stored, fixture) { assert.deepEqual(stored, fixture.expected); },
    /** 实时及回放必须保留全部1024个手部压力点。 */
    assertPayload(payload, fixture) { assert.deepEqual(payload.sitData, fixture.realtimeExpected); },
  };
  const beds = [[32, 'topLeft'], ...Object.keys(SAMPLE_OFFSETS).map(sample => [16, sample])].map(([side, samplePoint]) => ({
    id: side === 32 ? 'smallBed12B_32x32' : `smallBed12B_16x16_${samplePoint}`,
    sensorType: 'smallBed12B', side, delimiter: BED_TAIL, parserChannel: 'smallBed12B', baudRate: 1500000,
    displayOptions: { matrixMode: `${side}x${side}`, samplePoint }, collectOptions: {}, calibration,
    /** 每个时刻的硬件字节与期望值保持确定性，便于定位错帧。 */
    fixture(index) { return bedFixture(index, side, samplePoint); },
    /** 直接运行目标小床runtime，捕获其输出后交回统一采集链路。 */
    createProcessor(target, { transforms }) {
      let output = null, hz = 50;
      const runtime = target.createSmallBed12BRuntime({
        smallBed12B: target.sensors.smallBed12B, sensorType: 'smallBed12B', getSensorType: () => 'smallBed12B',
        getLineOrder: () => target.processing.jqbed,
        zeroStateStore: {
          /** 小床基线必须按通道在decoded阶段扣除，否则会改变标定均值。 */
          getBaseline(channelId, stage) {
            assert.equal(channelId, 'smallBed12B:sit'); assert.equal(stage, 'decoded');
            return bedBaseline();
          },
          updateSources() {},
        },
        resolveChannelIdentity: () => ({ channelId: 'smallBed12B:sit', displaySystemId: 'smallBed12B',
          sensorId: 'sit', sensorType: 'smallBed12B', outputChannel: 'sit' }),
        calibration, getDisplayOptions: () => ({ matrixMode: `${side}x${side}`, samplePoint }),
        getHz: () => hz, transposeSquareMatrix: transforms.transposeSquareMatrix,
        getNowDate: () => 1, getEndDate: () => 2, setCurrentPressureFrame() {}, setCurrentDisplayData() {},
        sendSitFrame(json) { output = JSON.parse(json); },
      });
      /** 生产runtime在本次调用中没有输出时返回null，错误长度不能复用旧帧。 */
      return (bytes, context) => {
        output = null; hz = context.colHZ;
        runtime.handleFrame(bytes);
        if (output) { assert.equal(output.pressureUnit, 'kPa'); assert.equal(output.zeroApplied, true); }
        return output;
      };
    },
    /** 存储必须带压强单位，避免回放把已标定kPa再次当ADC换算。 */
    assertStored(stored, fixture) {
      assert.equal(stored.pressureUnit, 'kPa');
      assert.deepEqual(stored.pressureData, fixture.expected);
      assertBedPayload(stored, fixture, side, samplePoint);
    },
    /** 实时与回放都验证16×16方向和四个采样点，32×32保持原矩阵。 */
    assertPayload(payload, fixture) { assertBedPayload(payload, fixture, side, samplePoint); },
  }));
  return [hand, ...beds];
}

/** 生成16×16普通矩阵或手套分包；压力期望直接来自硬件字节而非受测解析函数。 */
function fast256Fixture(frameIndex, segmented) {
  const expected = Array.from({ length: 256 }, (_, index) =>
    20 + ((Math.floor(index / 16) * 17 + index % 16 * 29 + frameIndex * 43) % 180));
  if (!segmented) return { bytes: Buffer.from(expected), expected, realtimeExpected: expected };
  const rotate = [1, frameIndex / 8, 0.5, 0.25];
  const imu = Buffer.alloc(16);
  rotate.forEach((value, index) => imu.writeFloatLE(value, index * 4));
  return { expected, realtimeExpected: expected, rotate,
    packets: [Buffer.from([1, 1, ...expected.slice(0, 128)]),
      Buffer.concat([Buffer.from([2, 1, ...expected.slice(128)]), imu])] };
}

/** 给16×16高速矩阵补齐普通256字节与手套130+146字节两条真实旧串口入口。 */
function createFast256DeviceProfiles(m) {
  assert.equal(typeof m.createLegacySerialFrameRuntime, 'function', 'Target legacy serial runtime must exist');
  return [false, true].map(segmented => ({
    id: segmented ? 'fast256_glove_segments' : 'fast256_plain', sensorType: 'fast256', side: 16,
    delimiter: STANDARD_TAIL, parserChannel: 'sit', baudRate: 921600,
    protocol: segmented ? '130+146 bytes; uint8 pressure + float32 LE IMU' : '256 uint8 pressure bytes',
    incompletePackets: segmented ? [fast256Fixture(0, true).packets[0]] : [],
    /** 原始和分包设备使用相同已知矩阵，便于对照数据排列。 */
    fixture(index) { return fast256Fixture(index, segmented); },
    /** 让正式legacy分派器完成缓存、分包合并和矩阵输出，不在fixture中拼payload。 */
    createProcessor(target) {
      let output = null;
      const context = { ...target.processing, ...target.sensors, isCar: target.isCar,
        file: 'fast256', nowDate: 1, endDate: 2, firstBlueData: [], colHZ: 50,
        // fast256 不属于手套专用系统，正式handPacketRuntime也会把分包交回旧分派器。
        handleHandGloveDoublePacket: () => false,
        handleHandGloveFullPacket: () => false,
        /** 捕获正式发布结果，保留旧runtime期望的返回形状。 */
        colOrSendData(json) { output = JSON.parse(json); return { frame: output }; },
      };
      const runtime = target.createLegacySerialFrameRuntime(context);
      /** 每个分片单独进入真实runtime；首半包和错误长度不能复用上一帧。 */
      return (bytes, state) => {
        output = null; context.colHZ = state.colHZ;
        runtime.handleSitSerialFrame(bytes);
        return output;
      };
    },
    /** 高速矩阵历史保存全部256个压力值，姿态不属于该系统的历史格式。 */
    assertStored(stored, fixture) { assert.deepEqual(stored, fixture.expected); },
    /** 原始压力在实时/回放一致，分包实时还核对IMU解析但不要求矩阵历史保存姿态。 */
    assertPayload(payload, fixture) {
      assert.deepEqual(payload.sitData, fixture.realtimeExpected);
      if (segmented && Array.isArray(payload.rawPressureData)) {
        assert.deepEqual(payload.rawPressureData, fixture.expected);
        assert.deepEqual(payload.rotate, fixture.rotate);
      }
    },
  }));
}

module.exports = { createMatrixDeviceProfiles, createFast256DeviceProfiles };
