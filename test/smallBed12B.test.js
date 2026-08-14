const test = require("node:test");
const assert = require("node:assert/strict");

const smallBed12B = require("../server/smallBed12B");

test("pressure calibration averages only ADC values above the threshold", () => {
  const calibrated = smallBed12B.applyPressureCalibration([0, 30, 40, 60], {
    filterThreshold: 30,
    estimatePointPressure: (_average, point) => point / 3,
  });

  assert.deepEqual(calibrated, [0, 0, 13.3, 20]);
});

test("pressure calibration returns zeros when no ADC value exceeds threshold", () => {
  const calibrated = smallBed12B.applyPressureCalibration([0, 20, 30], {
    filterThreshold: 30,
    estimatePointPressure: () => {
      throw new Error("estimator must not run without valid pressure points");
    },
  });

  assert.deepEqual(calibrated, [0, 0, 0]);
});

test("readAdcFrame reads one 2048-byte little-endian 32x32 frame", () => {
  const buffer = Buffer.alloc(2048);
  for (let index = 0; index < 1024; index += 1) {
    buffer.writeUInt16LE(index, index * 2);
  }

  const values = smallBed12B.readAdcFrame(buffer);

  assert.equal(values.length, 1024);
  assert.equal(values[0], 0);
  assert.equal(values[511], 511);
  assert.equal(values[1023], 1023);
  assert.equal(smallBed12B.readAdcFrame(Buffer.alloc(2047)), null);
});

test("stored kPa history is rounded without a second calibration", () => {
  const stored = { pressureUnit: "kPa", sitData: [1.24, 2.26] };
  const values = smallBed12B.normalizePressureData(stored.sitData, stored, {
    filterThreshold: 30,
    estimatePointPressure: () => {
      throw new Error("stored pressure must not be calibrated again");
    },
  });

  assert.deepEqual(values, [1.2, 2.3]);
});

test("16x16 realtime frames include pressure and sampling metadata", () => {
  const pressure = Array.from({ length: 1024 }, (_, index) => index);
  const frame = smallBed12B.buildRealtimeFrame(pressure, {
    displayOptions: { matrixMode: "16x16", samplePoint: "bottomRight" },
    hz: 12,
    transposeSquareMatrix: (data) => data,
  });

  assert.equal(frame.sitData.length, 256);
  assert.equal(frame.sitData[0], 33);
  assert.equal(frame.matrixWidth, 16);
  assert.equal(frame.matrixHeight, 16);
  assert.equal(frame.pressureUnit, "kPa");
  assert.equal(frame.matrixOrientation, "transposed");
  assert.equal(frame.matrixDownsample.samplePoint, "bottomRight");
});

test("whole-frame processing runs ordering, zeroing, and calibration in order", () => {
  const buffer = Buffer.alloc(2048);
  buffer.writeUInt16LE(50, 0);
  const result = smallBed12B.buildRealtimeFrameFromBuffer(buffer, {
    lineOrder: (data) => data,
    zeroFrame: [10],
    subtractZero: (value) => Math.max(0, value),
    calibration: {
      filterThreshold: 30,
      estimatePointPressure: (_average, value) => value / 10,
    },
    displayOptions: { matrixMode: "32x32" },
    hz: 12,
    transposeSquareMatrix: (data) => data,
  });

  assert.equal(result.zeroedFrame[0], 40);
  assert.equal(result.pressureData[0], 4);
  assert.equal(result.realtimeFrame.sitData[0], 4);
});

test("new collection frames always store kPa and matrix metadata", () => {
  const saved = JSON.parse(smallBed12B.buildCollectionStorageData({
    sitData: [1.2, 3.4],
    matrixWidth: 16,
    matrixHeight: 16,
    matrixOrientation: "transposed",
    matrixDownsample: { enabled: true, samplePoint: "bottomRight" },
  }, {
    collectOptions: { matrixDownsample: { enabled: true } },
  }));

  assert.equal(saved.pressureUnit, "kPa");
  assert.equal(saved.matrixWidth, 16);
  assert.deepEqual(saved.pressureData, [1.2, 3.4]);
});

test("legacy ADC history is calibrated once while kPa history is only rounded", () => {
  const calibration = {
    filterThreshold: 30,
    estimatePointPressure: (_average, value) => value / 10,
  };

  assert.deepEqual(smallBed12B.normalizePressureData([40], [40], calibration), [4]);
  assert.deepEqual(smallBed12B.normalizePressureData(
    [4.04],
    { pressureUnit: "kPa" },
    calibration,
  ), [4]);
});
