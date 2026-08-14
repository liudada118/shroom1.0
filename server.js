const logger = require('./logger');
const { startWorker, callPy, stopWorker, warmFootAnalysis } = require('./pyWorker');
const WebSocket = require("ws");
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const HttpResult = require('./HttpResult');
const { app } = require('electron')
const path = require('path');
const os = require('os');
const fs = require('fs');
const { SerialPort } = require("serialport");
const { DelimiterParser } = require("@serialport/parser-delimiter");
const sqlite3 = require("./sqlite3-compat").verbose();
const { createObjectCsvWriter: createCsvWriter, createObjectCsvStringifier: createCsvStringifier } = require("csv-writer");
const {
  openWeb,
  interp,
  addSide,
  gaussBlur_1,
  carSitLine,
  carBackLine,
  press,
  calculatePressure,
  car10Back,
  objChange,
  calPress,
  car10Sit,
  interp1016,
  timeStampToDate,
  sit10Line,
  press12,
  calPressArr,
  timeStampTo_Date,
  pressToN,
  smallBed,
  smallM,
  // pressSmallBed,
  smallM1,
  rect,
  short,
  smallBedReal,
  zeroLine,
  smallBedZero,
  handLine,
  matColLine,
  smallBed1,
  smallBedReal1,
  yanfeng10sit,
  yanfeng10back,
  handBlue,
  handSinglePoint,
  wowSitLine,
  wowBackLine,
  wowhead,
  xiyueReal1,
  jqbed,
  tempFullBed,
  carCol,
  newHand,
  gloves,
  gloves1,
  gloves0123Res,
  gloves0123,
  gloves2,
  footR,
  footVideo1,
  handR,
  handRVideo1470506,
  handL,
  footVideo,
  footL,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  footArrToNormal,
  zeroLineMatrix,
  sit100Line,
  endiSit1024,
  carYLine,
} = require("./openWeb");
const { resolveConfigFile, getConfigFileCandidates, getWritableConfigFile } = require('./licenseHelper');
const licenseManager = require('./licenseManager');
const sensorTypeStore = require('./sensorTypeStore');
const appConfig = require('./configManager');
const { isCar, dedupli, totalToN, } = require("./util");
const { pressSmallBed } = require("./utilMatrix");
const { gaussBlur_return, gaussBlur_2, interpSmall, findMax, numLessZeroToZero, press6, pressNew1220, press6sit, bytes4ToInt10, arrToRealLine, pressNew12203131 } = require('./server/mathUtils');
const { initDb: _initDbFromModule } = require('./server/dbManager');
const smallBed12B = require('./server/smallBed12B');
const {
  estimatePointPressure,
  FILTER_THRESHOLD: PRESSURE_CALIBRATION_FILTER_THRESHOLD,
} = require('./util/pressureCalibration_V2.7.54');

const HAND_GLOVE_FULL_PACKET = 'handGloveFullPacket';
const HAND_GLOVE_DOUBLE = 'hand0205Double';
const HAND_GLOVE_TYPES = ['hand0205', HAND_GLOVE_DOUBLE, 'handGlove115200', HAND_GLOVE_FULL_PACKET];
const HAND_GLOVE_FULL_PACKET_LENGTH = 274;
const TEMP_FULL_BED_TYPE = 'tempFullBed';
const TEMP_FULL_BED_PRESSURE_THRESHOLD = 20;
const JQ_BED_TYPE = 'jqbed';
const SMALL_BED_TYPE = 'smallBed';
const SMALL_BED_NO_ALG_TYPE = 'smallBedNoAlg';
const SMALL_BED_12B_TYPE = 'smallBed12B';
const HAND_SINGLE_POINT_TYPE = 'handSinglePoint';
const WHOLE_CHAIR_TYPE = 'wholeChair';
const MINZHEN_TYPE = 'minzhen';
const MINZHEN_SENSOR_BAUD_RATE = 115200;
const MINZHEN_SENSOR_FRAME_START_PATTERN = /yroscope\s*:/i;
const MINZHEN_ZERO_POINT_INDEXES = [384, 416];
const MINZHEN_BACKEND_GAUSS_RADIUS = 0.5;
const WHOLE_CHAIR_GAUSS_RADIUS = 0.5;
const SMALL_BED_12B_PAYLOAD_LENGTH = 1024 * 2;
const SMALL_BED_12B_FRAME_TAIL = Buffer.from([0xaa, 0x00, 0x55, 0x00, 0x03, 0x00, 0x99, 0x00]);
const smallBed12BCalibration = {
  estimatePointPressure,
  filterThreshold: PRESSURE_CALIBRATION_FILTER_THRESHOLD,
};
const THREE_PORT_SENSOR_TYPES = new Set(['volvo', WHOLE_CHAIR_TYPE]);
const isHandGloveType = (sensorType) => HAND_GLOVE_TYPES.includes(sensorType);
const isHandStorageType = (sensorType = '') => isHandGloveType(sensorType) || String(sensorType).includes('robot');
const isZeroFrameStorageType = (sensorType = '') => isHandGloveType(sensorType) || sensorType === 'footVideo' || String(sensorType).includes('robot');
const isSmallBedMatrixType = (sensorType) => [SMALL_BED_TYPE, SMALL_BED_NO_ALG_TYPE].includes(sensorType);
const isThreePortFile = (sensorType) => THREE_PORT_SENSOR_TYPES.has(sensorType);
const getFrameMatrixData = (frame, key) => Array.isArray(frame?.[key]) ? frame[key] : [];
const HAND_GLOVE_REALTIME_SEND_INTERVAL_MS = 1000 / 60;
const COLLECTION_MIN_FREE_BYTES = Number(process.env.SHROOM_MIN_COLLECTION_FREE_BYTES) || 2 * 1024 * 1024 * 1024;
let lastHandGloveRealtimeSendAt = {
  sit: 0,
  back: 0,
};
const getSensorBaudRate = (sensorType) => {
  if (sensorType == 'handGlove115200') {
    return 115200;
  }
  if (isHandGloveType(sensorType) || ['footVideo', 'eye', 'daliegu', 'smallSample'].includes(sensorType) || String(sensorType).includes('robot')) {
    return 921600;
  }
  if (['bed4096', 'bed4096num'].includes(sensorType)) {
    return 3000000;
  }
  if (sensorType === SMALL_BED_12B_TYPE) {
    return 1500000;
  }
  if (sensorType === 'humanBody') {
    return 1000000;
  }
  return 1000000;
};

function maskMinzhenMatrixValues(frame) {
  if (!Array.isArray(frame)) return frame;
  MINZHEN_ZERO_POINT_INDEXES.forEach((index) => {
    if (index >= 0 && index < frame.length) {
      frame[index] = 0;
    }
  });
  return frame;
}

function applyMinzhenBackendGauss(frame) {
  if (!Array.isArray(frame) || frame.length < 1024) return maskMinzhenMatrixValues(frame);
  const normalizedFrame = frame.slice(0, 1024).map((value) => {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? nextValue : 0;
  });
  maskMinzhenMatrixValues(normalizedFrame);
  const blurredFrame = gaussBlur_return(normalizedFrame, 32, 32, MINZHEN_BACKEND_GAUSS_RADIUS);
  return maskMinzhenMatrixValues(blurredFrame);
}

function normalizeMinzhenSensorKey(rawKey = '') {
  const key = String(rawKey).trim();
  if (/yroscope/i.test(key)) return 'gyroscope';
  if (/thermistor0/i.test(key)) return 'thermistor0';
  if (/thermistor1/i.test(key)) return 'thermistor1';
  if (/thermistor2/i.test(key)) return 'thermistor2';
  if (/thermistor/i.test(key)) return 'thermistor';
  if (/humidity/i.test(key)) return 'humidity';
  return key;
}

function cleanMinzhenSensorNumber(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}

function parseMinzhenSensorFields(text = '') {
  console.log(text)
  const fields = [];
  const fieldPattern = /(yroscope|thermistor0|thermistor1|thermistor2|thermistor|humidity)\s*:/ig;
  const matches = [...String(text).matchAll(fieldPattern)];

  matches.forEach((match, index) => {
    const nextMatch = matches[index + 1];
    fields.push({
      key: normalizeMinzhenSensorKey(match[1]),
      value: String(text)
        .slice(match.index + match[0].length, nextMatch ? nextMatch.index : undefined)
        .trim(),
    });
  });

  return fields;
}

function parseMinzhenSensorFrame(buffer) {
  const text = buffer.toString();
  if (!/yroscope/i.test(text) || !/thermistor/i.test(text)) {
    return null;
  }

  const tempObj = {};
  parseMinzhenSensorFields(text).forEach((field) => {
    const { key, value } = field;
    if (!key) return;

    if (key === 'gyroscope') {
      const newValue = value
        .split(/[\t,\s]+/)
        .map((v) => cleanMinzhenSensorNumber(v))
        .filter(Boolean)
        .slice(0, 6);
      tempObj[key] = newValue;

      const angleFbRaw = Number(newValue[2]);
      const angleLrRaw = Number(newValue[0]);
      if (Number.isFinite(angleFbRaw)) {
        tempObj.angle_fb = (angleFbRaw / 15000).toFixed(2);
      }
      if (Number.isFinite(angleLrRaw)) {
        tempObj.angle_lr = (angleLrRaw / 15000).toFixed(2);
      }
    } else if (['thermistor0', 'thermistor1', 'thermistor2'].includes(key)) {
      tempObj[key] = cleanMinzhenSensorNumber(value);
    } else if (key === 'humidity') {
      tempObj[key] = cleanMinzhenSensorNumber(value);
    } else {
      tempObj[key] = value.trim();
    }
  });

  if (!Array.isArray(tempObj.gyroscope) || tempObj.gyroscope.length < 6) {
    return null;
  }
  if (!['thermistor0', 'thermistor1', 'thermistor2', 'humidity'].every((key) => tempObj[key] !== undefined)) {
    return null;
  }

  return { tempObj };
}

function getMinzhenSensorFrameStartIndex(text) {
  const match = String(text).match(MINZHEN_SENSOR_FRAME_START_PATTERN);
  return match ? match.index : -1;
}

function takeNextMinzhenSensorFrame() {
  const firstStart = getMinzhenSensorFrameStartIndex(minzhenSensorTextBuffer);
  if (firstStart < 0) {
    minzhenSensorTextBuffer = minzhenSensorTextBuffer.slice(-64);
    return null;
  }

  if (firstStart > 0) {
    minzhenSensorTextBuffer = minzhenSensorTextBuffer.slice(firstStart);
  }

  const nextStart = getMinzhenSensorFrameStartIndex(minzhenSensorTextBuffer.slice(1));
  if (nextStart >= 0) {
    const frameText = minzhenSensorTextBuffer.slice(0, nextStart + 1);
    minzhenSensorTextBuffer = minzhenSensorTextBuffer.slice(nextStart + 1);
    return frameText;
  }

  const humidityMatch = minzhenSensorTextBuffer.match(/humidity\s*:\s*-?\d+(?:\.\d+)?/i);
  if (humidityMatch) {
    const frameEnd = humidityMatch.index + humidityMatch[0].length;
    const frameText = minzhenSensorTextBuffer.slice(0, frameEnd);
    minzhenSensorTextBuffer = minzhenSensorTextBuffer.slice(frameEnd).slice(-64);
    return frameText;
  }

  return null;
}

let minzhenSensorTextBuffer = '';
function handleMinzhenSensorPortData(data) {
  if (file !== MINZHEN_TYPE || !licenseManager.isLicenseValid()) return;

  minzhenSensorTextBuffer += Buffer.from(data).toString();
  if (minzhenSensorTextBuffer.length > 4096) {
    minzhenSensorTextBuffer = minzhenSensorTextBuffer.slice(-4096);
  }

  let frameText = takeNextMinzhenSensorFrame();
  while (frameText) {
    const frame = parseMinzhenSensorFrame(Buffer.from(frameText));
    if (frame) {
      colOrSendData1(JSON.stringify(frame));
    }

    frameText = takeNextMinzhenSensorFrame();
  }
}

function bindBackPortParser() {
  if (!port2) return;
  if (file === MINZHEN_TYPE) {
    minzhenSensorTextBuffer = '';
    port2.on("data", handleMinzhenSensorPortData);
  } else {
    port2.pipe(parser2);
  }
}

function closeMinzhenSensorPort(reason = 'close') {
  minzhenSensorTextBuffer = '';
  if (!portSensor) return;

  portSensor.removeListener("data", handleMinzhenSensorPortData);
  const closingPort = portSensor;
  portSensor = null;
  if (closingPort.isOpen) {
    closingPort.close((err) => {
      if (err) logger.warn(`minzhen sensor port close error (${reason}):`, err);
    });
  }
}

function openMinzhenSensorPort(portPath) {
  if (!portPath) return;
  if (file !== MINZHEN_TYPE) return;
  sensorClose = false;
  comSensor = portPath;
  closeMinzhenSensorPort('reopen');

  try {
    portSensor = new SerialPort(
      {
        path: portPath,
        baudRate: MINZHEN_SENSOR_BAUD_RATE,
        autoOpen: true,
      },
      function (err) {
        if (err) logger.warn(err, "minzhen sensor port err");
      }
    );
    minzhenSensorTextBuffer = '';
    portSensor.on("data", handleMinzhenSensorPortData);
  } catch (e) {
    logger.warn(e, "minzhen sensor port open error");
  }
}

function rotateSquare90CounterClockwise(arr, size) {
  const matrix = [];
  for (let i = 0; i < size; i++) {
    matrix[i] = [];
    for (let j = 0; j < size; j++) {
      matrix[i].push(arr[i * size + j]);
    }
  }

  const temp = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const k = size - 1 - j;
      if (!temp[k]) {
        temp[k] = [];
      }
      temp[k][i] = matrix[i][j];
    }
  }
  return temp.flat();
}

function rotateMatrix90Clockwise(arr, height, width) {
  const matrix = Array.from({ length: height }, (_, i) =>
    arr.slice(i * width, i * width + width)
  );

  const newMatrix = [];
  for (let col = 0; col < width; col++) {
    newMatrix[col] = [];
    for (let row = 0; row < height; row++) {
      newMatrix[col][row] = matrix[height - 1 - row][col];
    }
  }
  return newMatrix.flat();
}

function flipMatrixVertical(arr, height, width) {
  const result = [];
  for (let row = height - 1; row >= 0; row--) {
    result.push(...arr.slice(row * width, row * width + width));
  }
  return result;
}

function flipMatrixHorizontal(arr, height, width) {
  const result = [];
  for (let row = 0; row < height; row++) {
    result.push(...arr.slice(row * width, row * width + width).reverse());
  }
  return result;
}

function applyWholeChairGauss(arr, width, height) {
  if (!Array.isArray(arr) || arr.length !== width * height) {
    return arr;
  }
  return gaussBlur_return(arr, width, height, WHOLE_CHAIR_GAUSS_RADIUS);
}

function parseFrameArray(data) {
  if (Array.isArray(data)) {
    return [...data];
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.warn('[wholeChair] failed to parse stored frame data', error);
      return [];
    }
  }
  return [];
}

function wholeChairSitLine(rawData) {
  const wsPointData = parseFrameArray(rawData);
  if (wsPointData.length !== 1024) {
    return wsPointData;
  }

  let resArr = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      resArr.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      [resArr[i * 16 + 8 + j], resArr[i * 16 + 8 + 7 - j]] =
        [resArr[i * 16 + 8 + 7 - j], resArr[i * 16 + 8 + j]];
    }
  }
  return applyWholeChairGauss(rotateSquare90CounterClockwise(resArr, 16), 16, 16);
}

function wholeChairBackLine(rawData) {
  const wsPointData = parseFrameArray(rawData);
  if (wsPointData.length !== 1024) {
    return wsPointData;
  }

  let resArr = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      resArr.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      [resArr[i * 16 + 8 + j], resArr[i * 16 + 8 + 7 - j]] =
        [resArr[i * 16 + 8 + 7 - j], resArr[i * 16 + 8 + j]];
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 16; j++) {
      [resArr[i * 16 + j], resArr[(15 - i) * 16 + j]] =
        [resArr[(15 - i) * 16 + j], resArr[i * 16 + j]];
    }
  }

  return applyWholeChairGauss(
    flipMatrixVertical(rotateSquare90CounterClockwise(resArr, 16), 16, 16),
    16,
    16
  );
}

function wholeChairHeadLine(rawData) {
  const wsPointData = parseFrameArray(rawData);
  if (wsPointData.length !== 1024) {
    return wsPointData;
  }

  let resArr = [];
  for (let i = 6; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      resArr.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 2; j++) {
      [resArr[i * 10 + 5 + j], resArr[i * 10 + 5 + 4 - j]] =
        [resArr[i * 10 + 5 + 4 - j], resArr[i * 10 + 5 + j]];
    }
  }

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 5; j++) {
      [resArr[i * 10 + j], resArr[i * 10 + 9 - j]] =
        [resArr[i * 10 + 9 - j], resArr[i * 10 + j]];
    }
  }

  return applyWholeChairGauss(
    flipMatrixVertical(rotateMatrix90Clockwise(resArr, 10, 10), 10, 10),
    10,
    10
  )
    .map((value) => value / 2);
}

function normalizeWholeChairFrame(section, data) {
  if (file !== WHOLE_CHAIR_TYPE) {
    return data;
  }
  if (section === 'sit') {
    return wholeChairSitLine(data);
  }
  if (section === 'back') {
    return wholeChairBackLine(data);
  }
  if (section === 'head') {
    return wholeChairHeadLine(data);
  }
  return parseFrameArray(data);
}

const WCH_ALLOWED_VENDOR_IDS = new Set(['1A86']);
const WCH_ALLOWED_PRODUCT_IDS = new Set(['7523', '55D3']);

function normalizeSerialIdentifier(value) {
  return String(value ?? '').trim().toUpperCase();
}

function hasWchSerialSignature(port = {}) {
  const vendorId = normalizeSerialIdentifier(port.vendorId ?? port.vendorIdentifier);
  const productId = normalizeSerialIdentifier(port.productId ?? port.productIdentifier);
  const pnpId = normalizeSerialIdentifier(port.pnpId);
  const manufacturer = normalizeSerialIdentifier(port.manufacturer);
  const friendlyName = normalizeSerialIdentifier(port.friendlyName);
  const portPath = normalizeSerialIdentifier(port.path);

  if (vendorId && WCH_ALLOWED_VENDOR_IDS.has(vendorId)) {
    return true;
  }

  if (pnpId.includes('VID_1A86')) {
    return true;
  }

  if (WCH_ALLOWED_PRODUCT_IDS.has(productId) && portPath.includes('USBSERIAL')) {
    return true;
  }

  if (portPath.includes('WCHUSBSERIAL')) {
    return true;
  }

  if (manufacturer.includes('WCH')) {
    return true;
  }

  return friendlyName.includes('CH34') || friendlyName.includes('USB-SERIAL') || friendlyName.includes('USB-ENHANCED-SERIAL');
}

function isWindowsTargetSerialPort(port = {}) {
  return hasWchSerialSignature(port);
}

function isMacTargetSerialPort(port = {}) {
  return hasWchSerialSignature(port);
}

function parseStoredFrameData(row) {
  if (!row?.data) return null;
  try {
    return JSON.parse(row.data);
  } catch (error) {
    return null;
  }
}

function getStoredSitData(row) {
  const storedData = parseStoredFrameData(row);
  if (Array.isArray(storedData)) return storedData;
  if (Array.isArray(storedData?.sitData)) return storedData.sitData;
  return [];
}

function getHistoryPressureData(row) {
  const storedData = parseStoredFrameData(row);
  if (Array.isArray(storedData)) return storedData;
  if (Array.isArray(storedData?.pressureData)) return storedData.pressureData;
  if (Array.isArray(storedData?.sitData)) return storedData.sitData;
  if (Array.isArray(storedData?.backData)) return storedData.backData;
  return [];
}

function normalizeHistoryPressureData(row, file = '') {
  const storedData = parseStoredFrameData(row);
  const data = getHistoryPressureData(row);
  if (file === SMALL_BED_12B_TYPE) {
    return smallBed12B.normalizePressureData(
      data,
      storedData,
      smallBed12BCalibration,
    );
  }
  const pressureData = isHandStorageType(file) && data.length > 256 ? data.slice(0, 256) : data;
  const normalizedData = pressureData.map((value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });
  if (file !== TEMP_FULL_BED_TYPE) return normalizedData;
  return normalizedData.map((value) => value < TEMP_FULL_BED_PRESSURE_THRESHOLD ? 0 : value);
}

function getCsvElapsedSeconds(rows, rowIndex, baseIndex = 0, frameIndex = 0) {
  const currentTimestamp = Number(rows?.[rowIndex]?.timestamp);
  const baseTimestamp = Number(rows?.[baseIndex]?.timestamp);
  if (Number.isFinite(currentTimestamp) && Number.isFinite(baseTimestamp)) {
    return ((currentTimestamp - baseTimestamp) / 1000).toFixed(3);
  }

  const fallbackHz = Number(colHZ) > 0 ? Number(colHZ) : 12;
  return (frameIndex / fallbackHz).toFixed(3);
}

function getCsvLanguage(downloadOptions = {}) {
  const language = String(downloadOptions.language || downloadOptions.locale || 'zh').toLowerCase();
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('ja')) return 'ja';
  return 'zh';
}

function getCsvFilePrefix(sensorType, fallbackPrefix, downloadOptions = {}) {
  if (sensorType === SMALL_BED_12B_TYPE) return '12B';
  if (sensorType === HAND_SINGLE_POINT_TYPE) {
    const detectionPrefixes = { zh: '检测点', en: 'detection', ja: '検出点' };
    return detectionPrefixes[getCsvLanguage(downloadOptions)];
  }
  if (isHandGloveType(sensorType) && fallbackPrefix === 'sit') return 'left';
  if (isHandGloveType(sensorType) && fallbackPrefix === 'back') return 'right';
  return fallbackPrefix;
}

function shouldSendRealtimeFrame(channel = 'sit') {
  if (!isHandGloveType(file)) return true;

  const now = Date.now();
  const lastSendAt = lastHandGloveRealtimeSendAt[channel] || 0;
  if (now - lastSendAt < HAND_GLOVE_REALTIME_SEND_INTERVAL_MS) {
    return false;
  }

  lastHandGloveRealtimeSendAt[channel] = now;
  return true;
}

function normalizeCollectFrequency(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 12;
  return Math.min(200, Math.max(1, numberValue));
}

function normalizeCollectOptions(options = {}) {
  const matrixDownsample = options.matrixDownsample && typeof options.matrixDownsample === 'object'
    ? options.matrixDownsample
    : {};
  const frequencyMode = options.frequencyMode === 'serial' ? 'serial' : 'custom';
  return {
    frequencyMode,
    frequencyHz: normalizeCollectFrequency(options.frequencyHz ?? colHZ),
    matrixDownsample: {
      enabled: matrixDownsample.enabled === true,
      sourceWidth: Number(matrixDownsample.sourceWidth) || 32,
      sourceHeight: Number(matrixDownsample.sourceHeight) || 32,
      targetWidth: Number(matrixDownsample.targetWidth) || 16,
      targetHeight: Number(matrixDownsample.targetHeight) || 16,
      blockWidth: Number(matrixDownsample.blockWidth) || 2,
      blockHeight: Number(matrixDownsample.blockHeight) || 2,
      samplePoint: matrixDownsample.samplePoint || 'topLeft',
    },
  };
}

function resetCollectionStorageClock() {
  oldTimeStamp = 0;
  lastCollectionStorageAt = { sit: 0, back: 0, head: 0 };
}

function shouldStoreCollectionFrame(channel = 'sit') {
  if (collectOptions.frequencyMode === 'serial') {
    const now = Date.now();
    lastCollectionStorageAt[channel] = now;
    oldTimeStamp = now;
    return true;
  }
  const hz = normalizeCollectFrequency(collectOptions.frequencyHz ?? colHZ);
  const intervalMs = 1000 / hz;
  const now = Date.now();
  const lastAt = lastCollectionStorageAt[channel] || 0;
  if (lastAt && now - lastAt < intervalMs) {
    return false;
  }
  lastCollectionStorageAt[channel] = now;
  oldTimeStamp = now;
  return true;
}

function getDownsampleOffset(samplePoint = 'topLeft') {
  switch (samplePoint) {
    case 'topRight':
      return { row: 0, col: 1 };
    case 'bottomLeft':
      return { row: 1, col: 0 };
    case 'bottomRight':
      return { row: 1, col: 1 };
    case 'topLeft':
    default:
      return { row: 0, col: 0 };
  }
}

function getSmallBed12BStorageSamplePoint(displaySamplePoint = 'topLeft') {
  switch (displaySamplePoint) {
    case 'topRight':
      return 'bottomLeft';
    case 'bottomLeft':
      return 'topRight';
    case 'bottomRight':
    case 'topLeft':
    default:
      return displaySamplePoint || 'topLeft';
  }
}

function downsampleMatrixByPoint(data, options = {}) {
  if (!Array.isArray(data)) return [];
  const sourceWidth = Number(options.sourceWidth) || 32;
  const sourceHeight = Number(options.sourceHeight) || 32;
  const targetWidth = Number(options.targetWidth) || Math.floor(sourceWidth / 2);
  const targetHeight = Number(options.targetHeight) || Math.floor(sourceHeight / 2);
  const blockWidth = Number(options.blockWidth) || Math.floor(sourceWidth / targetWidth);
  const blockHeight = Number(options.blockHeight) || Math.floor(sourceHeight / targetHeight);
  const offset = getDownsampleOffset(options.samplePoint);
  const result = [];

  for (let row = 0; row < targetHeight; row++) {
    for (let col = 0; col < targetWidth; col++) {
      const sourceRow = Math.min(sourceHeight - 1, row * blockHeight + Math.min(offset.row, blockHeight - 1));
      const sourceCol = Math.min(sourceWidth - 1, col * blockWidth + Math.min(offset.col, blockWidth - 1));
      result.push(data[sourceRow * sourceWidth + sourceCol] ?? 0);
    }
  }

  return result;
}

function expandDownsampledMatrixByPoint(data, options = {}) {
  if (!Array.isArray(data)) return [];
  const targetWidth = Number(options.targetWidth) || 16;
  const targetHeight = Number(options.targetHeight) || 16;
  const blockWidth = Number(options.blockWidth) || 2;
  const blockHeight = Number(options.blockHeight) || 2;
  const sourceWidth = Number(options.sourceWidth) || targetWidth * blockWidth;
  const sourceHeight = Number(options.sourceHeight) || targetHeight * blockHeight;
  const offset = getDownsampleOffset(options.samplePoint);
  const result = new Array(sourceWidth * sourceHeight).fill(0);

  for (let row = 0; row < targetHeight; row++) {
    for (let col = 0; col < targetWidth; col++) {
      const sourceRow = Math.min(sourceHeight - 1, row * blockHeight + Math.min(offset.row, blockHeight - 1));
      const sourceCol = Math.min(sourceWidth - 1, col * blockWidth + Math.min(offset.col, blockWidth - 1));
      result[sourceRow * sourceWidth + sourceCol] = data[row * targetWidth + col] ?? 0;
    }
  }

  return result;
}

function shouldDownsampleSmallBed12BCollection() {
  return file === SMALL_BED_12B_TYPE && collectOptions.matrixDownsample?.enabled === true;
}

function buildSmallBed12BCollectionStorageData(frameToStore) {
  return smallBed12B.buildCollectionStorageData(frameToStore, {
    collectOptions,
    transposeSquareMatrix,
  });
}

function buildSmallBedPlaybackPayload(row, extra = {}) {
  const storedData = parseStoredFrameData(row);
  if (file === SMALL_BED_12B_TYPE) {
    const sitData = normalizeHistoryPressureData(row, file);
    const isStoredObject = storedData && typeof storedData === 'object' && !Array.isArray(storedData);
    const inferredSize = sitData.length === 256 ? 16 : 32;
    return {
      sitData,
      pressureData: sitData,
      matrixWidth: Number(isStoredObject && storedData.matrixWidth) || inferredSize,
      matrixHeight: Number(isStoredObject && storedData.matrixHeight) || inferredSize,
      sourceMatrixWidth: isStoredObject ? storedData.sourceMatrixWidth : undefined,
      sourceMatrixHeight: isStoredObject ? storedData.sourceMatrixHeight : undefined,
      matrixOrientation: isStoredObject ? storedData.matrixOrientation : undefined,
      matrixDownsample: isStoredObject ? storedData.matrixDownsample : undefined,
      pressureUnit: 'kPa',
      time: row?.timestamp,
      ...extra,
    };
  }

  return {
    sitData: Array.isArray(storedData) ? storedData : [],
    time: row?.timestamp,
    ...extra,
  };
}

function parseStoredSensorFrame(storedData, sensorType = '') {
  if (storedData && typeof storedData === 'object' && !Array.isArray(storedData)) {
    return {
      pressureData: normalizeFiniteFrame(
        storedData.pressureData || storedData.rawPressureData || storedData.sitData || storedData.backData || storedData.headData || [],
      ),
      rotateData: normalizeFiniteFrame(storedData.rotate || storedData.quaternion || []),
      zeroFrame: normalizeFiniteFrame(storedData.zeroFrame || []),
    };
  }

  const data = Array.isArray(storedData) ? storedData : [];
  if (isHandGloveType(sensorType)) {
    if (data.length >= 260) {
      return {
        pressureData: normalizeFiniteFrame(data.slice(0, 256)),
        rotateData: normalizeFiniteFrame(data.slice(256, 260)),
        zeroFrame: [],
      };
    }
    if (data.length > 4 && data.length !== 256) {
      return {
        pressureData: normalizeFiniteFrame(data.slice(0, data.length - 4)),
        rotateData: normalizeFiniteFrame(data.slice(data.length - 4)),
        zeroFrame: [],
      };
    }
  }

  if (String(sensorType).includes('robot') && data.length >= 260) {
    return {
      pressureData: normalizeFiniteFrame(data.slice(0, 256)),
      rotateData: normalizeFiniteFrame(data.slice(256, 260)),
      zeroFrame: [],
    };
  }

  return {
    pressureData: normalizeFiniteFrame(data),
    rotateData: [],
    zeroFrame: [],
  };
}

function getZeroAwareStoragePressureData(frameToStore, dataKey) {
  const candidates = [
    frameToStore.rawPressureData,
    frameToStore[dataKey],
    frameToStore.realArr,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length >= 256) {
      return candidate.slice(0, 256);
    }
  }

  return [];
}

function getZeroFrameForStorage(channel = 'sit') {
  const source = channel === 'back'
    ? (pointArr2RawZero.length ? pointArr2RawZero : pointArr2zero)
    : channel === 'head'
      ? pointArr4zero
      : (pointArr1RawZero.length ? pointArr1RawZero : pointArr1zero);
  return Array.isArray(source) ? [...source] : [];
}

function buildZeroAwareStorageData(frameToStore, dataKey, channel = 'sit') {
  const pressureData = getZeroAwareStoragePressureData(frameToStore, dataKey);
  if (!isZeroFrameStorageType(file)) {
    return JSON.stringify(pressureData);
  }

  return JSON.stringify({
    pressureData,
    rotate: Array.isArray(frameToStore.rotate) ? [...frameToStore.rotate] : [],
    zeroFrame: getZeroFrameForStorage(channel),
  });
}

const HAND_GLOVE_CSV_SEGMENT_HEADER_TITLES = {
  zh: {
    littleFinger: '小拇指',
    ringFinger: '无名指',
    middleFinger: '中指',
    indexFinger: '食指',
    thumb: '大拇指',
    fingerRoot: '指根',
    palm: '手掌',
  },
  en: {
    littleFinger: 'littleFinger',
    ringFinger: 'ringFinger',
    middleFinger: 'middleFinger',
    indexFinger: 'indexFinger',
    thumb: 'thumb',
    fingerRoot: 'fingerRoot',
    palm: 'palm',
  },
  ja: {
    littleFinger: '小指',
    ringFinger: '薬指',
    middleFinger: '中指',
    indexFinger: '人差し指',
    thumb: '親指',
    fingerRoot: '指の付け根',
    palm: '手のひら',
  },
};

const HAND_GLOVE_CSV_SEGMENT_HEADER_IDS = [
  'littleFinger',
  'ringFinger',
  'middleFinger',
  'indexFinger',
  'thumb',
  'fingerRoot',
  'palm',
];

const CSV_TITLES = {
  zh: {
    index: '秒数',
    max: '矩阵最大值',
    time: '时间戳',
    pressureArea: '矩阵大于 0 的点数',
    pressure: '矩阵总和',
    pressValue: '矩阵总和',
    pressuremmgH: '压力',
    realData: '矩阵数据',
    realInitData: '原始矩阵数据',
    dataToInterpGauss: '算法数据',
    pressLine: '压力曲线',
    rotate: '四元数',
    temperatureData: '温度',
    temperatureAvg: '平均温度',
    temperatureK: '温度K值',
    zeroFrame: '清零帧',
    detectionPoint: '检测点',
    label: '标签',
    labelText: '标签文本',
  },
  en: {
    index: 'seconds',
    max: 'max',
    time: 'time',
    pressureArea: 'area',
    pressure: 'press',
    pressValue: 'pressTotal',
    pressuremmgH: 'pressure',
    realData: 'data',
    realInitData: 'realInitData',
    dataToInterpGauss: 'algorData',
    pressLine: 'pressLine',
    rotate: 'quaternion',
    temperatureData: 'temperatureCelsius',
    temperatureAvg: 'temperatureAvg',
    temperatureK: 'temperatureK',
    zeroFrame: 'zeroFrame',
    detectionPoint: 'detectionPoint',
    label: 'label',
    labelText: 'labelText',
  },
  ja: {
    index: '秒数',
    max: '最大値',
    time: 'タイムスタンプ',
    pressureArea: '0より大きいポイント数',
    pressure: '圧力合計',
    pressValue: '圧力合計',
    pressuremmgH: '圧力',
    realData: 'マトリックスデータ',
    realInitData: '元のマトリックスデータ',
    dataToInterpGauss: 'アルゴリズムデータ',
    pressLine: '圧力曲線',
    rotate: 'クォータニオン',
    temperatureData: '温度',
    temperatureAvg: '平均温度',
    temperatureK: '温度K値',
    zeroFrame: 'ゼロ補正フレーム',
    detectionPoint: '検出点',
    label: 'ラベル',
    labelText: 'ラベルテキスト',
  },
};

function getCsvTitleMap(downloadOptions = {}) {
  return CSV_TITLES[getCsvLanguage(downloadOptions)];
}

function getCsvTitleLanguage(languageTitles = CSV_TITLES.zh) {
  if (languageTitles === CSV_TITLES.en) return 'en';
  if (languageTitles === CSV_TITLES.ja) return 'ja';
  return 'zh';
}

function getHandGloveSideLabels(languageTitles = CSV_TITLES.zh) {
  return getCsvTitleLanguage(languageTitles) === 'en'
    ? { left: 'left', right: 'right' }
    : { left: '左手', right: '右手' };
}

function getHandGloveCsvFilePrefix(languageTitles = CSV_TITLES.zh) {
  const prefixes = { zh: '触觉手套2', en: 'glove2', ja: '触覚グローブ2' };
  return prefixes[getCsvTitleLanguage(languageTitles)];
}

const HAND_GLOVE_CSV_SEGMENT_POINTS = {
  left: {
    littleFinger: [31, 30, 29, 15, 14, 13, 255, 254, 253, 239, 238, 237],
    ringFinger: [28, 27, 26, 12, 11, 10, 252, 251, 250, 236, 235, 234],
    middleFinger: [25, 24, 23, 9, 8, 7, 249, 248, 247, 233, 232, 231],
    indexFinger: [22, 21, 20, 6, 5, 4, 246, 245, 244, 230, 229, 228],
    thumb: [19, 18, 17, 3, 2, 1, 243, 242, 241, 227, 226, 225],
    fingerRoot: [222, 219, 216, 213, 210],
    palm: [
      207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196,
      191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 180,
      179, 178, 177, 175, 174, 173, 172, 171, 170, 169, 168, 167,
      166, 165, 164, 163, 162, 161, 159, 158, 157, 156, 155, 154,
      153, 152, 151, 150, 149, 148, 147, 146, 145, 143, 142, 141,
      140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129,
    ],
  },
  right: {
    littleFinger: [228, 227, 226, 244, 243, 242, 4, 3, 2, 20, 19, 18],
    ringFinger: [231, 230, 229, 247, 246, 245, 7, 6, 5, 23, 22, 21],
    middleFinger: [234, 233, 232, 250, 249, 248, 10, 9, 8, 26, 25, 24],
    indexFinger: [237, 236, 235, 253, 252, 251, 13, 12, 11, 29, 28, 27],
    thumb: [240, 239, 238, 256, 255, 254, 16, 15, 14, 32, 31, 30],
    fingerRoot: [35, 38, 41, 44, 47],
    palm: [
      61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50,
      80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69,
      68, 67, 66, 96, 95, 94, 93, 92, 91, 90, 89, 88,
      87, 86, 85, 84, 83, 82, 112, 111, 110, 109, 108, 107,
      106, 105, 104, 103, 102, 101, 100, 99, 98, 128, 127, 126,
      125, 124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114,
    ],
  },
};

function appendHandGloveCsvHeaders(csvHeaders, languageTitles = CSV_TITLES.zh) {
  const segmentTitles = HAND_GLOVE_CSV_SEGMENT_HEADER_TITLES[getCsvTitleLanguage(languageTitles)];
  csvHeaders.push(
    ...HAND_GLOVE_CSV_SEGMENT_HEADER_IDS.map((id) => ({
      id,
      title: segmentTitles[id],
    })),
  );
}

function buildHandGloveCsvSegments(pressureData, side = 'left') {
  const data = Array.isArray(pressureData) ? pressureData : [];
  const points = HAND_GLOVE_CSV_SEGMENT_POINTS[side] || HAND_GLOVE_CSV_SEGMENT_POINTS.left;
  const readPoints = (pointIndexes = []) => pointIndexes.map((pointIndex) => data[pointIndex - 1] ?? 0);

  return {
    littleFinger: JSON.stringify(readPoints(points.littleFinger)),
    ringFinger: JSON.stringify(readPoints(points.ringFinger)),
    middleFinger: JSON.stringify(readPoints(points.middleFinger)),
    indexFinger: JSON.stringify(readPoints(points.indexFinger)),
    thumb: JSON.stringify(readPoints(points.thumb)),
    fingerRoot: JSON.stringify(readPoints(points.fingerRoot)),
    palm: JSON.stringify(readPoints(points.palm)),
  };
}

function appendPrefixedHandGloveCsvHeaders(csvHeaders, side, languageTitles = CSV_TITLES.zh) {
  const language = getCsvTitleLanguage(languageTitles);
  const segmentTitles = HAND_GLOVE_CSV_SEGMENT_HEADER_TITLES[language];
  const sideTitle = getHandGloveSideLabels(languageTitles)[side];
  HAND_GLOVE_CSV_SEGMENT_HEADER_IDS.forEach((id) => {
    const suffix = id.charAt(0).toUpperCase() + id.slice(1);
    csvHeaders.push({
      id: `${side}${suffix}`,
      title: language === 'en' ? `${side}${suffix}` : `${sideTitle}${segmentTitles[id]}`,
    });
  });
}

function buildPrefixedHandGloveCsvSegments(pressureData, side = 'left') {
  const segments = buildHandGloveCsvSegments(pressureData, side);
  return Object.fromEntries(
    Object.entries(segments).map(([key, value]) => {
      const suffix = key.charAt(0).toUpperCase() + key.slice(1);
      return [`${side}${suffix}`, value];
    }),
  );
}

function buildStoredHandGloveCsvFrame(row, side) {
  if (!row) {
    return {
      pressureData: [],
      rotateData: [],
      zeroFrame: [],
      timestamp: null,
    };
  }
  const rawData = JSON.parse(row.data || '[]');
  const frame = parseStoredSensorFrame(rawData, HAND_GLOVE_DOUBLE);
  return {
    pressureData: frame.pressureData,
    rotateData: frame.rotateData,
    zeroFrame: frame.zeroFrame,
    timestamp: row.timestamp,
    side,
  };
}

function exportHandGloveDoubleCsv({ selectQuery, params, csvTitle, csvTargetPath, sendCsvSuccess, sendCsvFailed, downloadOptions }) {
  db.all(selectQuery, params, (sitErr, sitRows) => {
    if (sitErr) {
      logger.error(sitErr);
      sendCsvFailed(sitErr);
      return;
    }

    db1.all(selectQuery, params, (backErr, backRows) => {
      if (backErr) {
        logger.error(backErr);
        sendCsvFailed(backErr);
        return;
      }

      const leftRows = Array.isArray(sitRows) ? sitRows : [];
      const rightRows = Array.isArray(backRows) ? backRows : [];
      const totalLength = Math.max(leftRows.length, rightRows.length);
      if (!totalLength) return;

      const start = Math.max(0, historyArr[0] || 0);
      const end = Math.min(historyArr[1] || totalLength, totalLength);
      const csvWriteData = [];
      const collectionLabelInfo = getCollectionCsvLabelInfo(params[0]);

      for (let i = start, j = 0; i < end; i++, j++) {
        const leftFrame = buildStoredHandGloveCsvFrame(leftRows[i], 'left');
        const rightFrame = buildStoredHandGloveCsvFrame(rightRows[i], 'right');
        const leftData = leftFrame.pressureData;
        const rightData = rightFrame.pressureData;
        const leftPress = leftData.reduce((sum, value) => sum + value, 0);
        const rightPress = rightData.reduce((sum, value) => sum + value, 0);
        const leftArea = leftData.filter((value) => value > 0).length;
        const rightArea = rightData.filter((value) => value > 0).length;
        const baseRows = leftRows.length ? leftRows : rightRows;

        csvWriteData.push(applyCollectionLabelInfo({
          index: getCsvElapsedSeconds(baseRows, i, start, j),
          time: timeStampToDate(leftFrame.timestamp || rightFrame.timestamp || Date.now()),
          leftMax: leftData.length ? findMax(leftData) : 0,
          leftPressureArea: leftArea,
          leftPressure: totalToN(leftPress),
          leftRealData: JSON.stringify(leftData),
          leftZeroFrame: leftFrame.zeroFrame.length ? JSON.stringify(leftFrame.zeroFrame) : '',
          leftRotate: leftFrame.rotateData.length ? JSON.stringify(leftFrame.rotateData) : '',
          rightMax: rightData.length ? findMax(rightData) : 0,
          rightPressureArea: rightArea,
          rightPressure: totalToN(rightPress),
          rightRealData: JSON.stringify(rightData),
          rightZeroFrame: rightFrame.zeroFrame.length ? JSON.stringify(rightFrame.zeroFrame) : '',
          rightRotate: rightFrame.rotateData.length ? JSON.stringify(rightFrame.rotateData) : '',
          ...buildPrefixedHandGloveCsvSegments(leftData, 'left'),
          ...buildPrefixedHandGloveCsvSegments(rightData, 'right'),
        }, collectionLabelInfo));
      }

      let str = params[0];
      if (str.includes(" ")) {
        str = str.split(" ")[0];
      } else {
        str = timeStampTo_Date(Number(str));
      }

      const sideLabel = getHandGloveSideLabels(csvTitle);
      const csvHeaders = [
        { id: "index", title: csvTitle.index },
        { id: "time", title: csvTitle.time },
        { id: "leftMax", title: `${sideLabel.left}${csvTitle.max}` },
        { id: "leftPressureArea", title: `${sideLabel.left}${csvTitle.pressureArea}` },
        { id: "leftPressure", title: `${sideLabel.left}${csvTitle.pressure}` },
        { id: "leftRealData", title: `${sideLabel.left}${csvTitle.realData}` },
        { id: "leftZeroFrame", title: `${sideLabel.left}${csvTitle.zeroFrame}` },
        { id: "leftRotate", title: `${sideLabel.left}${csvTitle.rotate}` },
        { id: "rightMax", title: `${sideLabel.right}${csvTitle.max}` },
        { id: "rightPressureArea", title: `${sideLabel.right}${csvTitle.pressureArea}` },
        { id: "rightPressure", title: `${sideLabel.right}${csvTitle.pressure}` },
        { id: "rightRealData", title: `${sideLabel.right}${csvTitle.realData}` },
        { id: "rightZeroFrame", title: `${sideLabel.right}${csvTitle.zeroFrame}` },
        { id: "rightRotate", title: `${sideLabel.right}${csvTitle.rotate}` },
      ];
      appendPrefixedHandGloveCsvHeaders(csvHeaders, 'left', csvTitle);
      appendPrefixedHandGloveCsvHeaders(csvHeaders, 'right', csvTitle);
      appendCollectionLabelHeaders(csvHeaders, csvTitle, collectionLabelInfo);

      const csvFilePath = csvTargetPath(`${getHandGloveCsvFilePrefix(csvTitle)}${str}.csv`);
      const csvWriter = createCsvWriter({
        path: csvFilePath,
        header: csvHeaders,
      });

      csvWriter
        .writeRecords(csvWriteData)
        .then(() => {
          console.log("export csv success");
          sendCsvSuccess([csvFilePath]);
        })
        .catch((err) => {
          console.error("export csv failed", err);
          sendCsvFailed(err);
        });
    });
  });
}

function transposeSquareMatrix(data, size = 32) {
  if (!Array.isArray(data) || data.length !== size * size) {
    return Array.isArray(data) ? [...data] : [];
  }

  return data.map((_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    return data[col * size + row];
  });
}

function shouldTransposeSmallBedRawMatrix(sensorType) {
  return sensorType === JQ_BED_TYPE || sensorType === SMALL_BED_TYPE || sensorType === SMALL_BED_NO_ALG_TYPE || sensorType === SMALL_BED_12B_TYPE;
}

function normalizeTempFullBedPlaybackPressureArray(data, frame = {}) {
  if (!Array.isArray(data)) return [];
  const pressureData = frame.matrixOrientation === 'transposed' || (frame.matrixWidth === 12 && frame.matrixHeight === 15)
    ? data.map((_, index) => {
      const row = Math.floor(index / 15);
      const col = index % 15;
      return data[col * 12 + row];
    })
    : data;
  return pressureData.map((value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < TEMP_FULL_BED_PRESSURE_THRESHOLD) return 0;
    return numberValue;
  });
}

function buildTempFullBedPlaybackPayload(row, extra = {}) {
  const storedData = parseStoredFrameData(row);
  const frame = Array.isArray(storedData) ? { sitData: storedData } : (storedData || {});
  const sitData = normalizeTempFullBedPlaybackPressureArray(frame.sitData, frame);
  const rawSitData = normalizeTempFullBedPlaybackPressureArray(frame.rawSitData, frame);
  return {
    sitData,
    rawSitData: rawSitData.length ? rawSitData : undefined,
    matrixWidth: 15,
    matrixHeight: 12,
    matrixOrientation: 'row-major',
    realArr: Array.isArray(frame.realArr) ? frame.realArr : undefined,
    pressureThreshold: frame.pressureThreshold || TEMP_FULL_BED_PRESSURE_THRESHOLD,
    temperatureRawData: Array.isArray(frame.temperatureRawData) ? frame.temperatureRawData : [],
    temperatureData: Array.isArray(frame.temperatureData) ? frame.temperatureData : [],
    temperatureAvg: frame.temperatureAvg,
    temperatureK: frame.temperatureK,
    time: row?.timestamp,
    ...extra,
  };
}

const getPort = (ports) => {
  const portList = Array.isArray(ports) ? ports : [];

  if (process.platform === 'win32') {
    const filteredPorts = portList.filter(isWindowsTargetSerialPort);
    logger.info(`[SerialList] filter win32 whitelist matched ${filteredPorts.length}/${portList.length} port(s)`);
    return filteredPorts;
  }

  if (process.platform === 'darwin') {
    const filteredPorts = portList.filter(isMacTargetSerialPort);
    logger.info(`[SerialList] filter darwin whitelist matched ${filteredPorts.length}/${portList.length} port(s)`);
    return filteredPorts;
  }

  return portList
}

function summarizeSerialPort(port = {}) {
  const summary = {
    path: port.path ?? null,
    manufacturer: port.manufacturer ?? null,
    serialNumber: port.serialNumber ?? null,
    pnpId: port.pnpId ?? null,
    vendorId: port.vendorId ?? null,
    productId: port.productId ?? null,
    friendlyName: port.friendlyName ?? null,
    locationId: port.locationId ?? null,
  }

  if (port.vendorIdentifier != null) {
    summary.vendorIdentifier = port.vendorIdentifier
  }

  if (port.productIdentifier != null) {
    summary.productIdentifier = port.productIdentifier
  }

  return summary
}

function logSerialPortList(reason, ports) {
  const portList = Array.isArray(ports) ? ports : []
  logger.info(`[SerialList] ${reason}: detected ${portList.length} port(s)`)

  if (portList.length === 0) {
    logger.warn(`[SerialList] ${reason}: no serial ports detected`)
    return
  }

  portList.forEach((port, index) => {
    logger.info(`[SerialList] ${reason} #${index + 1}`, summarizeSerialPort(port))
  })
}

let baudRate = 1000000

let serialport = { a: 1, b: 2 }
const timeNum = 1000 / 12;
let port2,
  port1,
  portHead,
  portSensor,
  localFlag = false,
  playFlag = false,
  nowIndex = 0,
  interval = timeNum,
  detectedInterval = timeNum,
  timer,
  parserOpen,
  parser2Open,
  time;



let timeStamp,
  historyArr,
  newsit,
  newback,
  backAreaSelect = [],
  backPressSelect = [],
  sitAreaSelect = [],
  sitClose = false,
  backClose = false,
  headClose = false,
  sensorClose = false,
  sitPressSelect = [];
const sitnum1 = 64;
const sitnum2 = 64;
const backnum1 = 64;
const backnum2 = 64;
let smoothValue = 0;
let onbedArr = []; // jqbed 鍦ㄥ簥鐘舵€佹暟缁?
let onBedTime = 0; // jqbed 鍦ㄥ簥/绂诲簥璁℃椂锛堢锛?
let useMatrixOrigin = false; // jqbed 璋冭瘯 flag锛歵rue 鏃剁敤绠楁硶杩斿洖鐨?matrix_origin 浣滀负 sitData
let jqbedMatrixOrigin = null; // 缂撳瓨绠楁硶杩斿洖鐨?matrix_origin 鏁版嵁
const PET_CARE_SYSTEM_TYPES = new Set(['petCare', 'petCareMini']);
const VITAL_SIGNS_SYSTEM_TYPES = new Set(['jqbed', 'smallBed']);
const PET_CARE_HEART_RATE_UPDATE_INTERVAL_MS = 1000;
const clampPetHeartRateValue = (value, min, max) => Math.max(min, Math.min(max, value));
const randPetHeartRateValue = (min, max) => min + Math.random() * (max - min);
const randPetHeartRateProb = (probability) => Math.random() < probability;
const normalizePetHeartRateBreathRate = (value) => Number(value).toFixed(1);
function gaussianPetHeartRate(mean, std) {
  let u1;
  do {
    u1 = Math.random();
  } while (u1 === 0);
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * std;
}
function createPetHeartRateFormulaState() {
  return {
    breathPhase: 0,
    rsaAmp: 3.5,
    trendHR: 70,
    trendRR: 14,
    event: 0,
    lastHeartRate: 0,
  };
}
function createPetCareHeartRateSimulatorState() {
  return {
    ...createPetHeartRateFormulaState(),
    breathRateQueue: [],
  };
}
function createVitalSignsHeartRateSimulatorState() {
  return {
    ...createPetHeartRateFormulaState(),
    lastHeartRateAt: 0,
  };
}
function resetPetCareHeartRateSimulatorState(simulator) {
  simulator.breathPhase = 0;
  simulator.rsaAmp = 3.5;
  simulator.trendHR = 70;
  simulator.trendRR = 14;
  simulator.event = 0;
  simulator.lastHeartRate = 0;
  simulator.breathRateQueue = [];
}
function resetVitalSignsHeartRateSimulatorState(simulator) {
  simulator.breathPhase = 0;
  simulator.rsaAmp = 3.5;
  simulator.trendHR = 70;
  simulator.trendRR = 14;
  simulator.event = 0;
  simulator.lastHeartRate = 0;
  simulator.lastHeartRateAt = 0;
}
function nextPetHeartRate(rr, simulator) {
  if (rr === 0) {
    return 0;
  }

  const dt = 1.0;
  simulator.breathPhase += 2 * Math.PI * rr / 60.0 * dt;
  simulator.rsaAmp += randPetHeartRateValue(-0.05, 0.05);
  simulator.rsaAmp = clampPetHeartRateValue(simulator.rsaAmp, 2, 6);

  const rsa = Math.sin(simulator.breathPhase - 1.0) * simulator.rsaAmp;
  const base = 65 + (rr - 12) * 1.5;

  simulator.trendHR += randPetHeartRateValue(-0.1, 0.1);
  simulator.trendHR = clampPetHeartRateValue(simulator.trendHR, 60, 80);

  if (randPetHeartRateProb(0.003)) {
    simulator.event = randPetHeartRateValue(5, 12);
  }
  simulator.event *= 0.95;

  const noise = gaussianPetHeartRate(0, 1);
  const heartRate = base * 0.4 + simulator.trendHR * 0.6 + rsa + simulator.event + noise;

  return clampPetHeartRateValue(Math.round(heartRate), 55, 100);
}
const createPetCareRuntimeState = () => ({
  stateArr: [],
  stableState: null,
  stateStartedAt: 0,
  resetPending: true,
  processing: false,
  lastLoggedAt: 0,
  heartRateSimulator: createPetCareHeartRateSimulatorState(),
});
const vitalSignsHeartRateSimulator = {
  jqbed: createVitalSignsHeartRateSimulatorState(),
  smallBed: createVitalSignsHeartRateSimulatorState(),
};
const petCareSystems = {
  petCare: {
    eventKey: 'petCare',
    rpcReset: 'reset_pet_care',
    rpcStep: 'pet_care_step',
    runtime: createPetCareRuntimeState(),
  },
  petCareMini: {
    eventKey: 'petCareMini',
    rpcReset: 'reset_pet_care_mini',
    rpcStep: 'pet_care_mini_step',
    runtime: createPetCareRuntimeState(),
  },
};
function isPetCareSystem(type) {
  return PET_CARE_SYSTEM_TYPES.has(type);
}

function resetPetCareRuntime(systemKey) {
  Object.assign(petCareSystems[systemKey].runtime, createPetCareRuntimeState());
}
let lastData = new Array(1024).fill(0),
  firstData = new Array(1024).fill(0);
const backTotal = backnum1 * backnum2;
const sitTotal = sitnum1 * sitnum2;
let length, history, nowGetTime;

// 授权校验已统一到 licenseManager（在线版服务器时间 / 离线版防回拨可信时间）；
// 全局 nowDate、endDate 与旧的 sensor.bodyta.com getSystemTime 均已删除，过期/到期由 licenseManager 维护。

const runtimeResourceRoot = app.isPackaged ? process.resourcesPath : __dirname;
const runtimeWritableRoot = app.isPackaged ? app.getPath('userData') : __dirname;
const exportRoot = app.isPackaged
  ? (process.platform === 'darwin' ? app.getPath('desktop') : process.resourcesPath)
  : runtimeWritableRoot;
let filePath = path.join(runtimeWritableRoot, "db");
let csvPath = path.join(exportRoot, "data");
let imgPath = path.join(runtimeWritableRoot, "img");
let pdfPath = app.isPackaged
  ? (process.platform === 'win32' ? path.join(process.resourcesPath, "OneStep") : path.join(exportRoot, "oneStepPdf"))
  : path.join(runtimeWritableRoot, "oneStepPdf");
let nameTxt = resolveConfigFile();
let writableNameTxt = getWritableConfigFile();

if (!fs.existsSync(filePath)) {
  fs.mkdirSync(filePath, { recursive: true });
}

if (!fs.existsSync(csvPath)) {
  fs.mkdirSync(csvPath, { recursive: true });
}
if (!fs.existsSync(imgPath)) {
  fs.mkdirSync(imgPath, { recursive: true });
}
if (!fs.existsSync(pdfPath)) {
  fs.mkdirSync(pdfPath, { recursive: true });
}

logger.info("[Path] resourceRoot=", runtimeResourceRoot);
logger.info("[Path] writableRoot=", runtimeWritableRoot);
logger.info("[Path] db=", filePath, "data=", csvPath, "config=", nameTxt);
logger.info("[Path] configCandidates=", getConfigFileCandidates().join(", "));

function readTrimmedConfigFile(configPath) {
  try {
    return fs.readFileSync(configPath, 'utf8').trim();
  } catch (err) {
    logger.warn(`[License] 读取密钥文件失败：${configPath}，${err && err.message}`);
    return '';
  }
}

function getSavedLicenseKey() {
  const stateKey = licenseManager.getState().rawKey;
  if (stateKey && String(stateKey).trim()) {
    return String(stateKey).trim();
  }

  for (const candidate of getConfigFileCandidates()) {
    if (!fs.existsSync(candidate)) continue;
    const rawKey = readTrimmedConfigFile(candidate);
    if (rawKey) return rawKey;
  }

  return '';
}

function findStartupLicenseConfig() {
  let firstExisting = null;

  for (const candidate of getConfigFileCandidates()) {
    if (!fs.existsSync(candidate)) continue;
    if (!firstExisting) firstExisting = candidate;

    const rawKey = readTrimmedConfigFile(candidate);
    if (!rawKey) {
      logger.warn(`[License] 跳过空密钥文件：${candidate}`);
      continue;
    }

    const peeked = licenseManager.peekPayload(rawKey);
    if (peeked) {
      if (candidate !== firstExisting) {
        logger.info(`[License] 使用兼容路径中的有效密钥：${candidate}`);
      }
      return { path: candidate, rawKey, peeked };
    }

    logger.warn(`[License] 跳过无法解析的密钥文件：${candidate}`);
  }

  if (firstExisting) {
    return {
      path: firstExisting,
      rawKey: readTrimmedConfigFile(firstExisting),
      peeked: null,
    };
  }

  return null;
}

function persistStartupLicenseToWritable(sourcePath, rawKey) {
  const source = path.normalize(sourcePath || '');
  const target = path.normalize(writableNameTxt || '');
  if (!source || !target || source.toLowerCase() === target.toLowerCase() || !rawKey) {
    return true;
  }

  try {
    const existing = fs.existsSync(writableNameTxt) ? readTrimmedConfigFile(writableNameTxt) : '';
    if (existing === rawKey) return true;

    fs.mkdirSync(path.dirname(writableNameTxt), { recursive: true });
    fs.writeFileSync(writableNameTxt, rawKey, 'utf8');
    logger.info(`[License] 已将旧路径密钥迁移到当前可写路径：${writableNameTxt}`);
    return true;
  } catch (err) {
    logger.warn(`[License] 迁移旧路径密钥失败：${err && err.message}`);
    return false;
  }
}

function getSavedLicenseKeyForClient() {
  const candidates = [
    nameTxt,
    writableNameTxt,
    ...getConfigFileCandidates(),
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    if (!fs.existsSync(candidate)) continue;
    const rawKey = readTrimmedConfigFile(candidate);
    if (rawKey) return rawKey;
  }

  return licenseManager.getState().rawKey || '';
}

function validateWritableDirectory(targetDir) {
  const dir = String(targetDir || '').trim();
  if (!dir) {
    return { ok: false, error: 'download path is empty' };
  }
  const testFile = path.join(dir, `.shroom-write-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.tmp`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return { ok: true, dir };
  } catch (error) {
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    } catch {
      // Ignore cleanup failure.
    }
    return { ok: false, error: error.message };
  }
}

function getCsvExportDirectory(downloadOptions = {}) {
  const requestedDir =
    (typeof downloadOptions.path === 'string' && downloadOptions.path.trim()) ||
    (typeof downloadOptions.dir === 'string' && downloadOptions.dir.trim()) ||
    csvPath;
  return validateWritableDirectory(requestedDir);
}

function broadcastCsvDownloadResult(download, { files = [], dir = '', error = '' } = {}) {
  server.clients.forEach(function each(client) {
    const jsonData = JSON.stringify({
      download,
      downloadStatus: download === 'export csv success' ? 'success' : 'failed',
      downloadFiles: files,
      downloadDir: dir,
      downloadError: error,
    });
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

function broadcastCsvDownloadProgress(progress = {}) {
  server.clients.forEach(function each(client) {
    const jsonData = JSON.stringify({
      csvDownloadProgress: progress,
      downloadStatus: 'progress',
      downloadDir: progress.dir || '',
    });
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

function broadcastCollectionStorageError(error = {}) {
  if (!server || !server.clients) return;
  const jsonData = JSON.stringify({
    collectionStorageError: {
      message: error.message || '数据库空间不足，已停止采集',
      freeBytes: error.freeBytes,
      minFreeBytes: error.minFreeBytes,
      file,
      saveTime,
    },
  });
  server.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

function getCollectionFreeBytes() {
  try {
    if (typeof fs.statfsSync !== 'function') return null;
    const stat = fs.statfsSync(filePath);
    return Number(stat.bavail ?? stat.bfree ?? 0) * Number(stat.bsize || 0);
  } catch (error) {
    logger.warn('[Collection] failed to check free disk space:', error.message || error);
    return null;
  }
}

function stopCollectionForStorageError(error, extra = {}) {
  flag = false;
  const message = error?.message || String(error || '数据库写入失败，已停止采集');
  logger.error('[Collection] stop collection:', message);
  broadcastCollectionStorageError({
    message: message.includes('database or disk is full')
      ? '磁盘空间不足，数据库写入失败，已自动停止采集'
      : message,
    ...extra,
  });
}

let lastCollectionDiskCheckAt = 0;
function hasEnoughCollectionDiskSpace() {
  const now = Date.now();
  if (now - lastCollectionDiskCheckAt < 1000) return true;
  lastCollectionDiskCheckAt = now;

  const freeBytes = getCollectionFreeBytes();
  if (freeBytes == null || freeBytes >= COLLECTION_MIN_FREE_BYTES) return true;

  stopCollectionForStorageError(
    new Error('磁盘剩余空间不足，已自动停止采集'),
    { freeBytes, minFreeBytes: COLLECTION_MIN_FREE_BYTES },
  );
  return false;
}

function handleCollectionDbError(err, channel) {
  if (!err) return;
  const message = err.message || String(err);
  if (err.code === 'SQLITE_FULL' || message.includes('database or disk is full')) {
    stopCollectionForStorageError(err, {
      channel,
      freeBytes: getCollectionFreeBytes(),
      minFreeBytes: COLLECTION_MIN_FREE_BYTES,
    });
    return;
  }
  logger.error(err);
}

// initDb 鍖呰鍑芥暟锛岃嚜鍔ㄤ紶鍏?filePath 鍜?runtimeResourceRoot
function initDb(fileStr) {
  return _initDbFromModule(fileStr, filePath, runtimeResourceRoot);
}

const HISTORY_EAGER_ROW_LIMIT = 50000;
const HISTORY_CHART_SAMPLE_LIMIT = 2000;
const historyStmtCache = new WeakMap();

function getNativeDb(dbRef) {
  return dbRef && (dbRef._db || dbRef.db || null);
}

function getHistoryStmt(dbRef, sql) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.prepare !== 'function') {
    throw new Error('invalid history database handle');
  }
  let cache = historyStmtCache.get(nativeDb);
  if (!cache) {
    cache = new Map();
    historyStmtCache.set(nativeDb, cache);
  }
  if (!cache.has(sql)) {
    cache.set(sql, nativeDb.prepare(sql));
  }
  return cache.get(sql);
}

function dbGetHistory(dbRef, sql, params = []) {
  return getHistoryStmt(dbRef, sql).get(...params);
}

function dbAllHistory(dbRef, sql, params = []) {
  return getHistoryStmt(dbRef, sql).all(...params);
}

function ensureHistoryIndexes(dbRef) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.exec !== 'function') return;
  try {
    nativeDb.exec('CREATE INDEX IF NOT EXISTS idx_matrix_date_id ON matrix(date, id)');
  } catch (error) {
    logger.warn('[History] failed to ensure index:', error.message || error);
  }
}

function getHistoryStats(dbRef, date) {
  if (!dbRef || !date) return { count: 0, minId: 0, maxId: 0 };
  ensureHistoryIndexes(dbRef);
  const row = dbGetHistory(
    dbRef,
    'SELECT COUNT(*) AS count, MIN(id) AS minId, MAX(id) AS maxId FROM matrix WHERE date = ?',
    [date],
  ) || {};
  return {
    count: Number(row.count || 0),
    minId: Number(row.minId || 0),
    maxId: Number(row.maxId || 0),
  };
}

function queryHistoryRows(dbRef, date, limit, offset = 0) {
  if (!dbRef || !date || limit <= 0) return [];
  ensureHistoryIndexes(dbRef);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? ORDER BY id ASC LIMIT ? OFFSET ?',
    [date, limit, Math.max(0, offset)],
  );
}

function queryHistoryTimestampSample(dbRef, date, limit = 21) {
  return queryHistoryRows(dbRef, date, limit, 0)
    .map((row) => row.timestamp)
    .filter((value) => value != null);
}

function queryHistoryRowsFromId(dbRef, date, minId, limit) {
  if (!dbRef || !date || !minId || limit <= 0) return [];
  ensureHistoryIndexes(dbRef);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? AND id >= ? ORDER BY id ASC LIMIT ?',
    [date, minId, limit],
  );
}

function createLazyHistoryRows(dbRef, date, stats) {
  const cache = new Map();
  const maxCacheSize = 512;
  const lengthValue = Number(stats?.count || 0);
  const minId = Number(stats?.minId || 0);

  const readByIndex = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= lengthValue || !minId) return undefined;
    if (cache.has(index)) return cache.get(index);
    const row = dbGetHistory(
      dbRef,
      'SELECT * FROM matrix WHERE date = ? AND id >= ? ORDER BY id ASC LIMIT 1',
      [date, minId + index],
    );
    if (cache.size >= maxCacheSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(index, row);
    return row;
  };

  return new Proxy([], {
    get(target, prop) {
      if (prop === 'length') return lengthValue;
      if (prop === '__lazyHistoryRows') return true;
      if (prop === '__historyDate') return date;
      if (prop === '__historyDb') return dbRef;
      if (prop === Symbol.iterator) {
        return function* lazyIterator() {
          for (let i = 0; i < lengthValue; i++) {
            yield readByIndex(i);
          }
        };
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return readByIndex(Number(prop));
      }
      return target[prop];
    },
  });
}

function getHistorySeries({ sitRows = [], backRows = [], start = 0, end = null, file = '' }) {
  const safeSitRows = Array.isArray(sitRows) ? sitRows : [];
  const safeBackRows = Array.isArray(backRows) ? backRows : [];
  const hasSit = safeSitRows.length > 0;
  const hasBack = safeBackRows.length > 0;
  const totalLength = hasSit && hasBack
    ? Math.min(safeSitRows.length, safeBackRows.length)
    : (hasSit ? safeSitRows.length : safeBackRows.length);
  const rangeStart = Math.max(0, start);
  const rangeEnd = Math.min(end == null ? totalLength : end, totalLength);
  const baseRows = hasSit ? safeSitRows : safeBackRows;
  const press = [];
  const area = [];
  const time = [];
  const rangeLength = Math.max(0, rangeEnd - rangeStart);
  const sampleStep = rangeLength > HISTORY_CHART_SAMPLE_LIMIT
    ? Math.ceil(rangeLength / HISTORY_CHART_SAMPLE_LIMIT)
    : 1;

  for (let i = rangeStart; i < rangeEnd; i += sampleStep) {
    const sitData = hasSit && safeSitRows[i] ? normalizeHistoryPressureData(safeSitRows[i], file) : null;
    const backData = hasBack && safeBackRows[i] ? normalizeHistoryPressureData(safeBackRows[i], file) : null;
    const sitTotalValue = sitData ? sitData.reduce((a, b) => a + b, 0) : 0;
    const backTotalValue = backData ? backData.reduce((a, b) => a + b, 0) : 0;
    const sitAreaValue = sitData ? sitData.filter((a) => a > 10).length : 0;
    const backAreaValue = backData ? backData.filter((a) => a > 10).length : 0;

    press.push(
      (sitData ? formatMatrixTotalForFile(sitTotalValue, file) : 0) +
      (backData ? totalToN(backTotalValue, 1.3) : 0)
    );
    area.push(sitAreaValue + backAreaValue);

    if (baseRows[i] && baseRows[i].timestamp != null) {
      time.push(baseRows[i].timestamp);
    }
  }

  return {
    length: totalLength,
    press,
    area,
    time,
    sampleStep,
  };
}

function getHistoryLengthFromCounts(...counts) {
  const positiveCounts = counts
    .map((value) => Number(value || 0))
    .filter((value) => value > 0);
  if (!positiveCounts.length) return 0;
  return Math.min(...positiveCounts);
}

function createHistoryRowsForPlayback(dbRef, date, stats, eager) {
  if (!stats?.count) return [];
  return eager
    ? queryHistoryRows(dbRef, date, stats.count, 0)
    : createLazyHistoryRows(dbRef, date, stats);
}

function buildZeroPlaybackFrame() {
  return file === "bigBed"
    ? new Array(2048).fill(0)
    : new Array(1024).fill(0);
}

function buildZeroPlaybackPayload() {
  if (file !== SMALL_BED_12B_TYPE) {
    return { sitData: buildZeroPlaybackFrame() };
  }
  const size = smallBed12BDisplayOptions.matrixMode === '16x16' ? 16 : 32;
  return {
    sitData: new Array(size * size).fill(0),
    matrixWidth: size,
    matrixHeight: size,
    pressureUnit: 'kPa',
  };
}

function broadcastHistorySelectionPayload(payload) {
  server.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  });
}

function loadSelectedHistory(dateLabel) {
  try {
    stopPlaybackTimer();
    nowIndex = 0;
    localData = [];
    localDataBack = [];
    localDataHead = [];

    const sitStats = getHistoryStats(db, dateLabel);
    const backStats = isCar(file) && db1 ? getHistoryStats(db1, dateLabel) : { count: 0, minId: 0, maxId: 0 };
    const headStats = isThreePortFile(file) && db2 ? getHistoryStats(db2, dateLabel) : { count: 0, minId: 0, maxId: 0 };
    const totalLength = isThreePortFile(file)
      ? getHistoryLengthFromCounts(sitStats.count, backStats.count, headStats.count)
      : isCar(file)
        ? getHistoryLengthFromCounts(sitStats.count, backStats.count)
        : getHistoryLengthFromCounts(sitStats.count);
    const maxRows = Math.max(sitStats.count, backStats.count, headStats.count);
    const eager = maxRows <= HISTORY_EAGER_ROW_LIMIT;

    localData = createHistoryRowsForPlayback(db, dateLabel, sitStats, eager);
    if (isCar(file) && db1) {
      localDataBack = createHistoryRowsForPlayback(db1, dateLabel, backStats, eager);
    }
    if (isThreePortFile(file) && db2) {
      localDataHead = createHistoryRowsForPlayback(db2, dateLabel, headStats, eager);
    }

    length = totalLength;
    indexArr = [0, Math.max(length - 2, 0)];
    historyArr = [0, length];
    const timestampDb = sitStats.count ? db : (backStats.count && db1 ? db1 : db);
    timeStamp = queryHistoryTimestampSample(timestampDb, dateLabel, 21);
    detectedInterval = calcDetectedInterval(timeStamp);
    interval = detectedInterval;

    const historySeries = getHistorySeries({
      sitRows: localData,
      backRows: localDataBack,
      start: 0,
      end: length,
      file,
    });

    logger.info(`[History] selected ${dateLabel}: length=${length}, eager=${eager}, sampleStep=${historySeries.sampleStep || 1}`);

    broadcastHistorySelectionPayload({
      length,
      time: timeStamp,
      index: nowIndex,
      pressArr: historySeries.press,
      areaArr: historySeries.area,
      historyTimeArr: historySeries.time,
      historySampleStep: historySeries.sampleStep || 1,
      historyLazy: !eager,
      ...buildZeroPlaybackPayload(),
    });

    if (isThreePortFile(file)) {
      broadcastHistorySelectionPayload({
        headData: file === "bigBed" ? new Array(2048).fill(0) : new Array(100).fill(0),
      });
    }
  } catch (error) {
    logger.error('[History] failed to load selected history:', error);
    broadcastHistorySelectionPayload({
      historyError: error.message || 'load history failed',
    });
  }
}

function formatCsvDatePart(value) {
  let str = String(value || '');
  if (str.includes(" ")) {
    str = str.split(" ")[0];
  } else {
    str = timeStampTo_Date(Number(str));
  }
  return str;
}

function getCollectionCsvLabelInfo(value) {
  const datePart = formatCsvDatePart(value);
  const namePart = datePart.replace(/_\d{4}-\d{1,2}-\d{1,2}-\d{2}-\d{2}-\d{2}-\d+$/, '');
  if (!namePart || namePart === datePart && /^\d+$/.test(namePart)) return { label: '', labelText: '' };
  const labelTextMatch = namePart.match(/([^_]+_\d+)$/);
  const labelText = labelTextMatch ? labelTextMatch[1] : '';
  const labelMatch = labelText.match(/_(\d+)$/);
  return {
    label: labelMatch ? labelMatch[1] : '',
    labelText,
  };
}

function parseCsvMatrixData(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function transposeMatColToVisualDirection(data) {
  const source = Array.isArray(data) ? data : [];
  const sourceWidth = 10;
  const sourceHeight = 16;
  if (source.length !== sourceWidth * sourceHeight) {
    return source;
  }

  const result = [];
  for (let row = 0; row < sourceWidth; row++) {
    for (let col = 0; col < sourceHeight; col++) {
      result.push(source[col * sourceWidth + row]);
    }
  }
  return result;
}

function formatMatColCsvRealData(value) {
  const parsed = parseCsvMatrixData(value);
  if (!parsed.length) return value;
  return JSON.stringify(transposeMatColToVisualDirection(parsed));
}

function formatMatrixTotalForFile(value, targetFile = file) {
  const numberValue = Number(value);
  const safeValue = Number.isFinite(numberValue) ? numberValue : 0;
  if (targetFile === SMALL_BED_12B_TYPE) {
    return Number(safeValue.toFixed(1));
  }
  return totalToN(safeValue);
}

function buildCollectionCsvHeaders(csvTitle, { includeLabel = true } = {}) {
  const headers = getDefaultSitCsvHeaders(csvTitle);
  if (includeLabel) {
    headers.push(
      { id: "label", title: csvTitle.label },
      { id: "labelText", title: csvTitle.labelText },
    );
  }
  return headers;
}

function buildCollectionCsvRow(row, { absoluteIndex = 0, relativeIndex = 0, baseTimestamp = null } = {}, csvTitle, {
  transformRealData = (value) => value,
  label = '',
  labelText = '',
} = {}) {
  const matrixData = parseCsvMatrixData(transformRealData(row?.data));
  const press = matrixData.reduce((sum, value) => sum + Number(value || 0), 0);
  const newData = {
    index: getCsvElapsedSecondsFromBase(row, absoluteIndex, baseTimestamp, relativeIndex),
    max: matrixData.length ? findMax(matrixData) : 0,
    time: timeStampToDate(row?.timestamp),
    pressureArea: matrixData.filter((value) => Number(value) > 0).length,
    pressure: formatMatrixTotalForFile(press, file),
    realData: matrixData.length ? JSON.stringify(matrixData) : transformRealData(row?.data),
  };
  if (label || labelText) {
    newData.label = label;
    newData.labelText = labelText;
  } else {
    newData.label = '';
    newData.labelText = '';
  }
  return newData;
}

function hasCollectionLabelInfo(labelInfo = {}) {
  return Boolean(labelInfo && (labelInfo.label || labelInfo.labelText));
}

function appendCollectionLabelHeaders(headers, csvTitle, labelInfo = {}) {
  if (!hasCollectionLabelInfo(labelInfo)) return headers;
  headers.push(
    { id: "label", title: csvTitle.label },
    { id: "labelText", title: csvTitle.labelText },
  );
  return headers;
}

function applyCollectionLabelInfo(row, labelInfo = {}) {
  if (!hasCollectionLabelInfo(labelInfo)) return row;
  return {
    ...row,
    label: labelInfo.label || '',
    labelText: labelInfo.labelText || '',
  };
}

function getCsvElapsedSecondsFromBase(row, rowIndex, baseTimestamp, fallbackIndex = 0) {
  if (row?.timestamp != null && baseTimestamp != null) {
    const diffMs = Number(row.timestamp) - Number(baseTimestamp);
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      return (diffMs / 1000).toFixed(3);
    }
  }
  const fallbackHz = Number(colHZ) > 0 ? Number(colHZ) : 12;
  return (fallbackIndex / fallbackHz).toFixed(3);
}

function writeStreamChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.off('error', onError);
      stream.off('drain', onDrain);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    stream.once('error', onError);
    if (!stream.write(chunk)) {
      stream.once('drain', onDrain);
    } else {
      cleanup();
      resolve();
    }
  });
}

function closeWriteStream(stream) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      stream.off('finish', onFinish);
      reject(error);
    };
    const onFinish = () => {
      stream.off('error', onError);
      resolve();
    };
    stream.once('error', onError);
    stream.once('finish', onFinish);
    stream.end();
  });
}

async function writeCsvFileInBatches({
  csvFilePath,
  header,
  dbRef,
  date,
  start = 0,
  end = null,
  mapRow,
  batchSize = 1000,
  onProgress = null,
}) {
  const stats = getHistoryStats(dbRef, date);
  if (!stats.count) return 0;
  const rangeStart = Math.max(0, Number(start || 0));
  const rangeEnd = Math.min(end == null ? stats.count : Number(end), stats.count);
  if (rangeStart >= rangeEnd) return 0;
  const firstRow = queryHistoryRowsFromId(dbRef, date, stats.minId + rangeStart, 1)[0];
  const baseTimestamp = firstRow?.timestamp ?? null;
  const stringifier = createCsvStringifier({ header });
  const stream = fs.createWriteStream(csvFilePath, { encoding: 'utf8' });
  let written = 0;
  let nextId = stats.minId + rangeStart;
  const total = rangeEnd - rangeStart;
  let lastProgressAt = 0;
  const emitProgress = (force = false) => {
    if (typeof onProgress !== 'function') return;
    const now = Date.now();
    if (!force && now - lastProgressAt < 250 && written < total) return;
    lastProgressAt = now;
    onProgress({
      csvFilePath,
      written,
      total,
      percent: total ? Math.min(100, Math.round((written / total) * 100)) : 100,
    });
  };

  try {
    await writeStreamChunk(stream, stringifier.getHeaderString());
    emitProgress(true);
    while (written < rangeEnd - rangeStart) {
      const rows = queryHistoryRowsFromId(
        dbRef,
        date,
        nextId,
        Math.min(batchSize, rangeEnd - rangeStart - written),
      );
      if (!rows.length) break;
      const records = [];
      for (let batchIndex = 0; batchIndex < rows.length; batchIndex++) {
        const row = rows[batchIndex];
        const absoluteIndex = rangeStart + written + batchIndex;
        records.push(mapRow(row, {
          absoluteIndex,
          relativeIndex: written + batchIndex,
          baseTimestamp,
        }));
      }
      await writeStreamChunk(stream, stringifier.stringifyRecords(records));
      written += rows.length;
      nextId = Number(rows[rows.length - 1].id) + 1;
      emitProgress();
    }
    await closeWriteStream(stream);
    emitProgress(true);
    return written;
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

function buildGenericSitCsvRow(row, { absoluteIndex, relativeIndex, baseTimestamp }, csvTitle, options = {}) {
  const {
    isHandType = false,
    isHandGloveCsvType = false,
    shouldWriteZeroFrame = false,
    shouldWriteDetectionPoint = false,
    collectionLabelInfo = null,
  } = options;
  const rawData = JSON.parse(row?.data || '[]');
  let pressureData, rotateData, zeroFrameData = [];
  let tempFullBedPayload = null;
  if (file === TEMP_FULL_BED_TYPE) {
    tempFullBedPayload = buildTempFullBedPlaybackPayload(row);
    pressureData = tempFullBedPayload.sitData;
    rotateData = [];
  } else if (shouldWriteZeroFrame) {
    const storedFrame = parseStoredSensorFrame(rawData, file);
    pressureData = storedFrame.pressureData;
    rotateData = storedFrame.rotateData;
    zeroFrameData = storedFrame.zeroFrame;
  } else if (isHandType) {
    if (rawData.length >= 260) {
      pressureData = rawData.slice(0, 256);
      rotateData = rawData.slice(256, 260);
    } else {
      pressureData = rawData.slice(0, rawData.length - 4);
      rotateData = rawData.slice(rawData.length - 4);
    }
  } else {
    pressureData = Array.isArray(rawData) ? rawData : getHistoryPressureData(row);
    rotateData = [];
  }
  if (file === WHOLE_CHAIR_TYPE) {
    pressureData = normalizeWholeChairFrame('sit', pressureData);
  }
  if (shouldTransposeSmallBedRawMatrix(file)) {
    pressureData = transposeSquareMatrix(pressureData);
  }
  const press = pressureData.reduce((a, b) => a + b, 0);
  const area = pressureData.filter((a) => a > 0).length;
  const newData = {
    time: timeStampToDate(row?.timestamp),
    pressureArea: area,
    pressure: totalToN(press),
    realData: JSON.stringify(pressureData),
    index: getCsvElapsedSecondsFromBase(row, absoluteIndex, baseTimestamp, relativeIndex),
    max: findMax(pressureData),
    rotate: rotateData.length ? JSON.stringify(rotateData) : '',
    zeroFrame: zeroFrameData.length ? JSON.stringify(zeroFrameData) : '',
    temperatureData: tempFullBedPayload ? JSON.stringify(tempFullBedPayload.temperatureData.map((value) => Number(value).toFixed(1))) : '',
    temperatureAvg: tempFullBedPayload?.temperatureAvg != null ? Number(tempFullBedPayload.temperatureAvg).toFixed(1) : '',
    temperatureK: tempFullBedPayload?.temperatureK ?? '',
  };
  if (shouldWriteDetectionPoint) {
    newData.detectionPoint = pressureData[pressureData.length - 1] ?? '';
  }
  if (isHandGloveCsvType) {
    Object.assign(newData, buildHandGloveCsvSegments(pressureData, 'left'));
  }
  return applyCollectionLabelInfo(newData, collectionLabelInfo);
}

function buildGenericBackCsvRow(row, { absoluteIndex, relativeIndex, baseTimestamp }, options = {}) {
  const {
    isBackHandType = false,
    isBackHandGloveType = false,
    shouldWriteBackZeroFrame = false,
    collectionLabelInfo = null,
  } = options;
  const rawBackData = JSON.parse(row?.data || '[]');
  let backData, backRotateData, backZeroFrameData = [];
  if (shouldWriteBackZeroFrame) {
    const storedBackFrame = parseStoredSensorFrame(rawBackData, file);
    backData = storedBackFrame.pressureData;
    backRotateData = storedBackFrame.rotateData;
    backZeroFrameData = storedBackFrame.zeroFrame;
  } else if (isBackHandType && rawBackData.length >= 260) {
    backData = rawBackData.slice(0, 256);
    backRotateData = rawBackData.slice(256, 260);
  } else if (isBackHandType && rawBackData.length > 4) {
    backData = rawBackData.slice(0, rawBackData.length - 4);
    backRotateData = rawBackData.slice(rawBackData.length - 4);
  } else {
    backData = rawBackData;
    backRotateData = [];
  }
  if (file === WHOLE_CHAIR_TYPE) {
    backData = normalizeWholeChairFrame('back', backData);
  }
  const press = backData.reduce((a, b) => a + b, 0);
  const area = backData.filter((a) => a > 10).length;
  const area1 = backData.filter((a) => a > 1).length;
  const area10Data = backData.filter((a) => a > 10);
  const total10 = area10Data.reduce((a, b) => a + b, 0);
  const total1 = backData.reduce((a, b) => a + b, 0);
  const newData = {
    time: timeStampToDate(row?.timestamp),
    pressureArea: area,
    pressure: totalToN(press, 1.3),
    realData: JSON.stringify(backData),
    index: getCsvElapsedSecondsFromBase(row, absoluteIndex, baseTimestamp, relativeIndex),
    area1,
    area10: area10Data.length,
    total1,
    total10,
    total10area10: total10 / (area10Data.length || 1),
    total1area1: total1 / (area1 || 1),
    max: findMax(backData),
    rotate: backRotateData.length ? JSON.stringify(backRotateData) : '',
    zeroFrame: backZeroFrameData.length ? JSON.stringify(backZeroFrameData) : '',
  };
  if (isBackHandGloveType) {
    Object.assign(newData, buildHandGloveCsvSegments(backData, 'right'));
  }
  return applyCollectionLabelInfo(newData, collectionLabelInfo);
}

function buildHeadCsvRow(row, { absoluteIndex, relativeIndex, baseTimestamp }, options = {}) {
  const { collectionLabelInfo = null } = options;
  const headData = file === WHOLE_CHAIR_TYPE
    ? normalizeWholeChairFrame('head', row?.data)
    : JSON.parse(row?.data || '[]');
  const press = headData.reduce((a, b) => a + b, 0);
  const area = headData.filter((a) => a > 10).length;
  const area1 = headData.filter((a) => a > 1).length;
  const area10Data = headData.filter((a) => a > 10);
  const total10 = area10Data.reduce((a, b) => a + b, 0);
  const total1 = headData.reduce((a, b) => a + b, 0);
  return applyCollectionLabelInfo({
    time: timeStampToDate(row?.timestamp),
    pressureArea: area,
    pressure: totalToN(press, 1.3),
    realData: JSON.stringify(headData),
    index: getCsvElapsedSecondsFromBase(row, absoluteIndex, baseTimestamp, relativeIndex),
    area1,
    area10: area10Data.length,
    total1,
    total10,
    total10area10: total10 / (area10Data.length || 1),
    total1area1: total1 / (area1 || 1),
    max: findMax(headData),
  }, collectionLabelInfo);
}

function getDefaultSitCsvHeaders(csvTitle, {
  isHandGloveCsvType = false,
  shouldWriteDetectionPoint = false,
  shouldWriteZeroFrame = false,
  isHandType = false,
  collectionLabelInfo = null,
} = {}) {
  const csvHeaders = [
    { id: "index", title: csvTitle.index },
    { id: "max", title: csvTitle.max },
    { id: "time", title: csvTitle.time },
    { id: "pressureArea", title: csvTitle.pressureArea },
    { id: "pressure", title: csvTitle.pressure },
    { id: "realData", title: csvTitle.realData },
  ];
  if (isHandGloveCsvType) {
    appendHandGloveCsvHeaders(csvHeaders, csvTitle);
  }
  if (shouldWriteDetectionPoint) {
    csvHeaders.push({ id: "detectionPoint", title: csvTitle.detectionPoint });
  }
  if (shouldWriteZeroFrame) {
    csvHeaders.push({ id: "zeroFrame", title: csvTitle.zeroFrame });
  }
  if (isHandType) {
    csvHeaders.push({ id: "rotate", title: csvTitle.rotate });
  }
  if (file === TEMP_FULL_BED_TYPE) {
    csvHeaders.push(
      { id: "temperatureData", title: csvTitle.temperatureData },
      { id: "temperatureAvg", title: csvTitle.temperatureAvg },
      { id: "temperatureK", title: csvTitle.temperatureK },
    );
  }
  appendCollectionLabelHeaders(csvHeaders, csvTitle, collectionLabelInfo);
  return csvHeaders;
}

function getDefaultBackCsvHeaders(csvTitle, {
  isBackHandGloveType = false,
  shouldWriteBackZeroFrame = false,
  isBackHandType = false,
  collectionLabelInfo = null,
} = {}) {
  const backCsvHeaders = [
    { id: "index", title: csvTitle.index },
    { id: "time", title: csvTitle.time },
    { id: "max", title: csvTitle.max },
    { id: "pressureArea", title: csvTitle.pressureArea },
    { id: "pressure", title: csvTitle.pressure },
    { id: "realData", title: csvTitle.realData },
  ];
  if (isBackHandGloveType) {
    appendHandGloveCsvHeaders(backCsvHeaders, csvTitle);
  }
  if (shouldWriteBackZeroFrame) {
    backCsvHeaders.push({ id: "zeroFrame", title: csvTitle.zeroFrame });
  }
  if (isBackHandType) {
    backCsvHeaders.push({ id: "rotate", title: csvTitle.rotate });
  }
  appendCollectionLabelHeaders(backCsvHeaders, csvTitle, collectionLabelInfo);
  return backCsvHeaders;
}

function getHeadCsvHeaders(csvTitle, { collectionLabelInfo = null } = {}) {
  const headers = [
    { id: "index", title: csvTitle.index },
    { id: "time", title: csvTitle.time },
    { id: "max", title: csvTitle.max },
    { id: "pressureArea", title: csvTitle.pressureArea },
    { id: "pressure", title: csvTitle.pressure },
    { id: "realData", title: csvTitle.realData },
  ];
  appendCollectionLabelHeaders(headers, csvTitle, collectionLabelInfo);
  return headers;
}

async function exportHandGloveDoubleCsvStreaming({ date, csvTitle, csvTargetPath, sendCsvSuccess, sendCsvFailed, sendCsvProgress }) {
  const leftStats = getHistoryStats(db, date);
  const rightStats = getHistoryStats(db1, date);
  const totalLength = Math.max(leftStats.count, rightStats.count);
  if (!totalLength) {
    sendCsvFailed(new Error('no rows to export'));
    return;
  }
  const start = Math.max(0, historyArr[0] || 0);
  const end = Math.min(historyArr[1] || totalLength, totalLength);
  const sideLabel = getHandGloveSideLabels(csvTitle);
  const collectionLabelInfo = getCollectionCsvLabelInfo(date);
  const csvHeaders = [
    { id: "index", title: csvTitle.index },
    { id: "time", title: csvTitle.time },
    { id: "leftMax", title: `${sideLabel.left}${csvTitle.max}` },
    { id: "leftPressureArea", title: `${sideLabel.left}${csvTitle.pressureArea}` },
    { id: "leftPressure", title: `${sideLabel.left}${csvTitle.pressure}` },
    { id: "leftRealData", title: `${sideLabel.left}${csvTitle.realData}` },
    { id: "leftZeroFrame", title: `${sideLabel.left}${csvTitle.zeroFrame}` },
    { id: "leftRotate", title: `${sideLabel.left}${csvTitle.rotate}` },
    { id: "rightMax", title: `${sideLabel.right}${csvTitle.max}` },
    { id: "rightPressureArea", title: `${sideLabel.right}${csvTitle.pressureArea}` },
    { id: "rightPressure", title: `${sideLabel.right}${csvTitle.pressure}` },
    { id: "rightRealData", title: `${sideLabel.right}${csvTitle.realData}` },
    { id: "rightZeroFrame", title: `${sideLabel.right}${csvTitle.zeroFrame}` },
    { id: "rightRotate", title: `${sideLabel.right}${csvTitle.rotate}` },
  ];
  appendPrefixedHandGloveCsvHeaders(csvHeaders, 'left', csvTitle);
  appendPrefixedHandGloveCsvHeaders(csvHeaders, 'right', csvTitle);
  appendCollectionLabelHeaders(csvHeaders, csvTitle, collectionLabelInfo);

  let str = formatCsvDatePart(nowGetTime || date);
  const csvFilePath = csvTargetPath(`${getHandGloveCsvFilePrefix(csvTitle)}${str}.csv`);
  const stringifier = createCsvStringifier({ header: csvHeaders });
  const stream = fs.createWriteStream(csvFilePath, { encoding: 'utf8' });
  let written = 0;
  let leftNextId = leftStats.minId + start;
  let rightNextId = rightStats.minId + start;
  const baseRow = (leftStats.count ? queryHistoryRowsFromId(db, date, leftNextId, 1) : queryHistoryRowsFromId(db1, date, rightNextId, 1))[0];
  const baseTimestamp = baseRow?.timestamp ?? null;
  const batchSize = 1000;
  const emitProgress = (force = false) => {
    if (typeof sendCsvProgress !== 'function') return;
    const total = end - start;
    sendCsvProgress({
      percent: total ? Math.min(99, Math.round((written / total) * 100)) : 100,
      filePercent: total ? Math.min(100, Math.round((written / total) * 100)) : 100,
      written,
      total,
      fileIndex: 1,
      fileCount: 1,
      currentFile: path.basename(csvFilePath),
      currentFilePath: csvFilePath,
      force,
    });
  };

  try {
    await writeStreamChunk(stream, stringifier.getHeaderString());
    emitProgress(true);
    while (written < end - start) {
      const limit = Math.min(batchSize, end - start - written);
      const leftRows = queryHistoryRowsFromId(db, date, leftNextId, limit);
      const rightRows = queryHistoryRowsFromId(db1, date, rightNextId, limit);
      const count = Math.max(leftRows.length, rightRows.length);
      if (!count) break;
      const records = [];
      for (let index = 0; index < count; index++) {
        const leftFrame = buildStoredHandGloveCsvFrame(leftRows[index], 'left');
        const rightFrame = buildStoredHandGloveCsvFrame(rightRows[index], 'right');
        const leftData = leftFrame.pressureData;
        const rightData = rightFrame.pressureData;
        const leftPress = leftData.reduce((sum, value) => sum + value, 0);
        const rightPress = rightData.reduce((sum, value) => sum + value, 0);
        const leftArea = leftData.filter((value) => value > 0).length;
        const rightArea = rightData.filter((value) => value > 0).length;
        const baseFrameRow = leftRows[index] || rightRows[index];
        records.push(applyCollectionLabelInfo({
          index: getCsvElapsedSecondsFromBase(baseFrameRow, start + written + index, baseTimestamp, written + index),
          time: timeStampToDate(leftFrame.timestamp || rightFrame.timestamp || Date.now()),
          leftMax: leftData.length ? findMax(leftData) : 0,
          leftPressureArea: leftArea,
          leftPressure: totalToN(leftPress),
          leftRealData: JSON.stringify(leftData),
          leftZeroFrame: leftFrame.zeroFrame.length ? JSON.stringify(leftFrame.zeroFrame) : '',
          leftRotate: leftFrame.rotateData.length ? JSON.stringify(leftFrame.rotateData) : '',
          rightMax: rightData.length ? findMax(rightData) : 0,
          rightPressureArea: rightArea,
          rightPressure: totalToN(rightPress),
          rightRealData: JSON.stringify(rightData),
          rightZeroFrame: rightFrame.zeroFrame.length ? JSON.stringify(rightFrame.zeroFrame) : '',
          rightRotate: rightFrame.rotateData.length ? JSON.stringify(rightFrame.rotateData) : '',
          ...buildPrefixedHandGloveCsvSegments(leftData, 'left'),
          ...buildPrefixedHandGloveCsvSegments(rightData, 'right'),
        }, collectionLabelInfo));
      }
      await writeStreamChunk(stream, stringifier.stringifyRecords(records));
      written += count;
      if (leftRows.length) leftNextId = Number(leftRows[leftRows.length - 1].id) + 1;
      if (rightRows.length) rightNextId = Number(rightRows[rightRows.length - 1].id) + 1;
      emitProgress();
    }
    await closeWriteStream(stream);
    if (typeof sendCsvProgress === 'function') {
      sendCsvProgress({
        percent: 100,
        filePercent: 100,
        written: end - start,
        total: end - start,
        fileIndex: 1,
        fileCount: 1,
        currentFile: path.basename(csvFilePath),
        currentFilePath: csvFilePath,
        force: true,
      });
    }
    sendCsvSuccess([csvFilePath]);
  } catch (error) {
    stream.destroy();
    sendCsvFailed(error, [csvFilePath]);
  }
}

async function exportHistoryCsvStreaming({ date, csvTitle, csvTargetPath, sendCsvSuccess, sendCsvFailed, sendCsvProgress, downloadOptions }) {
  try {
    const files = [];
    const start = Math.max(0, historyArr[0] || 0);
    const end = historyArr[1] || null;
    const str = formatCsvDatePart(nowGetTime || date);
    const createProgressReporter = (csvFilePath, fileIndex, fileCount) => (progress) => {
      if (typeof sendCsvProgress !== 'function') return;
      const filePercent = Number(progress.percent) || 0;
      const overallPercent = Math.min(
        99,
        Math.round((((fileIndex - 1) + filePercent / 100) / Math.max(1, fileCount)) * 100),
      );
      sendCsvProgress({
        percent: overallPercent,
        filePercent,
        written: progress.written,
        total: progress.total,
        fileIndex,
        fileCount,
        currentFile: path.basename(csvFilePath),
        currentFilePath: csvFilePath,
      });
    };
    const collectionLabelInfo = getCollectionCsvLabelInfo(date);

    if (file === HAND_GLOVE_DOUBLE) {
      await exportHandGloveDoubleCsvStreaming({ date, csvTitle, csvTargetPath, sendCsvSuccess, sendCsvFailed, sendCsvProgress, downloadOptions });
      return;
    }

    if (file === "bigBed") {
      let startPressure = 0;
      let pressureTime = 0;
      let streamSmoothValue = 0;
      const csvFilePath = csvTargetPath(`${file}${String(nowGetTime || date).replace(/[/:]/g, "-")}.csv`);
      await writeCsvFileInBatches({
        csvFilePath,
        header: appendCollectionLabelHeaders([
          { id: "time", title: csvTitle.time },
          { id: "pressureArea", title: csvTitle.pressureArea },
          { id: "pressValue", title: csvTitle.pressValue },
          { id: "pressure", title: csvTitle.pressure },
          { id: "pressuremmgH", title: csvTitle.pressuremmgH },
          { id: "realData", title: csvTitle.realData },
          { id: "pressLine", title: csvTitle.pressLine },
        ], csvTitle, collectionLabelInfo),
        dbRef: db,
        date,
        start,
        end,
        onProgress: createProgressReporter(csvFilePath, 1, 1),
        mapRow: (row) => {
          const wsData = JSON.parse(row?.data || '[]').map((a) => a < 10 ? 0 : a);
          const realArr = wsData;
          const bodyArr = [];
          for (let col = 0; col < 64; col++) {
            let num = 0;
            for (let r = 0; r < 32; r++) {
              num += realArr[r * 64 + col];
            }
            streamSmoothValue = streamSmoothValue + (num / 32 - streamSmoothValue) / 3;
            bodyArr.push(streamSmoothValue.toFixed(2));
          }
          const total = realArr.reduce((a, b) => a + b, 0);
          let nonZeroLength = realArr.filter((a) => a > 0).length || 1;
          let pressure = calculatePressure(total / nonZeroLength);
          const newPressure = total / nonZeroLength;
          const change = objChange(newPressure, startPressure, 4);
          if (change) {
            startPressure = newPressure;
            pressureTime = 0;
          } else {
            pressureTime++;
            pressure = calculatePressure(calPress(startPressure, newPressure, pressureTime));
            if (pressureTime > 240 * 13) pressureTime = 240 * 13;
          }
          return applyCollectionLabelInfo({
            time: timeStampToDate(row?.timestamp),
            pressureArea: realArr.filter((a) => a > 0).length,
            pressure: total / nonZeroLength,
            realData: realArr,
            pressValue: wsData.reduce((a, b) => a + b, 0),
            pressuremmgH: pressure,
            pressLine: bodyArr,
          }, collectionLabelInfo);
        },
      });
      files.push(csvFilePath);
      sendCsvSuccess(files);
      return;
    }

    if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE || file === 'smallBed1') {
      const csvFilePath = csvTargetPath(`${file}${str}.csv`);
      await writeCsvFileInBatches({
        csvFilePath,
        header: getDefaultSitCsvHeaders(csvTitle, { collectionLabelInfo }),
        dbRef: db,
        date,
        start,
        end,
        onProgress: createProgressReporter(csvFilePath, 1, 1),
        mapRow: (row, meta) => {
          const storedFrame = parseStoredFrameData(row);
          let matrixWidth = Number(storedFrame?.matrixWidth) || Math.sqrt(normalizeHistoryPressureData(row, file).length) || 32;
          let matrixHeight = Number(storedFrame?.matrixHeight) || matrixWidth;
          let sitData = normalizeHistoryPressureData(row, file);
          if (shouldTransposeSmallBedRawMatrix(file) && matrixWidth === matrixHeight) {
            sitData = transposeSquareMatrix(sitData, matrixWidth);
          }
          const press = sitData.reduce((a, b) => a + b, 0);
          const area = sitData.filter((a) => a > 0).length;
          return applyCollectionLabelInfo({
            time: timeStampToDate(row?.timestamp),
            pressureArea: area,
            pressure: totalToN(press),
            realData: JSON.stringify(sitData),
            index: getCsvElapsedSecondsFromBase(row, meta.absoluteIndex, meta.baseTimestamp, meta.relativeIndex),
            max: findMax(sitData),
          }, collectionLabelInfo);
        },
      });
      files.push(csvFilePath);
      sendCsvSuccess(files);
      return;
    }

    if (file === 'sitCol' || file === 'matCol') {
      const { label, labelText } = getCollectionCsvLabelInfo(date);
      const csvFilePath = csvTargetPath(`${file}${str}.csv`);
      await writeCsvFileInBatches({
        csvFilePath,
        header: file === 'matCol'
          ? buildCollectionCsvHeaders(csvTitle)
          : [
            { id: "realData", title: csvTitle.realData },
            { id: "label", title: csvTitle.label },
            { id: "labelText", title: csvTitle.labelText },
          ],
        dbRef: db,
        date,
        start: 0,
        end: null,
        onProgress: createProgressReporter(csvFilePath, 1, 1),
        mapRow: (row, meta) => file === 'matCol'
          ? buildCollectionCsvRow(row, meta, csvTitle, {
            transformRealData: formatMatColCsvRealData,
            label,
            labelText,
          })
          : ({
            realData: row?.data,
            label,
            labelText,
          }),
      });
      files.push(csvFilePath);
      sendCsvSuccess(files);
      return;
    }

    const isHandType = isHandStorageType(file);
    const isHandGloveCsvType = isHandGloveType(file);
    const shouldWriteZeroFrame = isZeroFrameStorageType(file);
    const shouldWriteDetectionPoint = file === HAND_SINGLE_POINT_TYPE;
    const genericFileCount = (file !== "car10" ? 1 : 0) + (isCar(file) ? 1 : 0) + (isCar(file) && isThreePortFile(file) ? 1 : 0);
    let genericFileIndex = 0;
    if (file !== "car10") {
      const csvFilePath = csvTargetPath(`${getCsvFilePrefix(file, 'sit', downloadOptions || {})}${str}.csv`);
      genericFileIndex += 1;
      await writeCsvFileInBatches({
        csvFilePath,
        header: getDefaultSitCsvHeaders(csvTitle, {
          isHandGloveCsvType,
          shouldWriteDetectionPoint,
          shouldWriteZeroFrame,
          isHandType,
          collectionLabelInfo,
        }),
        dbRef: db,
        date,
        start,
        end: end == null ? null : Math.max(start, end - 1),
        onProgress: createProgressReporter(csvFilePath, genericFileIndex, genericFileCount || 1),
        mapRow: (row, meta) => buildGenericSitCsvRow(row, meta, csvTitle, {
          isHandType,
          isHandGloveCsvType,
          shouldWriteZeroFrame,
          shouldWriteDetectionPoint,
          collectionLabelInfo,
        }),
      });
      files.push(csvFilePath);
    }

    if (isCar(file)) {
      const isBackHandType = isHandStorageType(file);
      const isBackHandGloveType = isHandGloveType(file);
      const shouldWriteBackZeroFrame = isZeroFrameStorageType(file);
      const backCsvFilePath = csvTargetPath(`${getCsvFilePrefix(file, 'back', downloadOptions || {})}${str}.csv`);
      genericFileIndex += 1;
      await writeCsvFileInBatches({
        csvFilePath: backCsvFilePath,
        header: getDefaultBackCsvHeaders(csvTitle, {
          isBackHandGloveType,
          shouldWriteBackZeroFrame,
          isBackHandType,
          collectionLabelInfo,
        }),
        dbRef: db1,
        date,
        start,
        end,
        onProgress: createProgressReporter(backCsvFilePath, genericFileIndex, genericFileCount || 1),
        mapRow: (row, meta) => buildGenericBackCsvRow(row, meta, {
          isBackHandType,
          isBackHandGloveType,
          shouldWriteBackZeroFrame,
          collectionLabelInfo,
        }),
      });
      files.push(backCsvFilePath);

      if (isThreePortFile(file)) {
        const headCsvFilePath = csvTargetPath(`head${str}.csv`);
        genericFileIndex += 1;
        await writeCsvFileInBatches({
          csvFilePath: headCsvFilePath,
          header: getHeadCsvHeaders(csvTitle, { collectionLabelInfo }),
          dbRef: db2,
          date,
          start,
          end,
          onProgress: createProgressReporter(headCsvFilePath, genericFileIndex, genericFileCount || 1),
          mapRow: (row, meta) => buildHeadCsvRow(row, meta, { collectionLabelInfo }),
        });
        files.push(headCsvFilePath);
      }
    }

    sendCsvSuccess(files);
  } catch (error) {
    logger.error('[CSV] streaming export failed:', error);
    sendCsvFailed(error);
  }
}

function normalizeFiniteFrame(raw, expectedLength = null) {
  const source = Array.isArray(raw) ? raw : [];
  if (expectedLength == null) {
    return source.map((value) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    });
  }

  return Array.from({ length: expectedLength }, (_, index) => {
    const numberValue = Number(source[index]);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });
}

function stopPlaybackTimer() {
  playFlag = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * 从时间戳数组推算实际采集帧间隔（ms）
 * 取前 N 帧时间戳差值的中位数，过滤异常值，fallback 到 timeNum
 */
function calcDetectedInterval(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return timeNum;
  const sampleSize = Math.min(20, timestamps.length - 1);
  const diffs = [];
  for (let i = 1; i <= sampleSize; i++) {
    const d = timestamps[i] - timestamps[i - 1];
    if (d > 0 && d < 5000) diffs.push(d); // 过滤异常值（>5s 视为无效）
  }
  if (diffs.length === 0) return timeNum;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.max(1, median); // 最小 1ms
}

let reconnectTimer = null;
let jqbedTimer = null;
let petCareTimer = null;
let petCareMiniTimer = null;
let reportHttpServer = null;
let serverOpened = false;
let serverShutdownRequested = false;
let serverShutdownPromise = null;

function closeWithTimeout(name, promise, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logger.warn(`[Server] ${name} close timed out after ${timeoutMs}ms`);
      resolve(false);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        logger.warn(`[Server] ${name} close failed:`, err.message || err);
        resolve(false);
      });
  });
}

function clearManagedInterval(name, timerRef) {
  if (!timerRef) return null;
  clearInterval(timerRef);
  logger.info(`[Server] Cleared ${name}`);
  return null;
}

function closeSerialPort(portRef, name) {
  if (!portRef) return Promise.resolve(null);

  try {
    portRef.removeAllListeners?.();
  } catch (err) {
    logger.warn(`[Server] ${name} removeAllListeners failed:`, err.message);
  }

  if (!portRef.isOpen || typeof portRef.close !== 'function') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      portRef.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve(null);
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve(null);
    }
  });
}

function closeHttpServer(httpServer, name) {
  if (!httpServer || typeof httpServer.close !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      httpServer.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve();
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve();
    }
  });
}

function closeWsServer(wsServer, name) {
  if (!wsServer) return Promise.resolve();

  try {
    wsServer.clients?.forEach((client) => {
      try {
        client.terminate?.();
      } catch (err) {
        logger.warn(`[Server] ${name} client terminate failed:`, err.message);
      }
    });
  } catch (err) {
    logger.warn(`[Server] ${name} enumerate clients failed:`, err.message);
  }

  return new Promise((resolve) => {
    try {
      wsServer.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve();
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve();
    }
  });
}

function closeDatabase(dbRef, name) {
  if (!dbRef || typeof dbRef.close !== 'function') return Promise.resolve();

  return new Promise((resolve) => {
    try {
      dbRef.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve();
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve();
    }
  });
}

function shutdownServer() {
  if (serverShutdownRequested) {
    return serverShutdownPromise || Promise.resolve();
  }
  serverShutdownRequested = true;

  logger.info("[Server] Shutdown requested, closing sockets/timers/workers...");

  stopPlaybackTimer();
  reconnectTimer = clearManagedInterval("serial reconnect timer", reconnectTimer);
  jqbedTimer = clearManagedInterval("jqbed timer", jqbedTimer);
  petCareTimer = clearManagedInterval("petCare timer", petCareTimer);
  petCareMiniTimer = clearManagedInterval("petCareMini timer", petCareMiniTimer);

  localFlag = false;
  sitClose = true;
  backClose = true;
  headClose = true;
  sensorClose = true;
  com = undefined;
  com1 = undefined;
  comhead = undefined;
  comSensor = undefined;

  try {
    stopWorker();
  } catch (err) {
    logger.warn("[Server] stopWorker failed:", err.message);
  }

  const reportServer = reportHttpServer;
  reportHttpServer = null;

  serverShutdownPromise = Promise.all([
    closeWithTimeout("port1", closeSerialPort(port1, "port1")),
    closeWithTimeout("port2", closeSerialPort(port2, "port2")),
    closeWithTimeout("portHead", closeSerialPort(portHead, "portHead")),
    closeWithTimeout("portSensor", closeSerialPort(portSensor, "portSensor")),
    closeWithTimeout("server", closeWsServer(server, "server")),
    closeWithTimeout("server1", closeWsServer(server1, "server1")),
    closeWithTimeout("server2", closeWsServer(server2, "server2")),
    closeWithTimeout("report HTTP server", closeHttpServer(reportServer, "report HTTP server")),
    closeWithTimeout("db", closeDatabase(db, "db")),
    closeWithTimeout("db1", closeDatabase(db1, "db1")),
    closeWithTimeout("db2", closeDatabase(db2, "db2")),
  ]).then(() => {
    port1 = null;
    port2 = null;
    portHead = null;
    portSensor = null;
    serverOpened = false;
  });

  return serverShutdownPromise;
}



const defauleFile = 'hand0205'
let date, sysStartTime, file = defauleFile, selectFlag
let licenseFile = null

function getSelectFlagFromLicense(licenseFile) {
  if (licenseFile === 'all') return 'all';
  if (Array.isArray(licenseFile)) {
    return licenseFile.filter((item) => typeof item === 'string' && item.trim());
  }

  if (typeof licenseFile === 'string' && licenseFile.trim() && licenseFile !== 'all') {
    return [licenseFile];
  }

  return undefined;
}

function getDefaultFileFromLicense(licenseFile, fallback = null) {
  if (Array.isArray(licenseFile)) {
    return licenseFile.find((item) => typeof item === 'string' && item.trim()) || fallback;
  }

  if (typeof licenseFile === 'string' && licenseFile.trim() && licenseFile !== 'all') {
    return licenseFile;
  }

  return fallback;
}

/**
 * 给单个客户端推送当前授权状态（在线/离线、到期时间、剩余天数、原因）。
 * 无 payload → 提示输入密钥（校验中只发 checking）；有 payload 但未放行 → 附带 licenseError（踢停会话）。
 */
function sendLicenseStatusTo(client) {
  if (!client || client.readyState !== WebSocket.OPEN) return;
  const st = licenseManager.getState();
  const savedLicenseKey = getSavedLicenseKeyForClient();
  if (savedLicenseKey) {
    client.send(JSON.stringify({ licenseKey: savedLicenseKey, savedAccessKey: savedLicenseKey }));
  }
  // 永久锁定（回拨/篡改）→ 弹解锁窗，需厂商解锁码
  if (st.locked) {
    client.send(JSON.stringify({ licenseLocked: true, licenseKey: savedLicenseKey, reason: st.reason || '检测到异常行为，请联系厂商解锁' }));
    return;
  }
  if (!st.payload) {
    // 校验中（首检未回）时只发 checking，避免启动瞬间闪红"未授权"
    client.send(JSON.stringify(st.checking
      ? { licenseChecking: true, licenseKey: savedLicenseKey }
      : { licenseError: '未检测到有效密钥，请输入密钥后使用', noLicense: true, licenseKey: savedLicenseKey }));
    return;
  }
  const payload = {
    date: st.expireTimestamp,
    nowDate: st.lastCheckedAt || Date.now(), // 服务器/可信时间，供前端算剩余天数
    licenseKey: savedLicenseKey,
    file: licenseFile || file,
    activeSensorType: file,
    selectFlag: selectFlag,
    checking: !!st.checking,
    valid: !!st.valid,
    licenseType: st.type,          // 'online' | 'offline'，供前端区分展示
    remainingDays: st.remainingDays,
    offline: !!st.offline,         // 在线密钥是否走了断网缓存兜底
  };
  if (st.payload.moduleConfig) payload.moduleConfig = st.payload.moduleConfig;
  client.send(JSON.stringify(payload));
  // 仅在校验已完成且未放行时才报错，避免"校验中"被误判为未授权
  if (!st.checking && !st.valid) {
    client.send(JSON.stringify({ licenseError: st.reason || '授权校验未通过', noLicense: false }));
  }
}

/** 向所有前端连接广播当前授权状态。 */
function broadcastLicenseStatus() {
  if (!server) return;
  server.clients.forEach(sendLicenseStatusTo);
}

/** 给单个客户端下发当前传感器类型清单（请求-应答 / 连接时主动 push 都走这）。 */
function sendSensorTypesTo(client) {
  if (!client || client.readyState !== WebSocket.OPEN) return;
  client.send(JSON.stringify({ sensorTypeList: sensorTypeStore.getSnapshot() }));
}

/** 向所有前端广播传感器类型清单（远程拉取更新后调用）。 */
function broadcastSensorTypes() {
  if (!server) return;
  server.clients.forEach(sendSensorTypesTo);
}

/** 向所有前端广播一条 licenseError（写入校验失败等即时反馈用）。 */
function sendLicenseErrorToAll(msg) {
  if (!server) return;
  server.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ licenseError: msg }));
    }
  });
}

/** 5min 复检回调：valid 由 true→false（吊销/过期/回拨锁定/断网无缓存）时通知前端停用。 */
function onLicensePollChange(st, prevValid) {
  if (prevValid && !st.valid) {
    logger.warn('[License] 复检失效，通知前端停止使用：' + (st.reason || '') + (st.locked ? '（已锁定）' : ''));
  }
  broadcastLicenseStatus();
}

const startupLicenseConfig = findStartupLicenseConfig();
if (startupLicenseConfig) {
  try {
    nameTxt = startupLicenseConfig.path;
    const startupRawKey = startupLicenseConfig.rawKey;

    // 1) 同步预取 payload：仅用于配置 db/串口（不联网、不判有效性）。
    //    在线/离线统一归一化为 { date, file, moduleConfig }；旧 ECB config.txt 走在线分支，零兼容差异。
    const peeked = startupLicenseConfig.peeked || licenseManager.peekPayload(startupRawKey);
    if (peeked) {
      if (persistStartupLicenseToWritable(nameTxt, startupRawKey)) {
        nameTxt = writableNameTxt;
      }
      licenseFile = peeked.payload.file || null;
      selectFlag = getSelectFlagFromLicense(peeked.payload.file);
      file = getDefaultFileFromLicense(peeked.payload.file, defauleFile);
      // 鏍规嵁 file 绫诲瀷璁剧疆娉㈢壒鐜?
      baudRate = getSensorBaudRate(file);
    } else {
      logger.warn('[License] 启动预取密钥失败（格式无法识别或解密失败），按未授权处理。');
    }

    // 2) 异步校验有效性（在线版联网 /licenseCheck、离线版 RSA+防回拨可信时间）。
    //    isLicenseValid() 基线为 false，首检返回前数据通道保持关闭（fail-closed），不会在首检完成前放数据。
    licenseManager.loadFromKey(startupRawKey)
      .then((ok) => {
        logger.info(`[License] 启动校验完成：valid=${ok} type=${licenseManager.getState().type}`);
        // 在线/离线都启动 5min 复检：持续顶高水位、catch 开机后回拨时钟
        licenseManager.startRuntimeRecheck(onLicensePollChange);
        broadcastLicenseStatus();
      })
      .catch((err) => logger.error('[License] 启动校验异常', err));
  } catch (err) {
    logger.error(err);
  }
} else {
  logger.info("[Config] config.txt not found, skip loading license at startup.");
}

// 后台拉取传感器类型清单：不阻塞启动（getSnapshot 已有缓存/内置兜底可立即下发），
// 断网时不会白等超时；远程拉到后再广播一次，让已连接前端刷新到最新清单。
sensorTypeStore.initSensorTypes(appConfig.keyServer.BASE_URL)
  .then((updated) => { if (updated) broadcastSensorTypes(); })
  .catch((err) => logger.warn('[SensorTypes] 初始化异常：' + (err && err.message)));

// let db = new sqlite3.Database(`${filePath}/foot.db`);
// let db1 = new sqlite3.Database(`${filePath}/back.db`);
// let db2 = new sqlite3.Database(`${filePath}/volvohead.db`);
let sitTimeArr = [],
  backTimeArr = [];
let dataFalg = 0;

// const createCsvWriter = require("csv-writer").createObjectCsvWriter;

let saveTime,
  getTime,

  com,
  com1,
  comhead,
  comSensor;
// db = new sqlite3.Database(`${filePath}/${file}.db`);




const dbObj = initDb(file)
db = dbObj.db
db1 = dbObj.db1
db2 = dbObj.db2

let flag = false;
let colHZ = 12, oldTimeStamp = new Date().getTime();
let collectOptions = { frequencyMode: 'serial', frequencyHz: 12, matrixDownsample: { enabled: false } };
let smallBed12BDisplayOptions = { matrixMode: '32x32', samplePoint: 'topLeft' };
let lastCollectionStorageAt = { sit: 0, back: 0, head: 0 };
let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
// let splitBuffer1 = Buffer.from([0xaa, 0x55, 0x03, 0x09]);
let parser2 = new DelimiterParser({ delimiter: splitBuffer });
let parser = new DelimiterParser({ delimiter: splitBuffer });
let parserSmallBed12B = new DelimiterParser({ delimiter: SMALL_BED_12B_FRAME_TAIL });
let parser3 = new DelimiterParser({ delimiter: splitBuffer });
let parser4 = new DelimiterParser({ delimiter: splitBuffer });
const getSitParser = () => file === SMALL_BED_12B_TYPE ? parserSmallBed12B : parser;
let server, server1, server2;
let localData = [],
  localDataBack = [],
  localDataHead = [],
  indexArr = [0, 0];
let up = 1245, down = 2
let pointArr1zero = []
let pointArr147zero = []
let pointArr147zero_2 = []
let pointArr2zero = []
let pointArr3zero = []
let pointArr4zero = []
let pointArr2RawZero = []

let pointArr1zeroData = []
let pointArr2zeroData = []
let pointArr3zeroData = []
let pointArr4zeroData = [], pointArr2RawZeroData = [], newArr147 = [], newArr147_2 = [];
let pointArr1RawZero = []
let pointArr1RawZeroData = []

server = new WebSocket.Server({ port: 19999 });
server1 = new WebSocket.Server({ port: 19998 });
server2 = new WebSocket.Server({ port: 19997 });

module.exports = {
  openServer() {
    if (serverOpened) {
      logger.info("[Server] openServer skipped: listeners already attached");
      return;
    }

    serverOpened = true;
    serverShutdownRequested = false;

    server1.on("open", function open() {
      logger.info("connected");
    });

    server1.on("close", function close() {
      logger.info("disconnected");
    });

    server1.on("connection", function connection(ws, req) {
      ws.on("message", function incoming(message) {
        logger.debug("received: %s from %s", message, clientName, localFlag);

        const getMessage = JSON.parse(message);

        /**
         * 鐏忓棗鐤勯弮鍫曟浆閼冲本鏆熼幑顕€鈧岸浜鹃幍鎾崇磻
         */
        if (licenseManager.isLicenseValid()) {
          if (JSON.parse(message).backPort != null) {
            com1 = JSON.parse(message).backPort;
            try {
              port2 = new SerialPort(
                JSON.parse(message).backPort,
                {
                  baudRate: baudRate,
                  autoOpen: true,
                },
                function (err) {
                  logger.warn(err, "err");
                }
              );
              //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
              bindBackPortParser();
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          if (JSON.parse(message).local === true) {
            // localFlag = true;
            // localData = []
            // localDataBack = []
            const jsonData = JSON.stringify({
              backData: new Array(backTotal).fill(0),
            });
            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
          }
          if (JSON.parse(message).local === false) {
            localFlag = false;
            stopPlaybackTimer();
            const jsonData = JSON.stringify({
              backData: new Array(backTotal).fill(0),

            });
            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
            if (com1) {
              try {
                port2 = new SerialPort(
                  com1,
                  {
                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    logger.warn(err, "err");
                  }
                );
                //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                // port2.pipe(parser2);
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }

          /**
           * 鐏忓棝娼懗灞炬殶閹诡噣鈧岸浜鹃崗鎶芥４
           */
           if (JSON.parse(message).backClose === true) {
            backClose = true
            com1 = undefined; // 清除 com1 防止自动重连
            if (port2?.isOpen) {
              port2.close((err) => {
                if (err) logger.warn('port2 close error (server1):', err);
              });
            }
          }

          // if (JSON.parse(message).getTime != null) {
          //   getTime = JSON.parse(message).getTime;
          //   localFlag = true;
          //   const selectQuery = "select * from matrix WHERE date=?";
          //   const params = [getTime];

          //   db1.all(selectQuery, params, (err, rows) => {
          //     if (err) {
          //       logger.error(err);
          //     } else {
          //       localDataBack = rows;
          //     }
          //   });
          // }
        }
      });
    });

    server.on("open", function open() {
      logger.info("connected");
    });

    server.on("close", function close() {
      logger.info("disconnected");
    });

    server.on("connection", function connection(ws, req) {

      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = ip + port;
      logger.info("%s is connected", clientName);

      // ====== 心跳机制：防止息屏后连接被系统关闭 ======
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => { ws.isAlive = false; });
      const heartbeatInterval = setInterval(() => {
        if (ws.isAlive === false) {
          logger.warn('[WS] 客户端心跳超时，关闭连接: ' + clientName);
          clearInterval(heartbeatInterval);
          return ws.terminate();
        }
        ws.isAlive = false;
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 30000);
      ws.on('close', () => clearInterval(heartbeatInterval));
      // ======================================================

      server.clients.forEach(function each(client) {
        /**
         * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
         *  */
        const jsonData = JSON.stringify({
          port: serialport,
          file: licenseFile || file,
          activeSensorType: file,
          selectFlag: selectFlag
          // length: csvSitData.length,
          // sitData: csvSitData[0], backData: csvBackData[0]
        });

        if (client.readyState === WebSocket.OPEN) {
          client.send(jsonData);
        }
      });

      // 向新连接的客户端推送当前授权状态（在线/离线、剩余天数、checking、未授权原因）
      sendLicenseStatusTo(ws);
      // 连接时主动 push 一次传感器类型清单（配合渲染端的请求-应答，避免首屏空列表）
      sendSensorTypesTo(ws);

      ws.on("message", function incoming(message) {


        const getMessage = JSON.parse(message);

        // if(getMessage.compen != null){
        //   compen = getMessage.compen
        // }

        if (getMessage.date != null) {
          try {
            const newKey = (getMessage.date && getMessage.date.date ? String(getMessage.date.date) : '').trim();

            if (!newKey) {
              logger.warn('[License] Empty license key received');
              sendLicenseErrorToAll('密钥不能为空，请输入有效密钥');
              return;
            }

            // 识别 + 预取（同时校验格式：在线 ECB 解密、离线 RSA 验签）；失败即拒绝、不写入
            const peeked = licenseManager.peekPayload(newKey);
            if (!peeked) {
              logger.warn('[License] Failed to parse/verify license key');
              sendLicenseErrorToAll('密钥无效，解密或验签失败');
              return;
            }

            // 锁定 / 换密钥处理：
            //  - 锁定态下重输【同一把】被锁密钥 → 拒绝（必须联系厂商重签新密钥）；
            //  - 锁定态下写入【不同】新密钥 → clearLockState（清锁 + 清缓存）后重校验；
            //  - 未锁定但写入【不同】新密钥 → 清旧缓存，强制新密钥先联网激活一次
            //    （缓存不与密钥绑定，不清的话新密钥断网会沿用旧密钥缓存被误判有效）。
            const currentKey = licenseManager.getState().rawKey;
            const sameKey = currentKey && newKey === currentKey;
            if (licenseManager.isLockedNow().locked) {
              if (sameKey) {
                logger.warn('[License] 锁定态下重复输入同一密钥，已拒绝');
                sendLicenseErrorToAll('该密钥已因系统时间异常被锁定，请联系厂商重新获取新密钥');
                return;
              }
              licenseManager.clearLockState();
            } else if (!sameKey) {
              licenseManager.clearOnlineCache();
            }

            // 写入 config.txt（原始密钥串：在线为 hex、离线为 base64 JSON）
            fs.mkdirSync(path.dirname(writableNameTxt), { recursive: true });
            fs.writeFileSync(writableNameTxt, newKey, 'utf8');
            nameTxt = writableNameTxt;

            // 更新运行期变量（file/baudRate 等），在线/离线统一用归一化 payload
            licenseFile = peeked.payload.file || null;
            selectFlag = getSelectFlagFromLicense(peeked.payload.file);
            const nextFile = getDefaultFileFromLicense(peeked.payload.file);
            if (nextFile) {
              file = nextFile;
              Object.keys(petCareSystems).forEach(resetPetCareRuntime);
            }
            baudRate = getSensorBaudRate(file);

            // 异步校验有效性（在线联网 /licenseCheck、离线 RSA+可信时间），据类型启停轮询；先推"校验中"
            const p = licenseManager.loadFromKey(newKey);
            broadcastLicenseStatus();
            p.then(() => {
              // 在线/离线都重启 5min 复检
              licenseManager.startRuntimeRecheck(onLicensePollChange);
              broadcastLicenseStatus();
            }).catch((err) => logger.error('[License] 写入后校验异常', err));

          } catch (err) {
            logger.error('[License] Invalid license key:', err && err.message);
            sendLicenseErrorToAll('密钥无效，请检查后重新输入');
          }
        }

        // 「重新获取授权」：前端阻断弹窗点按钮 → 清在线缓存 + 立刻联网复查当前密钥。
        // 续期/恢复后无需等轮询、无需重启，点一下即时生效；吊销/暂停仍由 30s 复检自动停用。
        if (getMessage.refreshLicense) {
          try {
            const curKey = licenseManager.getState().rawKey;
            if (!curKey) {
              sendLicenseErrorToAll('未检测到密钥，请先输入密钥');
            } else {
              licenseManager.clearOnlineCache();   // 清缓存 → 强制下次校验真正联网
              const rp = licenseManager.loadFromKey(curKey);
              broadcastLicenseStatus();             // 先推「校验中」
              rp.then(() => {
                licenseManager.startRuntimeRecheck(onLicensePollChange);
                broadcastLicenseStatus();           // 推最新结果
              }).catch((err) => logger.error('[License] 刷新校验异常', err));
            }
          } catch (err) {
            logger.error('[License] refreshLicense 异常：' + (err && err.message));
          }
        }

        // 传感器类型清单请求-应答（不受授权守卫限制：下拉/密钥页未授权时也要能拿到清单）
        if (getMessage.getSensorTypes) {
          sendSensorTypesTo(ws);
        }

        if (licenseManager.isLicenseValid()) {



          if (getMessage.history != null) {
            history = getMessage.history;
          }

          if (getMessage.up != null) {
            up = Number(getMessage.up);
          }

          if (getMessage.down != null) {
            down = Number(getMessage.down);
          }


          if (getMessage.history === false) {
            history = false;
            stopPlaybackTimer();
          }

          if (getMessage.variety != null) {
            if (indexArr) {
              if (localDataBack.length) {

                const startArr = JSON.parse(localDataBack[indexArr[0]].data);
                const endArr = JSON.parse(localDataBack[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  backData: newArr,
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
              if (localData.length) {

                const startArr = JSON.parse(localData[indexArr[0]].data);
                const endArr = JSON.parse(localData[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  sitData: newArr,
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
            }
          }

          // 缂冾噣娴?
          if (getMessage.resetZero === true) {
            if (pointArr) pointArr1zero = [...pointArr1zeroData]
            if (pointArr2) pointArr2zero = [...pointArr2zeroData]
            if (pointArr3) pointArr3zero = [...pointArr3zeroData]
            if (pointArr4) pointArr4zero = [...pointArr4zeroData]
            if (pointArr1RawZeroData.length) pointArr1RawZero = [...pointArr1RawZeroData]
            if (pointArr2RawZeroData.length) pointArr2RawZero = [...pointArr2RawZeroData]
            if (newArr147) pointArr147zero = [...newArr147]
            if (newArr147_2) pointArr147zero_2 = [...newArr147_2]

          }

          if (getMessage.resetZero === false) {
            pointArr1zero = []
            pointArr2zero = []
            pointArr3zero = []
            pointArr4zero = []
            pointArr1RawZero = []
            pointArr2RawZero = []
            pointArr147zero = []
            pointArr147zero_2 = []
          }

          if (getMessage.smallBed12BDisplayOptions != null) {
            smallBed12BDisplayOptions = smallBed12B.normalizeDisplayOptions(
              getMessage.smallBed12BDisplayOptions,
            );
          }

          if (JSON.parse(message).file != null) {
            backClose = true
            sitClose = true
            headClose = true
            sensorClose = true
            // 清除 com 变量，防止自动重连定时器用旧值重新打开串口
            com = undefined;
            com1 = undefined;
            comhead = undefined;
            comSensor = undefined;
            if (port1?.isOpen) {
              port1.close((err) => {
                if (err) logger.warn('port1 close error on file switch:', err);
              });

              const jsonData = JSON.stringify({
                sitData:
                  file == "bigBed"
                    ? new Array(2048).fill(0)
                    : new Array(sitTotal).fill(0),
              });

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }
            if (port2?.isOpen) {
              port2.close((err) => {
                if (err) logger.warn('port2 close error on file switch:', err);
              });
              const jsonData = JSON.stringify({
                backData: new Array(backTotal).fill(0),
              });

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }

            if (portHead?.isOpen) {
              portHead.close((err) => {
                if (err) logger.warn('portHead close error on file switch:', err);
              });
              const jsonData = JSON.stringify({
                headData: new Array(100).fill(0),
              });

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }
            closeMinzhenSensorPort('file switch');
            const receiveFile = JSON.parse(message).file
            // db = new sqlite3.Database(`${filePath}/${receiveFile}.db`);
            file = receiveFile;
            Object.keys(petCareSystems).forEach(resetPetCareRuntime);

            baudRate = getSensorBaudRate(receiveFile);

            const dbObj = initDb(file)
            db = dbObj.db
            db1 = dbObj.db1
            db2 = dbObj.db2

            // 切换 file 时重置回放状态
            stopPlaybackTimer();
            nowIndex = 0;
            localData = [];
            localDataBack = [];
            localDataHead = [];
            indexArr = [0, 0];

          }

          if (JSON.parse(message).baudRate != null) {
            baudRate = Number(JSON.parse(message).baudRate)
          }
          /**
           * 鐏忓棙婀伴崷棰佺箽鐎涙ɑ鏆熼幑顕€鈧岸浜鹃幍鎾崇磻
           */
          if (JSON.parse(message).getTime != null) {
            getTime = JSON.parse(message).getTime;
            localFlag = true;
            nowGetTime = getTime;
            loadSelectedHistory(getTime);
            return;
            const selectQuery = "select * from matrix WHERE date=?";

            const params = [getTime];

            nowGetTime = getTime;

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  db.all(selectQuery, params, (err, rows) => {
                    if (err) {
                      logger.error(err);
                    } else {
                      localData = rows;
                      const historySeries = getHistorySeries({
                        sitRows: localData,
                        backRows: localDataBack,
                        file,
                      });
                      length = historySeries.length;
                      indexArr = [0, Math.max(length - 2, 0)];
                      timeStamp = historySeries.time;
                      detectedInterval = calcDetectedInterval(timeStamp);
                      interval = detectedInterval;
                      historyArr = [0, length];
                      const press = historySeries.press;
                      const area = historySeries.area;

                      server.clients.forEach(function each(client) {
                        /**
                         * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?鏆?
                         *  */
                        const jsonData = JSON.stringify({
                          length: length,
                          time: timeStamp,
                          index: nowIndex,
                          pressArr: press,
                          areaArr: area,
                          // length: csvSitData.length,
                          sitData:
                            file === "bigBed"
                              ? new Array(2048).fill(0)
                              : new Array(1024).fill(0),
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });

                      // if (history) {
                      //   let press = [], area = []
                      //   if (localDataBack.length) {
                      //     for (let i = 0; i < length; i++) {
                      //       let a = JSON.parse(localData[i].data).reduce((a, b) => a + b, 0) + JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                      //       let b = JSON.parse(localData[i].data).filter((a) => a > 10).length + JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                      //       press.push(a)
                      //       area.push(b)
                      //     }

                      //     server.clients.forEach(function each(client) {
                      //       /**
                      //        * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                      //        *  */

                      //       const jsonData = JSON.stringify({
                      //         length: rows.length,
                      //         time: timeStamp,
                      //         index: nowIndex,
                      //         // length: csvSitData.length,
                      //         // sitData: csvSitData[0], backData: csvBackData[0]
                      //         pressArr: press,
                      //         areaArr: area
                      //       });
                      //       if (client.readyState === WebSocket.OPEN) {
                      //         client.send(jsonData);
                      //       }
                      //     });
                      //   }

                      // } else {
                      //   server.clients.forEach(function each(client) {
                      //     /**
                      //      * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                      //      *  */

                      //     const jsonData = JSON.stringify({
                      //       length: rows.length,
                      //       time: timeStamp,
                      //       index: nowIndex,

                      //     });
                      //     if (client.readyState === WebSocket.OPEN) {
                      //       client.send(jsonData);
                      //     }
                      //   });
                      // }
                    }
                  });
                } else {
                  // console.log(rows);
                  localDataBack = rows;
                  length = rows.length
                    ? Math.min(
                      rows.length,
                      localData.length ? localData.length : rows.length
                    )
                    : localData.length;
                  indexArr = [0, length - 2];
                  timeStamp = [];
                  for (let i = 0; i < rows.length; i++) {
                    timeStamp.push(rows[i].timestamp);
                  }
                  detectedInterval = calcDetectedInterval(timeStamp);
                  interval = detectedInterval;
                  historyArr = [0, length];
                  let press = [],
                    area = [];
                  // if (localDataBack.length) {
                  //   for (let i = 0; i < length; i++) {

                  //     let a = localData.length
                  //       ? totalToN(JSON.parse(localData[i].data).reduce((a, b) => a + b, 0))
                  //       : 0 +
                  //       totalToN(JSON.parse(localDataBack[i].data).reduce(
                  //         (a, b) => a + b,
                  //         0
                  //       ), 1.3);
                  //     let b = localData.length
                  //       ? JSON.parse(localData[i].data).filter((a) => a > 10).length
                  //       : 0 +
                  //       JSON.parse(localDataBack[i].data).filter((a) => a > 10)
                  //         .length;
                  //     press.push(a);
                  //     area.push(b);
                  //   }



                  //   // server.clients.forEach(function each(client) {
                  //   //   /**
                  //   //    * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                  //   //    *  */

                  //   //   const jsonData = JSON.stringify({
                  //   //     pressArr: press,
                  //   //     areaArr: area,
                  //   //     length: length,
                  //   //     time: timeStamp,
                  //   //     index: nowIndex,
                  //   //     backData:
                  //   //       file === "car10"
                  //   //         ? new Array(100).fill(0)
                  //   //         : new Array(1024).fill(0),
                  //   //   });
                  //   //   if (client.readyState === WebSocket.OPEN) {
                  //   //     client.send(jsonData);
                  //   //   }
                  //   // });
                  // }

                  db.all(selectQuery, params, (err, rows) => {
                    if (err) {
                      logger.error(err);
                    } else {

                      if (isThreePortFile(file)) {
                        db2.all(selectQuery, params, (err, rows) => {
                          if (err) {
                            logger.error(err);
                          } else {



                            localDataHead = rows;
                            length = rows.length
                              ? Math.min(
                                rows.length,
                                localDataBack.length ? localDataBack.length : rows.length
                              )
                              : localDataBack.length;
                            indexArr = [0, length - 2];
                            timeStamp = [];
                            for (let i = 0; i < rows.length; i++) {
                              timeStamp.push(rows[i].timestamp);
                            }
                            detectedInterval = calcDetectedInterval(timeStamp);
                            interval = detectedInterval;
                            historyArr = [0, length];
                            let press = [],
                              area = [];


                            server.clients.forEach(function each(client) {
                              /**
                               * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                               *  */
                              const jsonData = JSON.stringify({
                                // length: length,
                                // time: timeStamp,
                                // index: nowIndex,
                                // pressArr: press,
                                // areaArr: area,
                                // length: csvSitData.length,
                                headData:
                                  file === "bigBed"
                                    ? new Array(2048).fill(0)
                                    : new Array(100).fill(0),
                              });
                              if (client.readyState === WebSocket.OPEN) {
                                client.send(jsonData);
                              }
                            });


                          }
                        });
                      }

                      localData = rows;
                      const historySeries = getHistorySeries({
                        sitRows: localData,
                        backRows: localDataBack,
                        file,
                      });
                      length = historySeries.length;
                      indexArr = [0, Math.max(length - 2, 0)];
                       timeStamp = historySeries.time;
                      detectedInterval = calcDetectedInterval(timeStamp);
                      interval = detectedInterval;
                      historyArr = [0, length];
                      const press = historySeries.press;
                      const area = historySeries.area;

                      server.clients.forEach(function each(client) {
                        /**
                         * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆??
                         *  */
                        const jsonData = JSON.stringify({
                          length: length,
                          time: timeStamp,
                          index: nowIndex,
                          pressArr: press,
                          areaArr: area,
                          // length: csvSitData.length,
                          sitData:
                            file === "bigBed"
                              ? new Array(2048).fill(0)
                              : new Array(1024).fill(0),
                        });
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });

                      // if (history) {
                      //   let press = [], area = []
                      //   if (localDataBack.length) {
                      //     for (let i = 0; i < length; i++) {
                      //       let a = JSON.parse(localData[i].data).reduce((a, b) => a + b, 0) + JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                      //       let b = JSON.parse(localData[i].data).filter((a) => a > 10).length + JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                      //       press.push(a)
                      //       area.push(b)
                      //     }

                      //     server.clients.forEach(function each(client) {
                      //       /**
                      //        * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                      //        *  */

                      //       const jsonData = JSON.stringify({
                      //         length: rows.length,
                      //         time: timeStamp,
                      //         index: nowIndex,
                      //         // length: csvSitData.length,
                      //         // sitData: csvSitData[0], backData: csvBackData[0]
                      //         pressArr: press,
                      //         areaArr: area
                      //       });
                      //       if (client.readyState === WebSocket.OPEN) {
                      //         client.send(jsonData);
                      //       }
                      //     });
                      //   }

                      // } else {
                      //   server.clients.forEach(function each(client) {
                      //     /**
                      //      * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                      //      *  */

                      //     const jsonData = JSON.stringify({
                      //       length: rows.length,
                      //       time: timeStamp,
                      //       index: nowIndex,

                      //     });
                      //     if (client.readyState === WebSocket.OPEN) {
                      //       client.send(jsonData);
                      //     }
                      //   });
                      // }
                    }
                  });
                }
              });
            }

            if (!isCar(file)) {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  localData = rows;
                  const historySeries = getHistorySeries({
                    sitRows: localData,
                    backRows: localDataBack,
                    file,
                  });
                  length = historySeries.length;
                  indexArr = [0, Math.max(length - 2, 0)];
                  timeStamp = historySeries.time;
                  detectedInterval = calcDetectedInterval(timeStamp);
                  interval = detectedInterval;
                  historyArr = [0, length];
                  const press = historySeries.press;
                  const area = historySeries.area;

                  server.clients.forEach(function each(client) {
                    /**
                     * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                     *  */
                    const jsonData = JSON.stringify({
                      length: length,
                      time: timeStamp,
                      index: nowIndex,
                      pressArr: press,
                      areaArr: area,
                      // length: csvSitData.length,
                      sitData:
                        file === "bigBed"
                          ? new Array(2048).fill(0)
                          : new Array(1024).fill(0),
                    });
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });

                  // if (history) {
                  //   let press = [], area = []
                  //   if (localDataBack.length) {
                  //     for (let i = 0; i < length; i++) {
                  //       let a = JSON.parse(localData[i].data).reduce((a, b) => a + b, 0) + JSON.parse(localDataBack[i].data).reduce((a, b) => a + b, 0)
                  //       let b = JSON.parse(localData[i].data).filter((a) => a > 10).length + JSON.parse(localDataBack[i].data).filter((a) => a > 10).length
                  //       press.push(a)
                  //       area.push(b)
                  //     }

                  //     server.clients.forEach(function each(client) {
                  //       /**
                  //        * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                  //        *  */

                  //       const jsonData = JSON.stringify({
                  //         length: rows.length,
                  //         time: timeStamp,
                  //         index: nowIndex,
                  //         // length: csvSitData.length,
                  //         // sitData: csvSitData[0], backData: csvBackData[0]
                  //         pressArr: press,
                  //         areaArr: area
                  //       });
                  //       if (client.readyState === WebSocket.OPEN) {
                  //         client.send(jsonData);
                  //       }
                  //     });
                  //   }

                  // } else {
                  //   server.clients.forEach(function each(client) {
                  //     /**
                  //      * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                  //      *  */

                  //     const jsonData = JSON.stringify({
                  //       length: rows.length,
                  //       time: timeStamp,
                  //       index: nowIndex,

                  //     });
                  //     if (client.readyState === WebSocket.OPEN) {
                  //       client.send(jsonData);
                  //     }
                  //   });
                  // }
                }
              });
            }
          }

          if (JSON.parse(message).time != null) {
            saveTime = JSON.parse(message).time;
          }
          if (JSON.parse(message).colName != null) {
            saveTime = JSON.parse(message).colName;
          }

          if (JSON.parse(message).flag === true) {
            flag = true;
            resetCollectionStorageClock();
          } else if (JSON.parse(message).flag === false) {
            flag = false;
          }

          if (JSON.parse(message).colHZ != null) {
            colHZ = normalizeCollectFrequency(JSON.parse(message).colHZ);
            collectOptions = normalizeCollectOptions({
              ...collectOptions,
              frequencyHz: colHZ,
            });
          }

          if (JSON.parse(message).collectOptions != null) {
            collectOptions = normalizeCollectOptions(JSON.parse(message).collectOptions);
            colHZ = collectOptions.frequencyHz;
          }

          /**
           * 鐏忓棗鐤勯弮璺洪獓濡炲懏鏆熼幑顕€鈧岸浜鹃幍鎾崇磻
           */
          if (JSON.parse(message).sitPort != null) {
            sitClose = false
            com = JSON.parse(message).sitPort;
            if (port1?.isOpen) {
              port1.close((e) => {
                logger.debug(e)
              });
            }
            if (com == com1) {
              if (port2?.isOpen) {
                port2.close((e) => {
                  logger.debug(e)
                });
              }
            }
            logger.debug(baudRate)
            if (file != "bigBed") {
              console.log(com);
              try {
                port1 = new SerialPort(
                  {
                    path: JSON.parse(message).sitPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    logger.warn(err, "err");
                  }
                );
                //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                // let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
                // parser = new Delimiter({ delimiter: splitBuffer });
                port1.pipe(getSitParser());
              } catch (e) {
                logger.warn(e, "e");
              }
            } else {
              try {
                port1 = new SerialPort(
                  {
                    path: JSON.parse(message).sitPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    logger.warn(err, "err");
                  }
                );
                //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                port1.pipe(parser3);
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }


          if (JSON.parse(message).headPort != null) {
            headClose = false
            comhead = JSON.parse(message).headPort;
            if (portHead?.isOpen) {
              portHead.close((e) => {
                logger.debug(e)
              });
            }
            // if (com == com1) {
            //   if (port2?.isOpen) {
            //     port2.close((e) => {
            //       logger.debug(e)
            //     });
            //   }
            // }
            if (file != "bigBed") {
              // console.log(com);
              try {
                portHead = new SerialPort(
                  {
                    path: JSON.parse(message).headPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    console.log(err, baudRate, JSON.parse(message).headPort, "headerr");
                  }
                );
                //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                // let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
                // parser = new Delimiter({ delimiter: splitBuffer });
                portHead.pipe(parser4);
              } catch (e) {
                logger.warn(e, "e");
              }
            } else {
              try {
                portHead = new SerialPort(
                  {
                    path: JSON.parse(message).headPort,

                    baudRate: baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    console.log(err, "headerr");
                  }
                );
                //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                portHead.pipe(parser4);
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }

          if (JSON.parse(message).sensorPort != null) {
            openMinzhenSensorPort(JSON.parse(message).sensorPort);
          }

          /**
           * 鐏忓棗鐤勯弮鍫曟浆閼冲本鏆熼幑顕€鈧岸浜鹃幍鎾崇磻
           */
          if (JSON.parse(message).backPort != null) {
            backClose = false
            com1 = JSON.parse(message).backPort;
            if (port2?.isOpen) {
              port2.close((e) => {
                console.log(e, 'closeport2')
              });
            }
            if (com == com1) {
              if (port1?.isOpen) {
                port1.close((e) => {

                  console.log(e, 'closeport1')
                });
              }
            }
            try {
              port2 = new SerialPort(
                {
                  path: JSON.parse(message).backPort,

                  baudRate: baudRate,
                  autoOpen: true,
                },
                function (err) {
                  logger.warn(err, "err");
                }
              );
              //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?

              bindBackPortParser();
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          /**
           * 鐏忓棗楠囧鍛殶閹诡噣鈧岸浜鹃崗鎶芥４
           */
          if (JSON.parse(message).sitClose === true) {
            sitClose = true
            com = undefined; // 清除 com 防止自动重连
            if (port1?.isOpen) {
              port1.close((err) => {
                if (err) logger.warn('port1 close error:', err);
              });
            }
          }

          /**
           * 鐏忓棝娼懗灞炬殶閹诡噣鈧岸浜鹃崗鎶芥４
           */
          if (JSON.parse(message).backClose === true) {
            backClose = true
            com1 = undefined; // 清除 com1 防止自动重连
            if (port2?.isOpen) {
              port2.close((err) => {
                if (err) logger.warn('port2 close error:', err);
              });
            }
          }

          if (JSON.parse(message).headClose === true) {
            headClose = true
            comhead = undefined; // 清除 comhead 防止自动重连
            if (portHead?.isOpen) {
              portHead.close((err) => {
                if (err) logger.warn('portHead close error:', err);
              });
            }
          }

          if (JSON.parse(message).sensorClose === true) {
            sensorClose = true
            comSensor = undefined;
            closeMinzhenSensorPort('manual close');
          }
          /**
           * 鐏忓棜顕伴崣鏍ㄦ拱閸︾増鏆熼幑顕€鈧岸浜鹃幍鎾崇磻
           */
          if (JSON.parse(message).local === true) {
            localFlag = true;

            // 娴肩娀鈧帗妞傞梻瀛樺煈缂佹瑥澧犵粩?
            const selectQuery =
              "select DISTINCT date from matrix ORDER BY timestamp DESC LIMIT ?,?";
            const params = [0, 500];

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  // console.log(rows);
                  let jsonData;

                  backTimeArr = rows;

                  // const timeArr = Array.from(new Set([...sitTimeArr, ...backTimeArr]))
                  // console.log(timeArr, 'timeArr')
                  const timeArr = dedupli(sitTimeArr, backTimeArr);
                  if (file == "car") {
                    const jsonData1 = JSON.stringify({
                      timeArr: timeArr,
                      backData: new Array(backTotal).fill(0),
                    });
                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData1);
                      }
                    });
                  }
                  if (file == "car10") {
                    const jsonData1 = JSON.stringify({
                      timeArr: rows,
                      backData: new Array(100).fill(0),
                    });
                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData1);
                      }
                    });
                  }

                  db.all(selectQuery, params, (err, rows) => {
                    if (err) {
                      logger.error(err);
                    } else {
                      console.log(rows);
                      let jsonData;
                      sitTimeArr = rows;
                      // const timeArr = Array.from(new Set([...sitTimeArr, ...backTimeArr]))
                      let timeArr = rows;

                      // if (file == "car10" || file == "car" || file == 'sit10') 
                      timeArr = dedupli(sitTimeArr, backTimeArr);



                      if (file === "bigBed") {
                        jsonData = JSON.stringify({
                          timeArr: rows,
                          index: nowIndex,
                          sitData: new Array(2048).fill(0),
                        });
                      } else {
                        jsonData = JSON.stringify({
                          timeArr: timeArr,
                          index: nowIndex,
                          sitData: new Array(sitTotal).fill(0),
                        });
                      }

                      server.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData);
                        }
                      });

                      // if (file == "car") {
                      const jsonData1 = JSON.stringify({
                        backData: new Array(backTotal).fill(0),
                      });
                      server.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                          client.send(jsonData1);
                        }
                      });
                      // }

                      if (isThreePortFile(file)) {
                        const jsonData1 = JSON.stringify({
                          headData: new Array(100).fill(0),
                        });
                        server.clients.forEach(function each(client) {
                          if (client.readyState === WebSocket.OPEN) {
                            client.send(jsonData1);
                          }
                        });
                      }
                    }
                  });
                }
              });
            } else {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  console.log(rows);
                  let jsonData;
                  sitTimeArr = rows;
                  // const timeArr = Array.from(new Set([...sitTimeArr, ...backTimeArr]))
                  let timeArr = rows;

                  // if (file == "car10" || file == "car" || file == 'sit10') 
                  timeArr = dedupli(sitTimeArr, backTimeArr);



                  if (file === "bigBed") {
                    jsonData = JSON.stringify({
                      timeArr: rows,
                      index: nowIndex,
                      sitData: new Array(2048).fill(0),
                    });
                  } else {
                    jsonData = JSON.stringify({
                      timeArr: timeArr,
                      index: nowIndex,
                      sitData: new Array(sitTotal).fill(0),
                    });
                  }

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });

                  if (file == "car") {
                    const jsonData1 = JSON.stringify({
                      backData: new Array(backTotal).fill(0),
                    });
                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData1);
                      }
                    });
                  }
                }
              });
            }


          }
          if (JSON.parse(message).local === false) {
            localFlag = false;
            let jsonData;
            if (file === "bigBed") {
              jsonData = JSON.stringify({
                sitData: new Array(2048).fill(0),
                // backData: new Array(1024).fill(0)
              });
            } else {
              jsonData = JSON.stringify({
                sitData: new Array(sitTotal).fill(0),
                // backData: new Array(1024).fill(0)
              });
            }

            if (isCar(file)) {
              let jsonData1 = JSON.stringify({
                backData: new Array(sitTotal).fill(0),
                // backData: new Array(1024).fill(0)
              });
              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData1);
                }
              });

              if (isThreePortFile(file)) {
                let jsonData2 = JSON.stringify({
                  headData: new Array(sitTotal).fill(0),
                  // backData: new Array(1024).fill(0)
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData2);
                  }
                });
              }
            }

            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });

            // if (com) {
            //   try {
            //     port1 = new SerialPort(
            //       com,
            //       {
            //         baudRate: baudRate,
            //         autoOpen: true,
            //       },
            //       function (err) {
            //         logger.warn(err, "err");
            //       }
            //     );
            //     //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
            //     // port1.pipe(parser);
            //   } catch (e) {
            //     logger.warn(e, "e");
            //   }
            // }

            // if (com1) {
            //   try {
            //     port2 = new SerialPort(
            //       com1,
            //       {
            //         baudRate: baudRate,
            //         autoOpen: true,
            //       },
            //       function (err) {
            //         logger.warn(err, "err");
            //       }
            //     );
            //     //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
            //     // port2.pipe(parser2);
            //   } catch (e) {
            //     logger.warn(e, "e");
            //   }
            // }
          }
          if (localFlag) {
            if (JSON.parse(message).value != null) {
              const value = JSON.parse(message).value;
              console.log(
                "received: %s from %s",
                JSON.stringify(message),
                clientName
              );
              nowIndex = Number(value);
              let jsonData, jsonData1;
              if (isCar(file)) {


                const sitObj = {
                  sitData: localData[value]?.data,
                  time: localData[value]?.timestamp,
                  backFlag: localDataBack.length > 0,
                }

                const backObj = {
                  // sitData: localData[value]?.data,
                  backData: localDataBack[value]?.data,
                  time: localDataBack[value]?.timestamp,
                  sitFlag: localData.length > 0,
                }


                if (file.includes('robot')) {
                  const sitRawText = localData[value]?.data
                  const backRawText = localDataBack[value]?.data
                  if (sitRawText) {
                    const sitFrame = parseStoredSensorFrame(JSON.parse(sitRawText), file)
                    const sitRaw = sitFrame.pressureData
                    if (sitFrame.rotateData.length) sitObj.rotate = sitFrame.rotateData
                    if (sitRaw.length >= 256) {
                      // 新版：前256是原始数据，后4是四元数
                      const sitPressure = sitRaw.slice(0, 256)
                      sitObj.sitData = sitPressure
                      sitObj.newArr147 = sitPressure
                    } else {
                      // 旧版：直接是压力数据
                      const sitPressure = normalizeFiniteFrame(sitRaw, 256)
                      sitObj.sitData = sitPressure
                      sitObj.newArr147 = sitPressure
                    }
                  }
                  if (backRawText) {
                    const backFrame = parseStoredSensorFrame(JSON.parse(backRawText), file)
                    const backRaw = backFrame.pressureData
                    if (backFrame.rotateData.length) backObj.rotate = backFrame.rotateData
                    if (backRaw.length >= 256) {
                      // 新版：前256是原始数据，后4是四元数
                      const backPressure = backRaw.slice(0, 256)
                      backObj.backData = backPressure
                      backObj.newArr147 = backPressure
                    } else {
                      // 旧版：直接是压力数据
                      const backPressure = normalizeFiniteFrame(backRaw, 256)
                      backObj.backData = backPressure
                      backObj.newArr147 = backPressure
                    }
                  }
                } else if (isHandGloveType(file)) {
                  // 鍏煎鏂版棫鏁版嵁鏍煎紡锛氭柊鐗?60(256+4)锛屾棫鐗?51(147+4)
                  const sitRawFrame = parseStoredSensorFrame(JSON.parse(localData[value]?.data || '[]'), file)
                  const backRawFrame = parseStoredSensorFrame(JSON.parse(localDataBack[value]?.data || '[]'), file)
                  const sitRaw = sitRawFrame.pressureData
                  const backRaw = backRawFrame.pressureData
                  if (file === HAND_GLOVE_FULL_PACKET && sitRaw.length >= 256) {
                    const sitPressure = sitRaw.slice(0, 256)
                    const sitMapped = mapHandGloveFullPacketPressure([...sitPressure], 'left')
                    sitObj.sitData = mapHandGloveFullPacketModelMatrix(sitMapped)
                    sitObj.realArr = sitPressure
                    sitObj.rawPressureData = sitPressure
                    sitObj.newArr147 = sitMapped
                    sitObj.mappedArr195 = sitMapped
                    sitObj.rotate = []
                  } else if (sitRaw.length >= 260) {
                    // 鏂扮増锛氬墠256鏄師濮嬫暟鎹紝鍚?鏄洓鍏冩暟
                    const sitPressure = sitRaw.slice(0, 256)
                    const sitRotate = sitRawFrame.rotateData.length ? sitRawFrame.rotateData : sitRaw.slice(256, 260)
                    sitObj.sitData = sitPressure
                    sitObj.newArr147 = file === HAND_GLOVE_FULL_PACKET ? mapHandGloveFullPacketPressure([...sitPressure], 'left') : handL([...sitPressure])
                    sitObj.rotate = sitRotate
                  } else if (sitRaw.length >= 256) {
                    const sitPressure = sitRaw.slice(0, 256)
                    sitObj.sitData = sitPressure
                    sitObj.rawPressureData = sitPressure
                    sitObj.newArr147 = handL([...sitPressure])
                    sitObj.rotate = sitRawFrame.rotateData
                  } else {
                    // 鏃х増锛氬墠147鏄痭ewArr147锛屽悗4鏄洓鍏冩暟
                    sitObj.newArr147 = sitRawFrame.rotateData.length ? sitRaw : sitRaw.slice(0, sitRaw.length - 4)
                    sitObj.rotate = sitRawFrame.rotateData.length ? sitRawFrame.rotateData : sitRaw.slice(sitRaw.length - 4)
                  }
                  if (file === HAND_GLOVE_FULL_PACKET && backRaw.length >= 256) {
                    const backPressure = backRaw.slice(0, 256)
                    const backMapped = mapHandGloveFullPacketPressure([...backPressure], 'right')
                    backObj.backData = mapHandGloveFullPacketModelMatrix(backMapped)
                    backObj.realArr = backPressure
                    backObj.rawPressureData = backPressure
                    backObj.newArr147 = backMapped
                    backObj.mappedArr195 = backMapped
                    backObj.rotate = []
                  } else if (backRaw.length >= 260) {
                    const backPressure = backRaw.slice(0, 256)
                    const backRotate = backRawFrame.rotateData.length ? backRawFrame.rotateData : backRaw.slice(256, 260)
                    backObj.backData = backPressure
                    backObj.newArr147 = file === HAND_GLOVE_FULL_PACKET ? mapHandGloveFullPacketPressure([...backPressure], 'right') : handR([...backPressure])
                    backObj.rotate = backRotate
                  } else if (backRaw.length >= 256) {
                    const backPressure = backRaw.slice(0, 256)
                    backObj.backData = backPressure
                    backObj.rawPressureData = backPressure
                    backObj.newArr147 = handR([...backPressure])
                    backObj.rotate = backRawFrame.rotateData
                  } else {
                    backObj.newArr147 = backRawFrame.rotateData.length ? backRaw : backRaw.slice(0, backRaw.length - 4)
                    backObj.rotate = backRawFrame.rotateData.length ? backRawFrame.rotateData : backRaw.slice(backRaw.length - 4)
                  }
                }

                if (file == 'footVideo') {
                  if (localData[value]?.data) {
                    const sitRaw256 = parseStoredSensorFrame(JSON.parse(localData[value].data || '[]'), file).pressureData
                    if (sitRaw256.length === 256) {
                      // 新版：存储的是原始256点数据，需要插值和映射
                      sitObj.sitData = footVideo([...sitRaw256])
                      sitObj.newArr147 = footL([...sitRaw256])
                    } else {
                      // 旧版：存储的是512点插值数据，用旧逻辑
                      sitObj.newArr147 = footArrToNormal(localData[value].data)
                    }
                  }
                  if (localDataBack[value]?.data) {
                    const backRaw256 = parseStoredSensorFrame(JSON.parse(localDataBack[value].data || '[]'), file).pressureData
                    if (backRaw256.length === 256) {
                      // 新版：存储的是原始256点数据，需要插值和映射
                      backObj.backData = footVideo1([...backRaw256])
                      backObj.newArr147 = footR([...backRaw256])
                    } else {
                      // 旧版：存储的是512点插值数据，用旧逻辑
                      backObj.newArr147 = footArrToNormal(localDataBack[value].data)
                    }
                  }
                }

                if (file === WHOLE_CHAIR_TYPE) {
                  sitObj.sitData = normalizeWholeChairFrame('sit', localData[value]?.data);
                  backObj.backData = normalizeWholeChairFrame('back', localDataBack[value]?.data);
                }

                jsonData = JSON.stringify(sitObj);
                jsonData1 = JSON.stringify(backObj);

                if (isThreePortFile(file)) {
                  let jsonData2 = JSON.stringify({
                    // sitData: localData[value]?.data,
                    headData: file === WHOLE_CHAIR_TYPE
                      ? normalizeWholeChairFrame('head', localDataHead[value]?.data)
                      : localDataHead[value]?.data,
                    time: localDataHead[value]?.timestamp,
                    sitFlag: localData.length > 0,
                  });

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData2);
                    }
                  });
                }

              } else {
                if (file === TEMP_FULL_BED_TYPE) {
                  jsonData = JSON.stringify(buildTempFullBedPlaybackPayload(localData[value]));
                } else if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE) {
                  jsonData = JSON.stringify(buildSmallBedPlaybackPayload(localData[value]));
                } else {
                  jsonData = JSON.stringify({
                    sitData: localData[value]?.data,
                    time: localData[value]?.timestamp,
                  });
                }
              }

              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
              if (isCar(file)) {
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData1);
                  }
                });
              }
            }
          }
          if (JSON.parse(message).speed != null) {
            const speed = JSON.parse(message).speed;
            interval = Math.max(1, parseInt(detectedInterval / speed));

            if (playFlag) {
              if (timer) {
                clearInterval(timer);
              }
              timer = setInterval(() => {
                nowIndex++;
                // console.log(interval)
                // console.log(localData,nowIndex)
                let jsonData
                if (file === TEMP_FULL_BED_TYPE) {
                  jsonData = JSON.stringify(buildTempFullBedPlaybackPayload(localData[nowIndex], { index: nowIndex }));
                } else if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE) {
                  jsonData = JSON.stringify(buildSmallBedPlaybackPayload(localData[nowIndex], { index: nowIndex }));
                } else {
                  const sitPlaybackData = file === WHOLE_CHAIR_TYPE
                    ? normalizeWholeChairFrame('sit', localData[nowIndex]?.data)
                    : localData[nowIndex]?.data;
                  jsonData = JSON.stringify({
                    sitData: sitPlaybackData,
                    // backData: localDataBack[nowIndex]?.data,
                    time: localData[nowIndex]?.timestamp,
                    index: nowIndex,
                  });
                }


                const backPlaybackData = file === WHOLE_CHAIR_TYPE
                  ? normalizeWholeChairFrame('back', localDataBack[nowIndex]?.data)
                  : localDataBack[nowIndex]?.data;
                const jsonData1 = JSON.stringify({
                  // sitData: new Array(sitTotal).fill(0),
                  backData: backPlaybackData,
                  index: nowIndex,
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData1);
                  }
                });

                if (isThreePortFile(file)) {
                  let jsonData2 = JSON.stringify({
                    // sitData: localData[value]?.data,
                    headData: file === WHOLE_CHAIR_TYPE
                      ? normalizeWholeChairFrame('head', localDataHead[nowIndex]?.data)
                      : localDataHead[nowIndex]?.data,
                    time: localDataHead[nowIndex]?.timestamp,
                    sitFlag: localData.length > 0,
                  });

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData2);
                    }
                  });
                }

                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }, interval);
            } else {
              console.log("clear");
              stopPlaybackTimer();
            }
          }
          if (getMessage.play != null) {
            playFlag = getMessage.play;
            if (playFlag) {
              if (timer) {
                clearInterval(timer);
              }
              timer = setInterval(() => {
                if (nowIndex <= indexArr[1]) {
                  nowIndex++;

                  let jsonData

                  const sitObj = {
                    sitData: localData[nowIndex]?.data,
                    // backData: localDataBack[nowIndex]?.data,
                    time: localData[nowIndex]?.timestamp,
                    index: nowIndex,
                    backFlag: localDataBack.length > 0,
                  }

                  const backObj = {
                    // sitData: new Array(sitTotal).fill(0),
                    index: nowIndex,
                    backData: localDataBack[nowIndex]?.data,
                    sitFlag: localData.length > 0,
                  }

                  if (file.includes('robot')) {
                  const sitRawText = localData[nowIndex]?.data
                  const backRawText = localDataBack[nowIndex]?.data
                  if (sitRawText) {
                      const sitFrame = parseStoredSensorFrame(JSON.parse(sitRawText), file)
                      const sitRaw = sitFrame.pressureData
                      if (sitFrame.rotateData.length) sitObj.rotate = sitFrame.rotateData
                      if (sitRaw.length >= 256) {
                        // 新版：前256是原始数据，后4是四元数
                        const sitPressure = sitRaw.slice(0, 256)
                        sitObj.sitData = sitPressure
                        sitObj.newArr147 = sitPressure
                      } else {
                        // 旧版：直接是压力数据
                        const sitPressure = normalizeFiniteFrame(sitRaw, 256)
                        sitObj.sitData = sitPressure
                        sitObj.newArr147 = sitPressure
                      }
                    }
                    if (backRawText) {
                      const backFrame = parseStoredSensorFrame(JSON.parse(backRawText), file)
                      const backRaw = backFrame.pressureData
                      if (backFrame.rotateData.length) backObj.rotate = backFrame.rotateData
                      if (backRaw.length >= 256) {
                        // 新版：前256是原始数据，后4是四元数
                        const backPressure = backRaw.slice(0, 256)
                        backObj.backData = backPressure
                        backObj.newArr147 = backPressure
                      } else {
                        // 旧版：直接是压力数据
                        const backPressure = normalizeFiniteFrame(backRaw, 256)
                        backObj.backData = backPressure
                        backObj.newArr147 = backPressure
                      }
                    }
                  } else if (isHandGloveType(file)) {
                    // 鍏煎鏂版棫鏁版嵁鏍煎紡锛氭柊鐗?60(256+4)锛屾棫鐗?51(147+4)
                    const sitRawFrame = parseStoredSensorFrame(JSON.parse(localData[nowIndex]?.data || '[]'), file)
                    const backRawFrame = parseStoredSensorFrame(JSON.parse(localDataBack[nowIndex]?.data || '[]'), file)
                    const sitRaw = sitRawFrame.pressureData
                    const backRaw = backRawFrame.pressureData
                    if (file === HAND_GLOVE_FULL_PACKET && sitRaw.length >= 256) {
                      const sitPressure = sitRaw.slice(0, 256)
                      const sitMapped = mapHandGloveFullPacketPressure([...sitPressure], 'left')
                      sitObj.sitData = mapHandGloveFullPacketModelMatrix(sitMapped)
                      sitObj.realArr = sitPressure
                      sitObj.rawPressureData = sitPressure
                      sitObj.newArr147 = sitMapped
                      sitObj.mappedArr195 = sitMapped
                      sitObj.rotate = []
                    } else if (sitRaw.length >= 260) {
                      const sitPressure = sitRaw.slice(0, 256)
                      const sitRotate = sitRawFrame.rotateData.length ? sitRawFrame.rotateData : sitRaw.slice(256, 260)
                      sitObj.sitData = sitPressure
                      sitObj.newArr147 = file === HAND_GLOVE_FULL_PACKET ? mapHandGloveFullPacketPressure([...sitPressure], 'left') : handL([...sitPressure])
                      sitObj.rotate = sitRotate
                    } else if (sitRaw.length >= 256) {
                      const sitPressure = sitRaw.slice(0, 256)
                      sitObj.sitData = sitPressure
                      sitObj.rawPressureData = sitPressure
                      sitObj.newArr147 = handL([...sitPressure])
                      sitObj.rotate = sitRawFrame.rotateData
                    } else {
                      sitObj.newArr147 = sitRawFrame.rotateData.length ? sitRaw : sitRaw.slice(0, sitRaw.length - 4)
                      sitObj.rotate = sitRawFrame.rotateData.length ? sitRawFrame.rotateData : sitRaw.slice(sitRaw.length - 4)
                    }
                    if (file === HAND_GLOVE_FULL_PACKET && backRaw.length >= 256) {
                      const backPressure = backRaw.slice(0, 256)
                      const backMapped = mapHandGloveFullPacketPressure([...backPressure], 'right')
                      backObj.backData = mapHandGloveFullPacketModelMatrix(backMapped)
                      backObj.realArr = backPressure
                      backObj.rawPressureData = backPressure
                      backObj.newArr147 = backMapped
                      backObj.mappedArr195 = backMapped
                      backObj.rotate = []
                    } else if (backRaw.length >= 260) {
                      const backPressure = backRaw.slice(0, 256)
                      const backRotate = backRawFrame.rotateData.length ? backRawFrame.rotateData : backRaw.slice(256, 260)
                      backObj.backData = backPressure
                      backObj.newArr147 = file === HAND_GLOVE_FULL_PACKET ? mapHandGloveFullPacketPressure([...backPressure], 'right') : handR([...backPressure])
                      backObj.rotate = backRotate
                    } else if (backRaw.length >= 256) {
                      const backPressure = backRaw.slice(0, 256)
                      backObj.backData = backPressure
                      backObj.rawPressureData = backPressure
                      backObj.newArr147 = handR([...backPressure])
                      backObj.rotate = backRawFrame.rotateData
                    } else {
                      backObj.newArr147 = backRawFrame.rotateData.length ? backRaw : backRaw.slice(0, backRaw.length - 4)
                      backObj.rotate = backRawFrame.rotateData.length ? backRawFrame.rotateData : backRaw.slice(backRaw.length - 4)
                    }
                  }

                  if (file == 'footVideo') {
                    if (localData[nowIndex]?.data) {
                        const sitRaw256 = parseStoredSensorFrame(JSON.parse(localData[nowIndex].data || '[]'), file).pressureData
                        if (sitRaw256.length === 256) {
                        // 新版：存储的是原始256点数据，需要插值和映射
                        sitObj.sitData = footVideo([...sitRaw256])
                        sitObj.newArr147 = footL([...sitRaw256])
                      } else {
                        // 旧版：存储的是512点插值数据，用旧逻辑
                        sitObj.newArr147 = footArrToNormal(localData[nowIndex].data)
                      }
                    }
                    if (localDataBack[nowIndex]?.data) {
                        const backRaw256 = parseStoredSensorFrame(JSON.parse(localDataBack[nowIndex].data || '[]'), file).pressureData
                        if (backRaw256.length === 256) {
                        // 新版：存储的是原始256点数据，需要插值和映射
                        backObj.backData = footVideo1([...backRaw256])
                        backObj.newArr147 = footR([...backRaw256])
                      } else {
                        // 旧版：存储的是512点插值数据，用旧逻辑
                        backObj.newArr147 = footArrToNormal(localDataBack[nowIndex].data)
                      }
                    }
                  }

                  if (file === WHOLE_CHAIR_TYPE) {
                    sitObj.sitData = normalizeWholeChairFrame('sit', localData[nowIndex]?.data);
                    backObj.backData = normalizeWholeChairFrame('back', localDataBack[nowIndex]?.data);
                  }

                  if (file === TEMP_FULL_BED_TYPE) {
                    jsonData = JSON.stringify(buildTempFullBedPlaybackPayload(localData[nowIndex], {
                      index: nowIndex,
                      backFlag: localDataBack.length > 0,
                    }));
                  } else if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE) {
                    jsonData = JSON.stringify(buildSmallBedPlaybackPayload(localData[nowIndex], {
                      index: nowIndex,
                      backFlag: localDataBack.length > 0,
                    }));
                  } else {

                    jsonData = JSON.stringify(sitObj);

                  }


                  const jsonData1 = JSON.stringify(backObj);

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData1);
                    }
                  });

                  if (isThreePortFile(file)) {
                    let jsonData2 = JSON.stringify({
                      // sitData: localData[value]?.data,
                      headData: file === WHOLE_CHAIR_TYPE
                        ? normalizeWholeChairFrame('head', localDataHead[nowIndex]?.data)
                        : localDataHead[nowIndex]?.data,
                      index: nowIndex,
                      sitFlag: localData.length > 0,
                    });

                    server.clients.forEach(function each(client) {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(jsonData2);
                      }
                    });
                  }

                  server.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });
                } else {
                  stopPlaybackTimer();
                }
              }, interval);
            } else {
              stopPlaybackTimer();
            }
          }

          if (getMessage.index != null) {
            nowIndex = getMessage.index;
          }

          // 娴溿倖宕叉稉鎻掑經
          if (getMessage.exchange != null) {
            [com, com1] = [com1, com];
            // port1.close();
            // port2.close();
            if (port1?.isOpen) {
              port1.close();
            }
            if (port2?.isOpen) {
              port2.close();
            }

            setTimeout(() => {
              if (com) {
                try {
                  port1 = new SerialPort(
                    {
                      path: com,

                      baudRate: baudRate,
                      autoOpen: true,
                    },
                    function (err) {
                      logger.warn(err, "err");
                    }
                  );
                  //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                  port1.pipe(getSitParser());
                } catch (e) {
                  logger.warn(e, "e");
                }
              }

              if (com1) {
                try {
                  port2 = new SerialPort(
                    {
                      path: com1,

                      baudRate: baudRate,
                      autoOpen: true,
                    },
                    function (err) {
                      logger.warn(err, "err");
                    }
                  );
                  //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
                  bindBackPortParser();
                } catch (e) {
                  logger.warn(e, "e");
                }
              }
            }, 1000);
          }

          if (getMessage.backIndex != null) {
            let press = [],
              area = [];
            if (localDataBack.length) {
              const backArr = getMessage.backIndex;
              (backPressSelect = []), (backAreaSelect = []);
              for (let i = 0; i < localDataBack.length; i++) {
                newback = [];
                // for (let x = backArr[2] < 0 ? 0 :backArr[2] ; x < backArr[3]; x++) {
                //   for (let y = backArr[0] < 0 ? 0 :backArr[0] ; y < backArr[1]; y++) {
                //     newback.push(JSON.parse(localDataBack[i].data)[x * 32 + y])
                //   }
                // }

                for (
                  let x = backArr[0] < 0 ? 0 : backArr[0];
                  x <= (backArr[1] > 31 ? 31 : backArr[1]);
                  x++
                ) {
                  for (
                    let y = 31 - backArr[3] < 0 ? 0 : 31 - backArr[3];
                    y <= (31 - backArr[2] > 31 ? 31 : 31 - backArr[2]);
                    y++
                  ) {
                    newback.push(JSON.parse(localDataBack[i].data)[x * 32 + y]);
                  }
                }
                // newback = newback.filter((a))
                let a = newback.reduce((a, b) => a + b, 0);
                let b = newback.filter((a) => a > 10).length;

                // backPressSelect.push(pressToN(b, a ));
                // backAreaSelect.push(b*2.1);

                backPressSelect.push(totalToN(a, 1.3));
                backAreaSelect.push(b);
              }


              server.clients.forEach(function each(client) {
                /**
                 * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                 *  */

                const jsonData = JSON.stringify({
                  pressArr: backPressSelect,
                  areaArr: backAreaSelect,
                  length: length,
                  time: timeStamp,
                  index: nowIndex,
                  // backData: file === 'car10' ? new Array(100).fill(0) : new Array(1024).fill(0),
                });
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }
          }

          if (getMessage.sitIndex != null) {

            const sitArr = getMessage.sitIndex;
            (sitPressSelect = []), (sitAreaSelect = []);
            for (let i = 0; i < localData.length; i++) {
              const newsit = [];
              // for (let x = sitArr[2]; x < sitArr[3]; x++) {
              //   for (let y = sitArr[0]; y < sitArr[1]; y++) {
              //     newsit.push(JSON.parse(localData[i].data)[x * 32 + y])
              //   }
              // }
              if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE || file === TEMP_FULL_BED_TYPE) {
                const storedSitData = file === TEMP_FULL_BED_TYPE
                  ? buildTempFullBedPlaybackPayload(localData[i]).sitData
                  : getStoredSitData(localData[i]);
                const storedFrame = parseStoredFrameData(localData[i]);
                const storedWidth = file === TEMP_FULL_BED_TYPE ? 15 : Number(storedFrame?.matrixWidth) || 32;
                for (let x = sitArr[0]; x < sitArr[1]; x++) {
                  for (let y = sitArr[2]; y < sitArr[3]; y++) {
                    newsit.push(storedSitData[x * storedWidth + y]);
                  }
                }
              } else {
                let data = JSON.parse(localData[i].data)
                // data = pressSmallBed({arr : data ,width : 32 ,height : 32 , type})
                for (let x = sitArr[2]; x < sitArr[3]; x++) {
                  for (let y = sitArr[0]; y < sitArr[1]; y++) {
                    newsit.push(JSON.parse(localData[i].data)[x * 32 + y]);
                  }
                }

              }

              let a = newsit.reduce((a, b) => a + b, 0);
              let b = newsit.filter((a) => a > 10).length;
              // sitPressSelect.push(pressToN(b, a));
              // sitAreaSelect.push(b * 2.1);
              sitPressSelect.push(totalToN(a));
              sitAreaSelect.push(b);
            }

            server.clients.forEach(function each(client) {
              /**
               * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
               *  */
              const jsonData = JSON.stringify({
                length: length,
                time: timeStamp,
                index: nowIndex,
                pressArr: sitPressSelect,
                areaArr: sitAreaSelect,
                // length: csvSitData.length,
                // sitData: file === 'bigBed' ? new Array(2048).fill(0) : new Array(1024).fill(0),
              });
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
          }

          // 娑撳娴嘽sv
          if (getMessage.download) {
            smoothValue = 0;
            const csvWriteData = [];
            const csvWriteBackData = [];
            const csvWriteHeadData = [];
            const csvFormat = String(getMessage.downloadOptions?.format || 'csv').toLowerCase();
            const csvTitle = getCsvTitleMap(getMessage.downloadOptions || {});
            if (csvFormat !== 'csv') {
              broadcastCsvDownloadResult('export csv failed', { error: `unsupported export format: ${csvFormat}` });
              return;
            }
            const csvExportDir = getCsvExportDirectory(getMessage.downloadOptions || {});
            if (!csvExportDir.ok) {
              logger.error('[CSV] invalid export directory:', csvExportDir.error);
              broadcastCsvDownloadResult('export csv failed', { error: csvExportDir.error });
              return;
            }
            const csvTargetPath = (filename) => path.join(csvExportDir.dir, filename);
            const sendCsvSuccess = (files = []) => broadcastCsvDownloadResult('export csv success', {
              files,
              dir: csvExportDir.dir,
            });
            const sendCsvFailed = (error, files = []) => broadcastCsvDownloadResult('export csv failed', {
              files,
              dir: csvExportDir.dir,
              error: error?.message || String(error || ''),
            });
            const sendCsvProgress = (progress = {}) => broadcastCsvDownloadProgress({
              ...progress,
              dir: csvExportDir.dir,
            });
            //閺屻儴顕楃拠顓炲綖
            // const selectQuery = 'select * from matrix WHERE timestamp>? and timestamp<? and date=?';
            const selectQuery = "select * from matrix WHERE date=?";
            // const params = [1287154796066,1887154796066,'2023-06-19-14:05'];
            const params = [getMessage.download];
            const collectionLabelInfo = getCollectionCsvLabelInfo(getMessage.download);

            exportHistoryCsvStreaming({
              date: getMessage.download,
              csvTitle,
              csvTargetPath,
              sendCsvSuccess,
              sendCsvFailed,
              sendCsvProgress,
              downloadOptions: getMessage.downloadOptions || {},
            });
            return;

            if (file === HAND_GLOVE_DOUBLE) {
              exportHandGloveDoubleCsv({
                selectQuery,
                params,
                csvTitle,
                csvTargetPath,
                sendCsvSuccess,
                sendCsvFailed,
                downloadOptions: getMessage.downloadOptions || {},
              });
              return;
            }

            if (file === "bigBed") {
              let startPressure = 0;
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //閹跺﹥妞傞梻?閸樺濮忛棃銏⑿?楠炲啿娼庨崢瀣閺佺増宓乸ush鏉╂矞svWriter鏉╂稖顢戝Ч鍥ㄢ偓?
                  for (var i = historyArr[0]; i < historyArr[1]; i++) {
                    // const press = JSON.parse(rows[i][`data`]).reduce(
                    //   (a, b) => a + b,
                    //   0
                    // );
                    wsPointData = JSON.parse(rows[i][`data`]).map((a) =>
                      a < 10 ? 0 : a
                    );
                    const pressValue =
                      wsPointData.reduce((a, b) => a + b, 0) /
                      wsPointData.filter((a) => a > 0).length;
                    const realArr = wsPointData; // press([...wsPointData], 1500);

                    const bodyArr = [];
                    for (let i = 0; i < 64; i++) {
                      let num = 0;
                      for (let j = 0; j < 32; j++) {
                        num += realArr[j * 64 + i];
                      }
                      smoothValue = smoothValue + (num / 32 - smoothValue) / 3;
                      bodyArr.push(smoothValue.toFixed(2));
                    }

                    // const pressure =
                    //   realArr.reduce((a, b) => a + b, 0) /
                    //   realArr.filter((a) => a > 0).length;
                    const total = realArr.reduce((a, b) => a + b, 0);
                    let length = realArr.filter((a) => a > 0).length;
                    length = length ? length : 1;
                    let pressure = calculatePressure(total / length);
                    const newPressure = total / length;
                    const change = objChange(newPressure, startPressure, 4);
                    if (change) {
                      startPressure = newPressure;
                      time = 0;
                    } else {
                      time++;
                      pressure = calculatePressure(
                        calPress(startPressure, newPressure, time)
                      );
                      if (time > 240 * 13) {
                        time = 240 * 13;
                      }
                    }

                    // const pressuremmgH = calculatePressure(pressure);

                    const area = JSON.parse(rows[i][`data`]).filter(
                      (a) => a > 0
                    ).length;
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: area, //閸樼喎顫愰惌鈺呮█
                      pressure: total / length,
                      realData: realArr,
                      pressValue: wsPointData.reduce((a, b) => a + b, 0),
                      pressuremmgH: pressure,
                      pressLine: bodyArr,
                    };
                    csvWriteData.push(newData);
                  }
                  // 鐏忓棙鐪归幀鑽ゆ畱閸樺濮忛弫鐗堝祦閸愭瑥鍙?CSV 閺傚洣娆?
                  // const timeStamp = Date.now()
                  const str = nowGetTime.replace(/[/:]/g, "-");
                  const csvFilePath = csvTargetPath(`${file}${str}.csv`);
                  const csvWriter = createCsvWriter({
                    path: csvFilePath, // 閹稿洤鐣炬潏鎾冲毉閺傚洣娆㈤惃鍕熅瀵板嫬鎷伴崥宥囆?
                    header: [
                      { id: "time", title: csvTitle.time },
                      { id: "pressureArea", title: csvTitle.pressureArea },
                      { id: "pressValue", title: csvTitle.pressValue },
                      { id: "pressure", title: csvTitle.pressure },
                      { id: "pressuremmgH", title: csvTitle.pressuremmgH },
                      { id: "realData", title: csvTitle.realData },
                      { id: "pressLine", title: csvTitle.pressLine },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");
                      sendCsvSuccess([csvFilePath]);
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      sendCsvFailed(err);
                    });
                }
              });
            } else if (isSmallBedMatrixType(file) || file === 'smallBed1') {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //閹跺﹥妞傞梻?閸樺濮忛棃銏⑿?楠炲啿娼庨崢瀣閺佺増宓乸ush鏉╂矞svWriter鏉╂稖顢戝Ч鍥ㄢ偓?

                  if (!rows.length) return;
                  for (var i = historyArr[0], j = 0; i < historyArr[1]; i++, j++) {
                    const storedFrame = parseStoredFrameData(rows[i]);
                    let sitData = normalizeHistoryPressureData(rows[i], file);
                    let matrixWidth = Number(storedFrame?.matrixWidth) || Math.sqrt(sitData.length) || 32;
                    let matrixHeight = Number(storedFrame?.matrixHeight) || matrixWidth;
                    if (shouldTransposeSmallBedRawMatrix(file) && matrixWidth === matrixHeight) {
                      sitData = transposeSquareMatrix(sitData, matrixWidth);
                    }
                    // sitData = zeroLine(sitData,32,32)
                    // sitData = pressSmallBed({ arr: sitData })

                    const press = sitPressSelect.length
                      ? sitPressSelect[i]
                      : sitData.reduce((a, b) => a + b, 0);

                    const area = sitAreaSelect.length
                      ? sitAreaSelect[i]
                      : sitData.filter((a) => a > 0).length;

                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: sitAreaSelect.length
                        ? sitAreaSelect[i]
                        : area, //閸樼喎顫愰惌鈺呮█
                      pressure: sitPressSelect.length
                        ? sitPressSelect[i]
                        : totalToN(press),
                      realData: JSON.stringify(sitData),
                      index: getCsvElapsedSeconds(rows, i, historyArr[0], j),
                      max: findMax(sitData),
                    };
                    csvWriteData.push(newData);
                  }
                  // 鐏忓棙鐪归幀鑽ゆ畱閸樺濮忛弫鐗堝祦閸愭瑥鍙?CSV 閺傚洣娆?
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime; //.replace(/[/:]/g, "-");
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvFilePath = csvTargetPath(`${file}${str}.csv`);
                  const csvWriter = createCsvWriter({
                    path: csvFilePath, // 閹稿洤鐣炬潏鎾冲毉閺傚洣娆㈤惃鍕熅瀵板嫬鎷伴崥宥囆?
                    header: getDefaultSitCsvHeaders(csvTitle),
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");
                      sendCsvSuccess([csvFilePath]);
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      sendCsvFailed(err);
                    });
                }
              });
            } else if (file === 'sitCol') {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //閹跺﹥妞傞梻?閸樺濮忛棃銏⑿?楠炲啿娼庨崢瀣閺佺増宓乸ush鏉╂矞svWriter鏉╂稖顢戝Ч鍥ㄢ偓?
                  const { label, labelText } = getCollectionCsvLabelInfo(getMessage.download)
                  if (!rows.length) return;
                  for (var i = 0, j = 0; i < rows.length; i++, j++) {
                    const newData = {
                      realData: rows[i][`data`],
                      label: label,
                      labelText: labelText
                    };
                    csvWriteData.push(newData);
                  }
                  // 鐏忓棙鐪归幀鑽ゆ畱閸樺濮忛弫鐗堝祦閸愭瑥鍙?CSV 閺傚洣娆?
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  // let str = nowGetTime; //.replace(/[/:]/g, "-");
                  let str = getMessage.download
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvFilePath = csvTargetPath(`${file}${str}.csv`);
                  const csvWriter = createCsvWriter({
                    path: csvFilePath, // 閹稿洤鐣炬潏鎾冲毉閺傚洣娆㈤惃鍕熅瀵板嫬鎷伴崥宥囆?
                    header: [
                      { id: "realData", title: csvTitle.realData },
                      { id: "label", title: csvTitle.label },
                      { id: "labelText", title: csvTitle.labelText },
                    ],
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");
                      sendCsvSuccess([csvFilePath]);
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      sendCsvFailed(err);
                    });
                }
              });
            } else if (file === 'matCol') {
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  //閹跺﹥妞傞梻?閸樺濮忛棃銏⑿?楠炲啿娼庨崢瀣閺佺増宓乸ush鏉╂矞svWriter鏉╂稖顢戝Ч鍥ㄢ偓?
                  const { label, labelText } = getCollectionCsvLabelInfo(getMessage.download)
                  if (!rows.length) return;
                  const baseTimestamp = rows[0]?.timestamp;
                  for (var i = 0, j = 0; i < rows.length; i++, j++) {
                    const newData = buildCollectionCsvRow(rows[i], {
                      absoluteIndex: i,
                      relativeIndex: j,
                      baseTimestamp,
                    }, csvTitle, {
                      transformRealData: formatMatColCsvRealData,
                      label,
                      labelText,
                    });
                    csvWriteData.push(newData);
                  }
                  // 鐏忓棙鐪归幀鑽ゆ畱閸樺濮忛弫鐗堝祦閸愭瑥鍙?CSV 閺傚洣娆?
                  // const timeStamp = Date.now()

                  // const str = nowGetTime.replace(/[/:]/g, "-");
                  // let str = nowGetTime; //.replace(/[/:]/g, "-");
                  let str = getMessage.download
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvFilePath = csvTargetPath(`${file}${str}.csv`);
                  const csvWriter = createCsvWriter({
                    path: csvFilePath, // 閹稿洤鐣炬潏鎾冲毉閺傚洣娆㈤惃鍕熅瀵板嫬鎷伴崥宥囆?
                    header: buildCollectionCsvHeaders(csvTitle),
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");
                      sendCsvSuccess([csvFilePath]);
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      sendCsvFailed(err);
                    });
                }
              });
            } else if (file !== "car10") {
              // 鍒ゆ柇鏄惁鏄Е瑙夋墜濂楃被鍨嬶紝闇€瑕佸垎绂诲師濮?56鏁版嵁鍜屽洓鍏冩暟
              const isHandType = isHandStorageType(file);
              const isHandGloveCsvType = isHandGloveType(file);
              const shouldWriteZeroFrame = isZeroFrameStorageType(file);
              const shouldWriteDetectionPoint = file === HAND_SINGLE_POINT_TYPE;
              db.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  if (!rows.length) return;
                  console.log(historyArr)
                  for (var i = historyArr[0], j = 0; i < historyArr[1] - 1; i++, j++) {
                    const rawData = JSON.parse(rows[i][`data`]);
                    let pressureData, rotateData, zeroFrameData = [];
                    let tempFullBedPayload = null;
                    if (file === TEMP_FULL_BED_TYPE) {
                      tempFullBedPayload = buildTempFullBedPlaybackPayload(rows[i]);
                      pressureData = tempFullBedPayload.sitData;
                      rotateData = [];
                    } else if (shouldWriteZeroFrame) {
                      const storedFrame = parseStoredSensorFrame(rawData, file);
                      pressureData = storedFrame.pressureData;
                      rotateData = storedFrame.rotateData;
                      zeroFrameData = storedFrame.zeroFrame;
                    } else if (isHandType) {
                      // 鍏煎鏂版棫鏁版嵁鏍煎紡
                      if (rawData.length >= 260) {
                        // 鏂扮増锛氬墠256鏄師濮嬪帇鍔涙暟鎹紝鍚?鏄洓鍏冩暟
                        pressureData = rawData.slice(0, 256);
                        rotateData = rawData.slice(256, 260);
                      } else {
                        // 鏃х増锛氬墠147鏄痭ewArr147锛屽悗4鏄洓鍏冩暟
                        pressureData = rawData.slice(0, rawData.length - 4);
                        rotateData = rawData.slice(rawData.length - 4);
                      }
                    } else {
                      pressureData = Array.isArray(rawData) ? rawData : getHistoryPressureData(rows[i]);
                      rotateData = [];
                    }
                    if (file === WHOLE_CHAIR_TYPE) {
                      pressureData = normalizeWholeChairFrame('sit', pressureData);
                    }
                    if (shouldTransposeSmallBedRawMatrix(file)) {
                      pressureData = transposeSquareMatrix(pressureData);
                    }
                    console.log(pressureData.length)
                    const press = sitPressSelect.length
                      ? sitPressSelect[i]
                      : pressureData.reduce((a, b) => a + b, 0);

                    const area = sitAreaSelect.length
                      ? sitAreaSelect[i]
                      : pressureData.filter((a) => a > 0).length;

                    const max = findMax(pressureData)
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: sitAreaSelect.length
                        ? sitAreaSelect[i]
                        : area,
                      pressure: sitPressSelect.length
                        ? sitPressSelect[i]
                        : totalToN(press),
                      realData: JSON.stringify(pressureData),
                      index: getCsvElapsedSeconds(rows, i, historyArr[0], j),
                      max,
                      rotate: rotateData.length ? JSON.stringify(rotateData) : '',
                      zeroFrame: zeroFrameData.length ? JSON.stringify(zeroFrameData) : '',
                      temperatureData: tempFullBedPayload ? JSON.stringify(tempFullBedPayload.temperatureData.map((value) => Number(value).toFixed(1))) : '',
                      temperatureAvg: tempFullBedPayload?.temperatureAvg != null ? Number(tempFullBedPayload.temperatureAvg).toFixed(1) : '',
                      temperatureK: tempFullBedPayload?.temperatureK ?? '',
                    };
                    if (shouldWriteDetectionPoint) {
                      newData.detectionPoint = pressureData[pressureData.length - 1] ?? '';
                    }
                    if (isHandGloveCsvType) {
                      Object.assign(newData, buildHandGloveCsvSegments(pressureData, 'left'));
                    }
                    csvWriteData.push(applyCollectionLabelInfo(newData, collectionLabelInfo));
                  }

                  let str = nowGetTime;
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const csvHeaders = [
                    { id: "index", title: csvTitle.index },
                    { id: "max", title: csvTitle.max },
                    { id: "time", title: csvTitle.time },
                    { id: "pressureArea", title: csvTitle.pressureArea },
                    { id: "pressure", title: csvTitle.pressure },
                    { id: "realData", title: csvTitle.realData },
                  ];
                  if (isHandGloveCsvType) {
                    appendHandGloveCsvHeaders(csvHeaders, csvTitle);
                  }
                  if (shouldWriteDetectionPoint) {
                    csvHeaders.push({ id: "detectionPoint", title: csvTitle.detectionPoint });
                  }
                  if (shouldWriteZeroFrame) {
                    csvHeaders.push({ id: "zeroFrame", title: csvTitle.zeroFrame });
                  }
                  if (isHandType) {
                    csvHeaders.push({ id: "rotate", title: csvTitle.rotate });
                  }
                  if (file === TEMP_FULL_BED_TYPE) {
                    csvHeaders.push(
                      { id: "temperatureData", title: csvTitle.temperatureData },
                      { id: "temperatureAvg", title: csvTitle.temperatureAvg },
                      { id: "temperatureK", title: csvTitle.temperatureK },
                    );
                  }
                  appendCollectionLabelHeaders(csvHeaders, csvTitle, collectionLabelInfo);

                  const csvFilePath = csvTargetPath(`${getCsvFilePrefix(file, 'sit', getMessage.downloadOptions || {})}${str}.csv`);
                  const csvWriter = createCsvWriter({
                    path: csvFilePath,
                    header: csvHeaders,
                  });

                  csvWriter
                    .writeRecords(csvWriteData)
                    .then(() => {
                      console.log("export csv success");
                      sendCsvSuccess([csvFilePath]);
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      sendCsvFailed(err);
                    });
                }
              });
            }

            if (isCar(file)) {
              db1.all(selectQuery, params, (err, rows) => {
                if (err) {
                  logger.error(err);
                } else {
                  // console.log(rows)
                  //閹跺﹥妞傞梻?閸樺濮忛棃銏⑿?楠炲啿娼庨崢瀣閺佺増宓乸ush鏉╂矞svWriter鏉╂稖顢戝Ч鍥ㄢ偓?
                  if (!rows.length) return;

                  // if()

                  const isBackHandType = isHandStorageType(file);
                  const isBackHandGloveType = isHandGloveType(file);
                  const shouldWriteBackZeroFrame = isZeroFrameStorageType(file);
                  for (var i = historyArr[0], j = 0; i < historyArr[1]; i++, j++) {
                    const rawBackData = JSON.parse(rows[i][`data`]);
                    let backData, backRotateData, backZeroFrameData = [];
                    if (shouldWriteBackZeroFrame) {
                      const storedBackFrame = parseStoredSensorFrame(rawBackData, file);
                      backData = storedBackFrame.pressureData;
                      backRotateData = storedBackFrame.rotateData;
                      backZeroFrameData = storedBackFrame.zeroFrame;
                    } else if (isBackHandType && rawBackData.length >= 260) {
                      // 新版：前256是原始压力数据，后4是四元数
                      backData = rawBackData.slice(0, 256);
                      backRotateData = rawBackData.slice(256, 260);
                    } else if (isBackHandType && rawBackData.length > 4) {
                      // 旧版：前N-4是数据，后4是四元数
                      backData = rawBackData.slice(0, rawBackData.length - 4);
                      backRotateData = rawBackData.slice(rawBackData.length - 4);
                    } else {
                      backData = rawBackData;
                      backRotateData = [];
                    }
                    if (file === WHOLE_CHAIR_TYPE) {
                      backData = normalizeWholeChairFrame('back', backData);
                    }
                    // const press = calPressArr(backData , backIndex , 32)
                    const press = backPressSelect.length
                      ? backPressSelect[i]
                      : backData.reduce((a, b) => a + b, 0);
                    const area = backAreaSelect.length
                      ? backAreaSelect[i]
                      : backData.filter((a) => a > 10).length;
                    const max = findMax(backData);
                    const newData = {
                      time: timeStampToDate(rows[i][`timestamp`]),
                      pressureArea: backAreaSelect.length
                        ? backAreaSelect[i]
                        : area,
                      pressure: backPressSelect.length
                        ? backPressSelect[i]
                        : totalToN(press, 1.3),
                      realData: JSON.stringify(backData),
                      index: getCsvElapsedSeconds(rows, i, historyArr[0], j),
                      area1: [...backData].filter(a => a > 1).length,
                      area10: [...backData].filter(a => a > 10).length,
                      total1: backData.reduce((a, b) => a + b, 0),
                      total10: [...backData].filter(a => a > 10).reduce((a, b) => a + b, 0),
                      total10area10: [...backData].filter(a => a > 10).reduce((a, b) => a + b, 0) / [...backData].filter(a => a > 10).length,
                      total1area1: backData.reduce((a, b) => a + b, 0) / [...backData].filter(a => a > 1).length,
                      max,
                      rotate: backRotateData.length ? JSON.stringify(backRotateData) : '',
                      zeroFrame: backZeroFrameData.length ? JSON.stringify(backZeroFrameData) : '',
                    };
                    if (isBackHandGloveType) {
                      Object.assign(newData, buildHandGloveCsvSegments(backData, 'right'));
                    }
                    csvWriteBackData.push(applyCollectionLabelInfo(newData, collectionLabelInfo));
                  }
                  // 鐏忓棙鐪归幀鑽ゆ畱閸樺濮忛弫鐗堝祦閸愭瑥鍙?CSV 閺傚洣娆?

                  // let str = nowGetTime.replace(/[/:]/g, "-");
                  let str = nowGetTime;
                  if (str.includes(" ")) {
                    str = str.split(" ")[0];
                  } else {
                    str = timeStampTo_Date(Number(str));
                  }

                  const backCsvHeaders = [
                    { id: "index", title: csvTitle.index },
                    { id: "time", title: csvTitle.time },
                    { id: "max", title: csvTitle.max },
                    { id: "pressureArea", title: csvTitle.pressureArea },
                    { id: "pressure", title: csvTitle.pressure },
                    { id: "realData", title: csvTitle.realData },
                  ];
                  if (isBackHandGloveType) {
                    appendHandGloveCsvHeaders(backCsvHeaders, csvTitle);
                  }
                  if (shouldWriteBackZeroFrame) {
                    backCsvHeaders.push({ id: "zeroFrame", title: csvTitle.zeroFrame });
                  }
                  if (isBackHandType) {
                    backCsvHeaders.push({ id: "rotate", title: csvTitle.rotate });
                  }
                  appendCollectionLabelHeaders(backCsvHeaders, csvTitle, collectionLabelInfo);
                  const backCsvFilePath = csvTargetPath(`${getCsvFilePrefix(file, 'back', getMessage.downloadOptions || {})}${str}.csv`);
                  const csvWriter1 = createCsvWriter({
                    path: backCsvFilePath,
                    header: backCsvHeaders,
                  });

                  csvWriter1
                    .writeRecords(csvWriteBackData)
                    .then(() => {
                      console.log("export csv success");
                      sendCsvSuccess([backCsvFilePath]);
                    })
                    .catch((err) => {
                      console.error("export csv failed", err);
                      sendCsvFailed(err);
                    });
                }
              });

              if (isThreePortFile(file)) {
                db2.all(selectQuery, params, (err, rows) => {
                  if (err) {
                    logger.error(err);
                  } else {
                    // console.log(rows)
                    //閹跺﹥妞傞梻?閸樺濮忛棃銏⑿?楠炲啿娼庨崢瀣閺佺増宓乸ush鏉╂矞svWriter鏉╂稖顢戝Ч鍥ㄢ偓?
                    if (!rows.length) return;

                    // if()

                    const headEndIndex = Math.min(historyArr[1], rows.length);
                    for (var i = historyArr[0], j = 0; i < headEndIndex; i++, j++) {
                      const headData = file === WHOLE_CHAIR_TYPE
                        ? normalizeWholeChairFrame('head', rows[i][`data`])
                        : JSON.parse(rows[i][`data`]);
                      // const press = calPressArr(backData , backIndex , 32)
                      const press = headData.reduce((a, b) => a + b, 0);
                      const area = headData.filter((a) => a > 10).length;
                      // const newData = {
                      //   time: timeStampToDate(rows[i][`timestamp`]),
                      //   pressureArea: backAreaSelect.length
                      //     ? backAreaSelect[i]
                      //     : area * 2.1, //閸樼喎顫愰惌鈺呮█
                      //   pressure: backPressSelect.length
                      //     ? backPressSelect[i]
                      //     : pressToN(area, press),
                      //   realData: rows[i][`data`],
                      // };
                      const max = findMax(headData);
                      const newData = {
                        time: timeStampToDate(rows[i][`timestamp`]),
                        pressureArea: area, //閸樼喎顫愰惌鈺呮█
                        pressure: totalToN(press, 1.3),
                        realData: JSON.stringify(headData),
                        index: getCsvElapsedSeconds(rows, i, historyArr[0], j),
                        area1: [...headData].filter(a => a > 1).length,
                        area10: [...headData].filter(a => a > 10).length,
                        total1: headData.reduce((a, b) => a + b, 0),
                        total10: [...headData].filter(a => a > 10).reduce((a, b) => a + b, 0),
                        total10area10: [...headData].filter(a => a > 10).reduce((a, b) => a + b, 0) / [...headData].filter(a => a > 10).length,
                        total1area1: headData.reduce((a, b) => a + b, 0) / [...headData].filter(a => a > 1).length,
                        max
                      };
                      csvWriteHeadData.push(applyCollectionLabelInfo(newData, collectionLabelInfo));
                    }
                    // 鐏忓棙鐪归幀鑽ゆ畱閸樺濮忛弫鐗堝祦閸愭瑥鍙?CSV 閺傚洣娆?

                    // let str = nowGetTime.replace(/[/:]/g, "-");
                    let str = nowGetTime;
                    if (str.includes(" ")) {
                      str = str.split(" ")[0];
                    } else {
                      str = timeStampTo_Date(Number(str));
                    }

                    const headCsvFilePath = csvTargetPath(`head${str}.csv`);
                    const csvWriter1 = createCsvWriter({
                      path: headCsvFilePath,
                      // path: `./data/back${str}.csv`, // 閹稿洤鐣炬潏鎾冲毉閺傚洣娆㈤惃鍕熅瀵板嫬鎷伴崥宥囆?
                      header: appendCollectionLabelHeaders([
                        { id: "index", title: "seconds" },
                        { id: "time", title: "time" },
                        { id: "max", title: "max" },
                        { id: "pressureArea", title: "area" },
                        { id: "pressure", title: "press" },
                        { id: "realData", title: "data" },

                      ], csvTitle, collectionLabelInfo),
                    });

                    csvWriter1
                      .writeRecords(csvWriteHeadData)
                      .then(() => {
                        console.log("export csv success");
                        sendCsvSuccess([headCsvFilePath]);
                      })
                      .catch((err) => {
                        console.error("export csv failed", err);
                        sendCsvFailed(err);
                      });
                  }
                });
              }
            }
          }

          if (getMessage.delete) {
            const createTableQuery = `delete from matrix  where date='${getMessage.delete}'`;

            db.run(createTableQuery, function (err) {
              if (err) {
                logger.error(err);
                return;
              } else {
                server.clients.forEach(function each(client) {
                  const jsonData = JSON.stringify({
                    download: "deleteSuccess",
                  });
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
            });

            if (file === "car") {
              db1.run(createTableQuery, function (err) {
                if (err) {
                  logger.error(err);
                  return;
                } else {
                  server.clients.forEach(function each(client) {
                    const jsonData = JSON.stringify({
                      download: "deleteSuccess",
                    });
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(jsonData);
                    }
                  });
                }
              });
            }
          }

          // 鐠嬪啯鏆ｆ妯绘焿
          if (getMessage.gauss != null) {
            gauss = getMessage.gauss;
          }

          // 闁插秵鏌婄拠閿嬬湴娑撴彃褰?
          if (getMessage.serialReset != null) {
            SerialPort.list().then((ports) => {
              serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');
              logSerialPortList('serialReset', serialport);

              server.clients.forEach(function each(client) {
                /**
                 * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
                 *  */
                const jsonData = JSON.stringify({
                  port: serialport,
                  // length: csvSitData.length,
                  // sitData: csvSitData[0], backData: csvBackData[0]
                });
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            }).catch((err) => {
              logger.error('[SerialList] serialReset failed', err);
            });
          }

          if (getMessage.autoConnectHand0205Double === true) {
            SerialPort.list().then((ports) => {
              serialport = getPort(ports);
              logSerialPortList('autoConnectHand0205Double', serialport);
              const paths = serialport.map((port) => port.path).filter(Boolean);

              if (paths.length < 2) {
                const jsonData = JSON.stringify({
                  port: serialport,
                  autoConnectHand0205Double: {
                    success: false,
                    message: `触觉手套2 自动连接失败：只检测到 ${paths.length} 个可用手套串口`,
                  },
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
                return;
              }

              const [leftPath, rightPath] = paths;
              sitClose = false;
              backClose = false;
              com = leftPath;
              com1 = rightPath;
              baudRate = getSensorBaudRate(HAND_GLOVE_DOUBLE);

              if (port1?.isOpen) {
                port1.close((err) => {
                  if (err) logger.warn('[autoConnectHand0205Double] port1 close error:', err);
                });
              }
              if (port2?.isOpen) {
                port2.close((err) => {
                  if (err) logger.warn('[autoConnectHand0205Double] port2 close error:', err);
                });
              }

              try {
                port1 = new SerialPort(
                  {
                    path: leftPath,
                    baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    if (err) logger.warn(err, "err");
                  }
                );
                port1.pipe(getSitParser());

                port2 = new SerialPort(
                  {
                    path: rightPath,
                    baudRate,
                    autoOpen: true,
                  },
                  function (err) {
                    if (err) logger.warn(err, "err");
                  }
                );
                bindBackPortParser();

                const jsonData = JSON.stringify({
                  port: serialport,
                  autoConnectHand0205Double: {
                    success: true,
                    portname: leftPath,
                    portnameBack: rightPath,
                    message: `触觉手套2 已连接：${leftPath} / ${rightPath}`,
                  },
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              } catch (err) {
                logger.warn('[autoConnectHand0205Double] open failed', err);
                const jsonData = JSON.stringify({
                  port: serialport,
                  autoConnectHand0205Double: {
                    success: false,
                    message: err?.message || '触觉手套2 自动连接失败',
                  },
                });
                server.clients.forEach(function each(client) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(jsonData);
                  }
                });
              }
            }).catch((err) => {
              logger.error('[SerialList] autoConnectHand0205Double failed', err);
              const jsonData = JSON.stringify({
                autoConnectHand0205Double: {
                  success: false,
                  message: err?.message || '触觉手套2 自动连接失败',
                },
              });
              server.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(jsonData);
                }
              });
            });
          }

          // 閸樺棗褰?
          if (getMessage.indexArr != null) {

            historyArr = getMessage.indexArr;
            const historySeries = getHistorySeries({
              sitRows: localData,
              backRows: localDataBack,
              start: getMessage.indexArr[0],
              end: getMessage.indexArr[1],
              file,
            });
            const press = historySeries.press;
            const area = historySeries.area;

            server.clients.forEach(function each(client) {
              /**
               * 妫ｆ牗顐肩拠璇插絿娑撴彃褰涢敍灞界殺閺佺増宓侀梹鍨閸滃奔瑕嗛崣锝囶伂閸欙絾鏆?
               *  */
              const jsonData = JSON.stringify({
                pressArr: press,
                areaArr: area,
                // length: csvSitData.length,
                // sitData: csvSitData[0], backData: csvBackData[0]
              });
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });

            indexArr = getMessage.indexArr;
            // localData
            // localDataBack
          }
        }
      });
    })
  }
}

SerialPort.list().then((ports) => {
  serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');
  logSerialPortList('startup', serialport);
}).catch((err) => {
  logger.error('[SerialList] startup failed', err);
});
let pointArr, newData, firstBlueData = [], lastBlueData = [], firstBlueData1 = [], lastBlueData1 = [];
let index = 0
const HAND_GLOVE_FULL_PACKET_LAYOUT = {
  left: {
    fingerRows: [
      [65, 66, 67, 38, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79],
      [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63],
      [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],
      [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    ],
    fingerTips: [2, 5, 8, 11, 14],
    palm: [
      129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
      145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159,
      161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175,
      177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191,
      193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207,
      209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223,
    ],
    palmLeadingBlankCount: 3,
    palmTopRows: [
      [244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255],
      [228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239],
    ],
  },
  right: {
    fingerRows: [
      [190, 191, 192, 187, 188, 189, 184, 185, 186, 181, 182, 183, 178, 179, 180],
      [206, 207, 208, 203, 204, 205, 200, 201, 202, 197, 198, 199, 194, 195, 196],
      [222, 223, 224, 219, 220, 221, 216, 217, 218, 213, 214, 215, 210, 211, 212],
      [238, 239, 240, 235, 236, 237, 232, 233, 234, 229, 230, 231, 226, 227, 228],
    ],
    fingerTips: [255, 252, 249, 246, 243],
    palm: [
      114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128,
      98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
      82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96,
      66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
      50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
      34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    ],
    palmTrailingBlankCount: 3,
    palmTopRows: [
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
    ],
  },
};

function readHandGlovePoint(pressureData, oneBasedIndex) {
  return pressureData[oneBasedIndex - 1] || 0;
}

function mapHandGloveFullPacketPressure(pressureData, side) {
  const layout = HAND_GLOVE_FULL_PACKET_LAYOUT[side] || HAND_GLOVE_FULL_PACKET_LAYOUT.left;
  const res = new Array(15 * 13).fill(0);

  layout.fingerRows.forEach((row, rowIndex) => {
    row.forEach((oneBasedIndex, colIndex) => {
      res[rowIndex * 15 + colIndex] = readHandGlovePoint(pressureData, oneBasedIndex);
    });
  });

  layout.fingerTips.forEach((oneBasedIndex, fingerIndex) => {
    res[15 * 4 + 1 + fingerIndex * 3] = readHandGlovePoint(pressureData, oneBasedIndex);
  });

  layout.palmTopRows.forEach((row, rowIndex) => {
    const startIndex = 75 + rowIndex * 15 + (layout.palmLeadingBlankCount || 0);
    row.forEach((oneBasedIndex, colIndex) => {
      res[startIndex + colIndex] = readHandGlovePoint(pressureData, oneBasedIndex);
    });
  });

  layout.palm.forEach((oneBasedIndex, index) => {
    res[75 + 2 * 15 + index] = readHandGlovePoint(pressureData, oneBasedIndex);
  });

  return res;
}

function mapHandGloveFullPacketModelMatrix(mappedData) {
  const sourceData = [...mappedData];
  while (sourceData.length < 195) {
    sourceData.push(0);
  }

  for (let i = 4 * 15; i < 5 * 15; i++) {
    sourceData[i] = sourceData[i] / 3;
  }

  const legacyData = [];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 15; j++) {
      legacyData.push(sourceData[i * 15 + 14 - j]);
    }
  }

  for (let i = 75 + 12 - 1; i >= 75; i--) {
    legacyData.push(sourceData[i]);
  }

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 15; j++) {
      legacyData.push(sourceData[75 + 12 + i * 15 + 14 - j]);
    }
  }

  const handPointArr = [[6, 2], [6, 3], [6, 4], [3, 8], [3, 9], [3, 10], [3, 14], [3, 15], [3, 16], [3, 20], [3, 21], [3, 22], [10, 26], [10, 27], [10, 28], [7, 2], [7, 3], [7, 4], [4, 8], [4, 9], [4, 10], [4, 14], [4, 15], [4, 16], [4, 20], [4, 21], [4, 22], [11, 26], [11, 27], [11, 28], [8, 2], [8, 3], [8, 4], [5, 8], [5, 9], [5, 10], [5, 14], [5, 15], [5, 16], [5, 20], [5, 21], [5, 22], [12, 26], [12, 27], [12, 28], [9, 2], [9, 3], [9, 4], [6, 8], [6, 9], [6, 10], [6, 14], [6, 15], [6, 16], [6, 20], [6, 21], [6, 22], [13, 26], [13, 27], [13, 28], [13, 2], [13, 3], [13, 4], [13, 8], [13, 9], [13, 10], [13, 14], [13, 15], [13, 16], [13, 20], [13, 21], [13, 22], [17, 25], [17, 26], [17, 27], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20]];
  const modelData = new Array(32 * 32).fill(0);
  handPointArr.forEach((point, index) => {
    const [row, col] = point;
    modelData[(31 - row) * 32 + col] = legacyData[index] || 0;
    if (index >= 75) {
      modelData[(31 - (row + 1)) * 32 + col] = legacyData[index] || 0;
    }
  });

  return modelData;
}

function getHandGloveFullPacketSide(packetType, fallbackSide) {
  if (packetType === 1) {
    return 'right';
  }
  if (packetType === 2) {
    return 'left';
  }
  return fallbackSide;
}

function parseHandGloveFullPacket(buffer, fallbackSide) {
  const bytes = Array.from(buffer);
  const pressureData = bytes.slice(2, 258);
  const imuBytes = bytes.slice(258, 274);
  const packetType = bytes[1];
  const side = fallbackSide === 'right' ? 'right' : 'left';
  const mappedData = mapHandGloveFullPacketPressure(pressureData, side);

  return {
    frameIndex: bytes[0],
    packetType,
    side,
    pressureData,
    imuBytes,
    mappedData,
  };
}

function handleHandGloveFullPacket(buffer, fallbackSide) {
  const packet = parseHandGloveFullPacket(buffer, fallbackSide);
  const realArr = [...packet.pressureData];
  let newArr = [...packet.mappedData];
  const outputSide = fallbackSide === 'right' ? 'right' : 'left';

  if (outputSide === 'right') {
    pointArr2 = [...packet.pressureData];
    pointArr2zeroData = [...pointArr2];
    pointArr2RawZeroData = [...pointArr2];
    newArr147_2 = [...newArr];

    if (pointArr2zero.length) {
      pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]));
    }

    if (pointArr147zero_2.length) {
      newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]));
    }

    const renderData = mapHandGloveFullPacketModelMatrix(newArr);

    colOrSendData1(JSON.stringify({
      backData: renderData,
      realArr,
      rawPressureData: pointArr2,
      newArr147: newArr,
      mappedArr195: newArr,
      frameIndex: packet.frameIndex,
      packetType: packet.packetType,
      handSide: packet.side,
      outputSide,
      sitFlag: port1?.isOpen,
      backFlag: port2?.isOpen,
    }));
    return;
  }

  pointArr = [...packet.pressureData];
  pointArr1zeroData = [...pointArr];
  pointArr1RawZeroData = [...pointArr];
  newArr147 = [...newArr];

  if (pointArr1zero.length) {
    pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]));
  }

  if (pointArr147zero.length) {
    newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]));
  }

  const renderData = mapHandGloveFullPacketModelMatrix(newArr);

  colOrSendData(JSON.stringify({
    sitData: renderData,
    realArr,
    rawPressureData: pointArr,
    newArr147: newArr,
    mappedArr195: newArr,
    frameIndex: packet.frameIndex,
    packetType: packet.packetType,
    handSide: packet.side,
    outputSide,
    sitFlag: port1?.isOpen,
    backFlag: port2?.isOpen,
  }));
}

const HAND_GLOVE_DOUBLE_PACKET_SIDE = {
  1: 'left',
  2: 'right',
};
const handGloveDoublePacketChunks = {
  left: [],
  right: [],
};

function getHandGloveDoublePacketSide(packetType, fallbackSide) {
  if (file !== HAND_GLOVE_DOUBLE) return fallbackSide;
  return HAND_GLOVE_DOUBLE_PACKET_SIDE[Number(packetType)] || fallbackSide;
}

function routeHandGloveDoubleFrame({ pressureData, imuBytes = [], outputSide = 'left', sourcePort = 'sit' }) {
  const realPressureData = normalizeFiniteFrame(pressureData, 256);
  const rotate = bytes4ToInt10(imuBytes);
  const isRight = outputSide === 'right';

  if (isRight) {
    pointArr2 = [...realPressureData];
    pointArr2RawZeroData = [...realPressureData];
    const rawPressureData = pointArr2RawZero.length
      ? realPressureData.map((value, index) => numLessZeroToZero(value - (pointArr2RawZero[index] || 0)))
      : [...realPressureData];
    let mappedData = handR([...realPressureData]);
    pointArr2 = handRVideo1470506([...realPressureData]);
    newArr147_2 = [...mappedData];
    pointArr2zeroData = [...pointArr2];

    if (pointArr2zero.length) {
      pointArr2 = pointArr2.map((value, index) => numLessZeroToZero(value - (pointArr2zero[index] || 0)));
    }
    if (pointArr147zero_2.length) {
      mappedData = mappedData.map((value, index) => numLessZeroToZero(value - (pointArr147zero_2[index] || 0)));
    }

    const payload = {
      backData: pointArr2,
      realArr: realPressureData,
      rawPressureData,
      newArr147: mappedData,
      handSide: 'right',
      packetSourcePort: sourcePort,
      sitFlag: port1?.isOpen,
      backFlag: port2?.isOpen,
    };
    if (rotate.length && !rotate.every((value) => value == 0)) {
      payload.rotate = rotate;
    }
    colOrSendData1(JSON.stringify(payload));
    return;
  }

  pointArr = [...realPressureData];
  pointArr1RawZeroData = [...realPressureData];
  const rawPressureData = pointArr1RawZero.length
    ? realPressureData.map((value, index) => numLessZeroToZero(value - (pointArr1RawZero[index] || 0)))
    : [...realPressureData];
  let mappedData = handL([...realPressureData]);
  newArr147 = [...mappedData];
  pointArr1zeroData = [...pointArr];

  if (pointArr1zero.length) {
    pointArr = pointArr.map((value, index) => numLessZeroToZero(value - (pointArr1zero[index] || 0)));
  }
  if (pointArr147zero.length) {
    mappedData = mappedData.map((value, index) => numLessZeroToZero(value - (pointArr147zero[index] || 0)));
  }

  const payload = {
    sitData: pointArr,
    realArr: realPressureData,
    rawPressureData,
    newArr147: mappedData,
    handSide: 'left',
    packetSourcePort: sourcePort,
    sitFlag: port1?.isOpen,
    backFlag: port2?.isOpen,
  };
  if (rotate.length && !rotate.every((value) => value == 0)) {
    payload.rotate = rotate;
  }
  colOrSendData(JSON.stringify(payload));
}

function handleHandGloveDoubleFirstPacket(buffer, fallbackSide, sourcePort) {
  if (file !== HAND_GLOVE_DOUBLE || buffer.length !== 130) return false;
  const bytes = Array.from(buffer);
  const side = getHandGloveDoublePacketSide(bytes[1], fallbackSide);
  handGloveDoublePacketChunks[side] = bytes.slice(2);
  return true;
}

function handleHandGloveDoubleSecondPacket(buffer, fallbackSide, sourcePort) {
  if (file !== HAND_GLOVE_DOUBLE || buffer.length !== 146) return false;
  const bytes = Array.from(buffer);
  const side = getHandGloveDoublePacketSide(bytes[1], fallbackSide);
  const firstChunk = handGloveDoublePacketChunks[side] || [];
  const rest = bytes.slice(2);
  const imuBytes = rest.slice(rest.length - 16);
  const secondChunk = rest.slice(0, rest.length - 16);
  const pressureData = [...firstChunk, ...secondChunk];
  handGloveDoublePacketChunks[side] = [];
  routeHandGloveDoubleFrame({
    pressureData,
    imuBytes,
    outputSide: side,
    sourcePort,
  });
  return true;
}

parser.on("data", function (data) {
  pointArr = new Array();
  let buffer = Buffer.from(data);
  newData = new Array();
  // console.log(buffer.length)
  if (licenseManager.isLicenseValid()) {
    if (file === HAND_GLOVE_FULL_PACKET && buffer.length === HAND_GLOVE_FULL_PACKET_LENGTH) {
      handleHandGloveFullPacket(buffer, 'left');
      return;
    }

    if (buffer.length === 1024) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }

      let newArr, realArr

      if (file === "car10") {
        pointArr = car10Sit(pointArr);
      }
      else if (file === "car" || file === "foot") {
        pointArr = carSitLine(pointArr);
      }
      else if (file === "sit10") {
        pointArr = sit10Line(pointArr);
      }
      else if (isSmallBedMatrixType(file)) {
        // newArr = smallBed([...pointArr]);
        // realArr = smallBed([...pointArr]);
        pointArr = jqbed(pointArr)
        // newArr = [...pointArr]
        // realArr = [...pointArr]
      } else if (file === "smallBed1") {
        // newArr = smallBed1([...pointArr]);
        // realArr = smallBed1([...pointArr]);
        // newArr = [...pointArr]
        // realArr = [...pointArr]
        pointArr = smallBed1(pointArr)
      }
      else if (file === 'smallM') {
        pointArr = smallM1(pointArr)
      } else if (file === 'rect') {
        pointArr = rect(pointArr)
      } else if (file === 'short') {
        pointArr = short(pointArr)
      } else if (file === 'hand') {
        // pointArr = handLine(pointArr)
        // 625
        pointArr = jqbed(pointArr)
        newData = [...pointArr]
      } else if (file === HAND_SINGLE_POINT_TYPE) {
        pointArr = handSinglePoint(pointArr)
        newData = [...pointArr]
      } else if (file === MINZHEN_TYPE) {
        pointArr = jqbed(pointArr)
        maskMinzhenMatrixValues(pointArr)
        newData = [...pointArr]
      } else if (isPetCareSystem(file)) {
        pointArr = jqbed(pointArr)
        newData = [...pointArr]
        // pointArr = press6sit(pointArr, 32, 32, 'col')
        // pointArr = zeroLine(pointArr)
      } else if (file === 'sit') {
        // pointArr = handLine(pointArr)
        // 625
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j],]
          }
        }
        newData = [...pointArr]
        pointArr = press6sit(pointArr, 32, 32, 'col')
        // pointArr = zeroLine(pointArr)
      } else if (file === 'matCol') {
        pointArr = matColLine(pointArr)
      } else if (file === 'sitCol') {
        // pointArr = handLine(pointArr)
        pointArr = handBlue(pointArr)
      } else if (file === 'yanfeng10') {
        pointArr = yanfeng10sit(pointArr)
      } else if (file === 'handBlue') {
        pointArr = handBlue(pointArr)
      } else if (file === 'volvo') {
        pointArr = wowSitLine(pointArr)
      } else if (file === WHOLE_CHAIR_TYPE) {
        pointArr = normalizeWholeChairFrame('sit', pointArr)
      } else if (file === 'xiyueReal1') {
        pointArr = xiyueReal1(pointArr)
      } else if (file === 'jqbed') {
        pointArr = jqbed(pointArr)
      } else if (file === 'tempFullBed') {
        const tempFullBedFrame = tempFullBed(pointArr)
        pointArr = tempFullBedFrame.sitData
        newData = tempFullBedFrame
      } else if (file === 'carCol') {
        pointArr = carCol(pointArr)
      } else if (file === 'newHand') {
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j]]
          }
        }
        pointArr = newHand(pointArr)
      } else if (file == 'gloves') {
        pointArr = gloves(pointArr)
      } else if (file == 'gloves1') {
        pointArr = gloves1(pointArr)
      } else if (file == 'gloves2') {
        pointArr = gloves2(pointArr)
      } else if (file == 'sit100') {
        pointArr = pressNew1220({ arr: pointArr, width: 32, height: 32, type: 'col', value: 4096 / 6 })
        pointArr = sit100Line(pointArr)
      } else if (file == 'fast1024sit') {
        pointArr = endiSit1024(pointArr)
      } else if (file == 'fast1024') {
        // pointArr = jqbed(pointArr)
        // console.log('fast1024')
        // console.log(Math.max(...pointArr))
        // pointArr = pressNew1220({ arr: pointArr, height: 32, width: 32, type: 'col', value: 1024 })
        // pointArr = gaussBlur_return(pointArr , 32,32, 0.5)
      } else if (file == 'normalFast') {
        pointArr = pressNew12203131({ arr: pointArr, height: 32, width: 32, type: 'col', value: 1024 })
        // console.log('pressNew12203131')
        // 32*32高速测试，与 fast1024 逻辑一致，不做任何线序变换
      } else if (file == 'sofa') {
        pointArr = arrToRealLine(pointArr, [[7, 0], [8, 15]], [[0, 15]], 32)
       } else if (file == 'carY') {
        pointArr = carYLine(pointArr)
      } else if (file == 'humanBody') {
        // 人体全身：直接透传 1024 字节原始数据，不做线序变换
      }
      pointArr1zeroData = [...pointArr]


      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      // jqbed 璋冭瘯妯″紡锛歶seMatrixOrigin=true 鏃剁敤绠楁硶杩斿洖鐨?matrix_origin 浣滀负 sitData
      const sitDataToSend = (useMatrixOrigin && file === 'jqbed' && jqbedMatrixOrigin) ? jqbedMatrixOrigin : pointArr;

      let jsonData;

      if (file === 'tempFullBed') {
        jsonData = JSON.stringify({
          sitData: pointArr,
          rawSitData: newData.rawSitData,
          matrixWidth: newData.matrixWidth,
          matrixHeight: newData.matrixHeight,
          matrixOrientation: newData.matrixOrientation,
          realArr: newData.realArr,
          pressureThreshold: newData.pressureThreshold,
          temperatureRawData: newData.temperatureRawData,
          temperatureData: newData.temperatureData,
          temperatureAvg: newData.temperatureAvg,
          temperatureK: newData.temperatureK,
          hz: colHZ,
        });
      } else if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: sitDataToSend,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({
          sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? pointArr : sitDataToSend,
          hz: colHZ,
        });
      }


      // console.log(JSON.stringify(pointArr))
      // if (flag) {
      //   const resDataArr = {
      //     data: JSON.stringify(pointArr),

      //     time: new Date().getTime(),
      //   };

      //   // 1.0
      //   // csvWriter.writeRecords([resDataArr]);

      //   // 2.0
      //   // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
      //   const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
      //   const date = saveTime;
      //   const insertQuery =
      //     "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

      //   console.log(db,)

      //   db.run(
      //     insertQuery,
      //     // [file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify(pointArr), timestamp, date],
      //     [JSON.stringify(pointArr), timestamp, date],
      //     function (err) {
      //       if (err) {
      //         logger.error(err);
      //         return;
      //       }
      //       console.log(`Event inserted with ID ${this.lastID}`);
      //     }
      //   );
      // }

      // if (!localFlag) {
      //   let jsonData;

      //   if (isCar(file)) {
      //     jsonData = JSON.stringify({
      //       sitData: pointArr,
      //       newData: (newData),
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   } else {
      //     // jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? newArr : pointArr, newData: (newData), });

      //     jsonData = JSON.stringify({ sitData: pointArr, newData: (newData), });
      //   }

      //   server.clients.forEach(function each(client) {
      //     if (client.readyState === WebSocket.OPEN) {
      //       client.send(jsonData);
      //     }
      //   });
      // }
      colOrSendData(jsonData)

    }

    if (buffer.length == 72 || buffer.length == 144) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }

      pointArr1zeroData = [...pointArr]


      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      let jsonData;

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }
      colOrSendData(jsonData)
    }

    if (buffer.length == 144) {

    }

    if (buffer.length == 262) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      const length = pointArr.length
      const rotate = pointArr.splice(length - 6, length)
      // console.log(pointArr.length , rotate)
      pointArr = gloves0123Res(pointArr)
      pointArr = gloves0123(pointArr)
      const jsonData = JSON.stringify({
        sitData: pointArr,
        rotate: rotate,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      });
      server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(jsonData);
        }
      });
    }

    if (buffer.length == 130) {
      if (handleHandGloveDoubleFirstPacket(buffer, 'left', 'sit')) {
        return;
      }

      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]
      let newArr

      firstArr = firstArr.splice(2, length)

      // if (order == 1) {
      firstBlueData = [...firstArr]
      // } else {
      //   lastBlueData = [...firstArr]

      //   pointArr = [...firstBlueData, ...lastBlueData]
      //   const realArr = [...pointArr]
      //   // pointArr = footVideo(pointArr)
      //   newArr = handVideoRealPoint_0506_3([...pointArr])
      //   console.log('handVideo147(pointArr)')
      //   // newArr = handVideoRealPoint([...pointArr])
      //   // newArr = handVideo1470506([...pointArr])
      //   // newArr = handVideoRealPoint_0416_3([...newArr])
      //   // newArr = [...pointArr]
      //   if (file == 'handVideo1') {
      //     pointArr = handVideo1_0416_0506(pointArr)
      //   } else {
      //     pointArr = handVideo1470506(pointArr)
      //   }


      //   // realArr = handVideoRealPoint_0506_3([...pointArr])
      //   if (pointArr1zero.length) {
      //     pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      //   }

      //   let jsonData
      //   if (rotate.every((a) => a == 0)) {
      //     jsonData = JSON.stringify({
      //       rotate: rotate,
      //       sitData: pointArr,
      //       realArr,
      //       newArr147: newArr,
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   } else {
      //     jsonData = JSON.stringify({
      //       rotate: rotate,
      //       sitData: pointArr,
      //       realArr,
      //       newArr147: newArr,
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   }
      //   // const jsonData = JSON.stringify({
      //   //   rotate: rotate,
      //   //   sitData: pointArr,
      //   //   realArr,
      //   //   newArr147: newArr,
      //   //   sitFlag: port1?.isOpen,
      //   //   backFlag: port2?.isOpen,
      //   // });
      //   // server.clients.forEach(function each(client) {
      //   //   if (client.readyState === WebSocket.OPEN) {
      //   //     client.send(jsonData);
      //   //   }
      //   // });


      //   colOrSendData(jsonData, [])
      // }



    }

    if (buffer.length == 146) {
      if (handleHandGloveDoubleSecondPacket(buffer, 'left', 'sit')) {
        return;
      }

      // console.log(file)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // dataItem.next = pointArr
      lastBlueData = [...pointArr]

      pointArr = [...firstBlueData, ...lastBlueData]
      const realArr = [...pointArr]
      pointArr1RawZeroData = [...realArr]
      const rawPressureData = pointArr1RawZero.length
        ? realArr.map((a, index) => numLessZeroToZero(a - (pointArr1RawZero[index] || 0)))
        : [...realArr]
      let newArr = []


      // newArr = handVideoRealPoint([...pointArr])
      // newArr = handVideo1470506([...pointArr])
      // newArr = handVideoRealPoint_0416_3([...newArr])
      // newArr = [...pointArr]
      if (file == 'handVideo1') {
        newArr = handVideoRealPoint_0506_3([...pointArr])
        pointArr = handVideo1_0416_0506(pointArr)
      } else if (file == 'footVideo') {
        // pointArr = new Array(256).fill(50)
        newArr = footL(pointArr)
        pointArr = footVideo(pointArr)

      } else if (file.includes('robot')) {

        // pointArr = press6(pointArr, 16, 16, 'col', 116, 1)
        newArr = [...pointArr]
        // pointArr = robot0401(pointArr)



        // if (pointArr1zero.length) {
        //   pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        // }
      } else if (file == 'smallSample') {
        // 鐏忓繐鐎烽弽宄版惂 - 閹稿绱堕幇鐔锋珤缂傛牕褰?-100妞ゅ搫绨潏鎾冲毉10鑴?0閻晠妯€
        // Excel閺?6鑴?6缂冩垶鐗搁敍灞筋嚠鎼?56鐎涙濡弫鐗堝祦閻ㄥ嫰銆庢惔?
        // 娴肩姵鍔呴崳銊х椽閸欑ó閸︹€cel娑擃厾娈戞担宥囩枂(row,col) -> 256鐎涙濡槐銏犵穿 = row*16+col
        // 娴肩姵鍔呴崳?-100鐎电懓绨查惃?56鐎涙濡槐銏犵穿:
        const sensorToByteIndex = [
          223, 222, 221, 220, 219, 218, 217, 216, 215, 214,  // 娴肩姵鍔呴崳?-10   (鐞?3, 閸?5閳?6)
          239, 238, 237, 236, 235, 234, 233, 232, 231, 230,  // 娴肩姵鍔呴崳?1-20  (鐞?4, 閸?5閳?6)
          255, 254, 253, 252, 251, 250, 249, 248, 247, 246,  // 娴肩姵鍔呴崳?1-30  (鐞?5, 閸?5閳?6)
          15, 14, 13, 12, 11, 10, 9, 8, 7, 6,                // 娴肩姵鍔呴崳?1-40  (鐞?,  閸?5閳?6)
          31, 30, 29, 28, 27, 26, 25, 24, 23, 22,            // 娴肩姵鍔呴崳?1-50  (鐞?,  閸?5閳?6)
          207, 206, 205, 204, 203, 202, 201, 200, 199, 198,  // 娴肩姵鍔呴崳?1-60  (鐞?2, 閸?5閳?6)
          191, 190, 189, 188, 187, 186, 185, 184, 183, 182,  // 娴肩姵鍔呴崳?1-70  (鐞?1, 閸?5閳?6)
          175, 174, 173, 172, 171, 170, 169, 168, 167, 166,  // 娴肩姵鍔呴崳?1-80  (鐞?0, 閸?5閳?6)
          159, 158, 157, 156, 155, 154, 153, 152, 151, 150,  // 娴肩姵鍔呴崳?1-90  (鐞?,  閸?5閳?6)
          143, 142, 141, 140, 139, 138, 137, 136, 135, 134,  // 娴肩姵鍔呴崳?1-100 (鐞?,  閸?5閳?6)
        ]
        const mappedArr = []
        for (let i = 0; i < 100; i++) {
          mappedArr.push(pointArr[sensorToByteIndex[i]] || 0)
        }
        pointArr = mappedArr
        newArr = [...mappedArr]
      } else if (file == 'hand0507' || isHandGloveType(file) || file == 'Num3D') {
        // left
        // newArr = handVideoRealPoint_0506_3([...pointArr])
        newArr = handL([...pointArr])

        // pointArr = handVideo1470506(pointArr)

        // 
      } else if (file == 'eye') {
        function leftEye(wsPointData) {

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 16; j++) {
              [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j],]
            }
          }

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 16; j++) {
              [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j],]
            }
          }

          const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0]
          const newArr = []
          for (let j = 0; j < 16; j++) {
            for (let i = 0; i < arr.length; i++) {

              newArr.push(wsPointData[j * 16 + arr[i]])
            }
          }
          return newArr



        }
        newArr = leftEye([...pointArr])
        pointArr = [...newArr]
      }
      newArr147 = [...newArr]
      pointArr1zeroData = [...pointArr]
      // newArr = handVideoRealPoint([...pointArr])

      // pointArr = handVideo147(pointArr)




      // stamp = new Date().getTime()
      const rotate = bytes4ToInt10(arr)



      // pointArr = footVideo(pointArr)
      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      if (pointArr147zero.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]))
      }

      let jsonDataObj = {
        sitData: pointArr,
        realArr,
        rawPressureData,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      // console.log(JSON.stringify([pointArr[1] , pointArr[2] , pointArr[3]]))

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj);
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }

      // const jsonData = JSON.stringify({
      //   rotate: rotate,
      //   sitData: pointArr,
      //   realArr,
      //   newArr147: newArr,
      //   sitFlag: port1?.isOpen,
      //   backFlag: port2?.isOpen,
      // });
      // server.clients.forEach(function each(client) {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      // console.log(jsonDataObj.sitData , jsonData)
      colOrSendData(jsonData, [])
    }

    if (buffer.length == 142) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]
      let newArr

      firstArr = firstArr.splice(2, length)

      firstBlueData = [...firstArr]


    }

    if (buffer.length == 158) {

      // console.log(file)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // dataItem.next = pointArr
      lastBlueData = [...pointArr]

      pointArr = [...firstBlueData, ...lastBlueData]

      // for(let i = 0 ; i < 280 ; i++){
      //   pointArr[i] = i
      // }

      const realArr = [...pointArr]
      let newArr = []


      if (file == 'daliegu') {
        newArr = [...pointArr]

      }

      // if (file == 'handVideo1') {
      //   newArr = handVideoRealPoint_0506_3([...pointArr])
      //   pointArr = handVideo1_0416_0506(pointArr)
      // } else if (file == 'footVideo') {
      //   // pointArr = new Array(256).fill(50)
      //   newArr = footL(pointArr)
      //   pointArr = footVideo(pointArr)

      // } else if (file.includes('robot')) {

      //   // pointArr = press6(pointArr, 16, 16, 'col', 116, 1)
      //   newArr = [...pointArr]
      //   // pointArr = robot0401(pointArr)



      //   // if (pointArr1zero.length) {
      //   //   pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      //   // }
      // } else if (file == 'hand0507' || file == 'hand0205' || file == 'handGlove115200' || file == 'Num3D') {
      //   // left
      //   // newArr = handVideoRealPoint_0506_3([...pointArr])
      //   newArr = handL([...pointArr])

      //   // pointArr = handVideo1470506(pointArr)

      //   // 
      // } else if (file == 'eye') {
      //   function leftEye(wsPointData) {

      //     for (let i = 0; i < 4; i++) {
      //       for (let j = 0; j < 16; j++) {
      //         [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j],]
      //       }
      //     }

      //     for (let i = 0; i < 4; i++) {
      //       for (let j = 0; j < 16; j++) {
      //         [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j],]
      //       }
      //     }

      //     const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0]
      //     const newArr = []
      //     for (let j = 0; j < 16; j++) {
      //       for (let i = 0; i < arr.length; i++) {

      //         newArr.push(wsPointData[j * 16 + arr[i]])
      //       }
      //     }
      //     return newArr



      //   }
      //   newArr = leftEye([...pointArr])
      //   pointArr = [...newArr]
      // }
      newArr147 = [...newArr]
      pointArr1zeroData = [...pointArr]
      // newArr = handVideoRealPoint([...pointArr])

      // pointArr = handVideo147(pointArr)




      // stamp = new Date().getTime()
      const rotate = bytes4ToInt10(arr)



      // pointArr = footVideo(pointArr)
      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      if (pointArr147zero.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]))
      }

      let jsonDataObj = {
        sitData: pointArr,
        realArr,
        rawPressureData: pointArr,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      // console.log(JSON.stringify([pointArr[1] , pointArr[2] , pointArr[3]]))

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj);
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }

      // const jsonData = JSON.stringify({
      //   rotate: rotate,
      //   sitData: pointArr,
      //   realArr,
      //   newArr147: newArr,
      //   sitFlag: port1?.isOpen,
      //   backFlag: port2?.isOpen,
      // });
      // server.clients.forEach(function each(client) {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      // console.log(jsonDataObj.sitData , jsonData)
      colOrSendData(jsonData, [])
    }







    // console.log(buffer.length)
    if (buffer.length == 256) {


      // console.log(file , baudRate)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }



      // const index = Math.floor(Math.random() * 4096)
      // let arr = new Array(4096).fill(0)
      // // for (let i = 0; i < 4096; i++) {
      // //   arr[i] = i
      // // }
      // if (index < 4096) {
      //   index++
      // } else {
      //   index = 0
      // }
      // arr[index] = 100
      let jsonData;
      // pointArr = arr

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }

      colOrSendData(jsonData)
    }

    if (file.includes('bed4096') && buffer.length == 4096) {
      if (buffer.length != 4096) {
        console.log('bufferLength : ', baudRate, buffer.length)
      }

      // console.log(file , baudRate)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }



      // const index = Math.floor(Math.random() * 4096)
      // let arr = new Array(4096).fill(0)
      // // for (let i = 0; i < 4096; i++) {
      // //   arr[i] = i
      // // }
      // if (index < 4096) {
      //   index++
      // } else {
      //   index = 0
      // }
      // arr[index] = 100
      let jsonData;
      // pointArr = arr

      // for (let i = 0; i < 16; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     [pointArr[(33 + i) * 64 + j], pointArr[(33 + 30 - i) * 64 + j]] = [pointArr[(33 + 30 - i) * 64 + j], pointArr[(33 + i) * 64 + j],]
      //   }
      // }

      // for (let i = 0; i < 64; i++) {
      //   for (let j = 0; j < 16; j++) {
      //     [pointArr[(i) * 64 + j], pointArr[(31 - i) * 64 + j]] = [pointArr[(31 - i) * 64 + j], pointArr[(i) * 64 + j],]
      //   }
      // }

      // const newArr = new Array(64).fill(0)
      // for (let i = 2; i <= 32; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     newArr.push(pointArr[i * 64 + j])
      //   }
      // }

      // for (let j = 0; j < 64; j++) {
      //   newArr.push(pointArr[0 * 64 + j])
      // }

      // for (let i = 33; i < 64; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     newArr.push(pointArr[i * 64 + j])
      //   }
      // }

      pointArr = zeroLineMatrix(pointArr, 64)

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }

      // console.log(jsonData)

      colOrSendData(jsonData)

    }

    if (buffer.length == 1) {
      console.log(buffer.readUInt8(i))
      if (buffer.readUInt8(i) == 3) {
        server.clients.forEach(function each(client) {
          const jsonData = JSON.stringify({
            handReset: true,
          });
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }
    }

    // 
  }
});

parserSmallBed12B.on("data", function (data) {
  if (!licenseManager.isLicenseValid() || file !== SMALL_BED_12B_TYPE) return;

  const frame = smallBed12B.buildRealtimeFrameFromBuffer(Buffer.from(data), {
    lineOrder: jqbed,
    zeroFrame: pointArr1zero,
    subtractZero: numLessZeroToZero,
    calibration: smallBed12BCalibration,
    displayOptions: smallBed12BDisplayOptions,
    hz: colHZ,
    transposeSquareMatrix,
  });
  if (!frame) return;

  pointArr1zeroData = [...frame.orderedFrame];
  pointArr = frame.pressureData;
  newData = [...frame.pressureData];
  colOrSendData(JSON.stringify(frame.realtimeFrame));
});

function colOrSendData(jsonData) {
  // console.log(JSON.stringify(JSON.parse(jsonData).sitData) , 'jsonData')
  let frameToStore = null;
  if (file === MINZHEN_TYPE) {
    try {
      frameToStore = JSON.parse(jsonData);
      if (Array.isArray(frameToStore.sitData)) {
        frameToStore.sitData = applyMinzhenBackendGauss(frameToStore.sitData);
        jsonData = JSON.stringify(frameToStore);
      }
    } catch (error) {
      frameToStore = null;
    }
  }
  if (flag && shouldStoreCollectionFrame('sit') && hasEnoughCollectionDiskSpace()) {
    const resDataArr = {
      data: JSON.stringify(pointArr),
      time: new Date().getTime(),
    };

    // 1.0
    // csvWriter.writeRecords([resDataArr]);

    // 2.0
    // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
    const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    // 1.0 閺堝搫娅掓禍杞扮閸?
    // db.run(
    //   insertQuery,
    //   [(file.includes('hand0205') || file == 'handGlove115200') ? JSON.stringify([...pointArr, ...rotate]) : file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify(pointArr), timestamp, date],
    //   function (err) {
    //     if (err) {
    //       logger.error(err);
    //       return;
    //     }
    //     console.log(`Event inserted with ID ${this.lastID}`);
    //   }
    // );

    frameToStore = frameToStore || JSON.parse(jsonData);
    const dataToStore = file === TEMP_FULL_BED_TYPE
      ? JSON.stringify({
        sitData: frameToStore.sitData,
        rawSitData: frameToStore.rawSitData,
        matrixWidth: frameToStore.matrixWidth,
        matrixHeight: frameToStore.matrixHeight,
        matrixOrientation: frameToStore.matrixOrientation,
        realArr: frameToStore.realArr,
        pressureThreshold: frameToStore.pressureThreshold,
        temperatureRawData: frameToStore.temperatureRawData,
        temperatureData: frameToStore.temperatureData,
        temperatureAvg: frameToStore.temperatureAvg,
        temperatureK: frameToStore.temperatureK,
      })
      : isZeroFrameStorageType(file)
        ? buildZeroAwareStorageData(frameToStore, 'sitData', 'sit')
        : file === SMALL_BED_12B_TYPE
          ? buildSmallBed12BCollectionStorageData(frameToStore)
          : isSmallBedMatrixType(file)
          ? JSON.stringify(getFrameMatrixData(frameToStore, 'sitData'))
          : JSON.stringify([...frameToStore.sitData]);

    db.run(
      insertQuery,
      [dataToStore, timestamp, date],
      function (err) {
        handleCollectionDbError(err, 'sit');
      }
    );
  }

  if (!localFlag && shouldSendRealtimeFrame('sit')) {

    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonData);
      }
    });
  }
}

// 婢跺嫮鎮婃稉鎻掑經閺佺増宓?

var pointArr2;
parser2.on("data", function (data) {
  pointArr2 = new Array();
  let buffer = Buffer.from(data);
  if (licenseManager.isLicenseValid()) {
    if (file === MINZHEN_TYPE) {
      const minzhenSensorFrame = parseMinzhenSensorFrame(buffer);
      if (minzhenSensorFrame) {
        colOrSendData1(JSON.stringify(minzhenSensorFrame));
        return;
      }
    }

    if (file === HAND_GLOVE_FULL_PACKET && buffer.length === HAND_GLOVE_FULL_PACKET_LENGTH) {
      handleHandGloveFullPacket(buffer, 'right');
      return;
    }

    if (buffer.length === 1024) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr2[i] = buffer.readUInt8(i);
      }

      if (file === "car10") {
        pointArr2 = car10Back(pointArr2);
      } else if (file === 'yanfeng10') {
        pointArr2 = yanfeng10back(pointArr2);
      } else if (file === 'volvo') {
        pointArr2 = wowBackLine(pointArr2)
      } else if (file == 'carQX') {
      } else if (file === WHOLE_CHAIR_TYPE) {
        pointArr2 = normalizeWholeChairFrame('back', pointArr2)
      } else if (file === HAND_SINGLE_POINT_TYPE) {
        pointArr2 = handSinglePoint(pointArr2)
      } else if (file == 'sofa') {
        pointArr2 = arrToRealLine(pointArr2, [[7, 0], [8, 15]], [[0, 15]], 32)
      } else if (file == 'carY') {
        pointArr2 = carYLine(pointArr2)
      } else {
        pointArr2 = carBackLine(pointArr2);
      }

      pointArr2zeroData = [...pointArr2]

      if (pointArr2zero.length) {
        pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]))
      }

      // pointArr2 = carBackLine(pointArr2);
      if (flag && shouldStoreCollectionFrame('back')) {
        const resDataArr = {
          data: JSON.stringify(pointArr2),
          time: new Date().getTime(),
        };
        // csvWriterback.writeRecords([resDataArr]);

        const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
        const date = saveTime;
        const insertQuery =
          "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

        db1.run(
          insertQuery,
          [JSON.stringify(pointArr2), timestamp, date],
          function (err) {
            if (err) {
              logger.error(err);
              return;
            }
            console.log(`Event inserted with ID ${this.lastID}`);
          }
        );
      }

      if (!localFlag) {
        let jsonData = JSON.stringify({ backData: pointArr2 });
        if (isCar(file)) {
          jsonData = JSON.stringify({
            backData: pointArr2,
            sitFlag: port1?.isOpen,
            backFlag: port2?.isOpen,
          });
        } else {
          jsonData = JSON.stringify({ backData: pointArr2 });
        }

        server.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }


    }

    if (buffer.length == 130) {
      if (handleHandGloveDoubleFirstPacket(buffer, 'right', 'back')) {
        return;
      }

      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]

      firstArr = firstArr.splice(2, length)

      if (order == 1) {
        firstBlueData1 = [...firstArr]
       } else {
        lastBlueData1 = [...firstArr]
        pointArr = [...firstBlueData1, ...lastBlueData1]
        const realArr1 = [...pointArr]
        pointArr2RawZeroData = [...realArr1]
        const rawPressureData1 = pointArr2RawZero.length
          ? realArr1.map((a, index) => numLessZeroToZero(a - (pointArr2RawZero[index] || 0)))
          : [...realArr1]
        let newArr1 = []
        if (file == 'hand0507' || isHandGloveType(file)) {
          newArr1 = handR(pointArr)
          pointArr = handRVideo1470506(pointArr)
        } else {
          pointArr = footVideo1(pointArr)
        }
        if (pointArr1zero.length) {
          pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        }
        const arr = [...pointArr]
        const jsonDataObj1 = {
          backData: arr,
          realArr: realArr1,
          rawPressureData: rawPressureData1,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        }
        if (newArr1.length) {
          jsonDataObj1.newArr147 = newArr1
        }
        const jsonData = JSON.stringify(jsonDataObj1);
        // server.clients.forEach(function each(client) {
        //   if (client.readyState === WebSocket.OPEN) {
        //     client.send(jsonData);
        //   }
        // });

        colOrSendData1(jsonData, [])
      }
    }
    if (buffer.length == 146) {
      if (handleHandGloveDoubleSecondPacket(buffer, 'right', 'back')) {
        return;
      }

      let pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // pointArr = [...arr]
      // dataItem.next = pointArr
      lastBlueData1 = [...pointArr]
      let newArr = []

      pointArr2 = [...firstBlueData1, ...lastBlueData1]

      const realArr = [...pointArr2]
      pointArr2RawZeroData = [...realArr]
      const rawPressureData = pointArr2RawZero.length
        ? realArr.map((a, index) => numLessZeroToZero(a - (pointArr2RawZero[index] || 0)))
        : [...realArr]

      if (file == 'footVideo') {
        // pointArr2 = new Array(256).fill(50)
        newArr = footR(pointArr2)
        pointArr2 = footVideo1(pointArr2)

      } else if (file == 'hand0507' || isHandGloveType(file)) {
        newArr = handR(pointArr2)

        pointArr2 = handRVideo1470506(pointArr2)

      } else if (file == 'eye') {
        function rightEye(wsPointData) {
          const newArr = []
          let lastArr = wsPointData.splice(128, 128)
          wsPointData = lastArr.concat(wsPointData)
          const arr = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse()

          for (let j = 0; j < 16; j++) {
            for (let i = 0; i < arr.length; i++) {

              newArr.push(wsPointData[j * 16 + arr[i]])
            }
          }
          return newArr
        }
        newArr = rightEye([...pointArr2])
        pointArr2 = [...newArr]

      }

      newArr147_2 = [...newArr]
      pointArr2zeroData = [...pointArr2]
      // console.log(pointArr2zero)
      if (pointArr2zero.length) {
        pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]))
      }

      if (pointArr147zero_2.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]))
      }
      // arr = [...pointArr]
      const rotate = bytes4ToInt10(arr)


      let jsonDataObj = {
        backData: pointArr2,
        realArr,
        rawPressureData,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj)
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     backData: pointArr2,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     backData: pointArr2,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }
      // server.clients.forEach(function each(client) {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      colOrSendData1(jsonData, [])

    }

    if (buffer.length == 1) {
      console.log(buffer.readUInt8(i))
      if (buffer.readUInt8(i) == 3) {
        server.clients.forEach(function each(client) {
          const jsonData = JSON.stringify({
            handReset: true,
          });
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }
    }
  }
});

function colOrSendData1(jsonData) {
  if (flag && shouldStoreCollectionFrame('back') && hasEnoughCollectionDiskSpace()) {
    const resDataArr = {
      data: JSON.stringify(pointArr),
      time: new Date().getTime(),
    };

    // 1.0
    // csvWriter.writeRecords([resDataArr]);

    // 2.0
    // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
    const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

    const frameToStore = JSON.parse(jsonData);
    const dataToStore = frameToStore.tempObj
      ? JSON.stringify(frameToStore.tempObj)
      : isZeroFrameStorageType(file)
        ? buildZeroAwareStorageData(frameToStore, 'backData', 'back')
        : isSmallBedMatrixType(file)
          ? JSON.stringify(getFrameMatrixData(frameToStore, 'backData'))
          : JSON.stringify([...frameToStore.backData]);

    db1.run(
      insertQuery,
      [dataToStore, timestamp, date],
      function (err) {
        handleCollectionDbError(err, 'back');
      }
    );
  }

  if (!localFlag && shouldSendRealtimeFrame('back')) {

    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonData);
      }
    });
  }
}

var pointArr3;
parser3.on("data", function (data) {
  if (file == "bigBed") {
    pointArr3 = new Array();
    let buffer = Buffer.from(data);

    let res = [];
    if (licenseManager.isLicenseValid()) {
      if (buffer.length === 1025) {
        for (var i = 0; i < buffer.length; i++) {
          pointArr3[i] = buffer.readUInt8(i);
        }

        if (pointArr3[pointArr3.length - 1] == 0) {
          firstData = [...pointArr3];
          firstData.pop();
          // 閸欏疇绔熺痪鍨碍

        }
        if (pointArr3[pointArr3.length - 1] == 1) {
          lastData = [...pointArr3];
          lastData.pop();
          // 濞ｈ濮?
          let a = [];
          for (let i = 0; i < 32; i++) {
            for (let j = 0; j < 32; j++) {
              a.push(firstData[i * 32 + j]);
            }
            for (let j = 0; j < 32; j++) {
              a.push(lastData[i * 32 + j]);
            }
          }
          res = a;
          if (!localFlag) {
            let jsonData = JSON.stringify({ sitData: res });
            server.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(jsonData);
              }
            });
          }

          if (flag && shouldStoreCollectionFrame('sit') && hasEnoughCollectionDiskSpace()) {
            const resDataArr = {
              data: JSON.stringify(res),
              time: new Date().getTime(),
            };
            dataFalg++;
            // 1.0
            // csvWriter.writeRecords([resDataArr]);xai
            // 2.0
            // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
            if (dataFalg % 10 == 0) {
              const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
              const date = saveTime;
              const insertQuery =
                "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";
              db.run(
                insertQuery,
                [JSON.stringify(res), timestamp, date],
                function (err) {
                  handleCollectionDbError(err, 'sit');
                }
              );
            }
            if (dataFalg >= 10) {
              dataFalg = 0;
            }
          }
        }
      }




    }
  }
});

var pointArr4;

parser4.on("data", function (data) {
  pointArr4 = new Array();
  let buffer = Buffer.from(data);
  if (licenseManager.isLicenseValid()) {
    if (buffer.length === 1024) {

      for (var i = 0; i < buffer.length; i++) {
        pointArr4[i] = buffer.readUInt8(i);
      }
      if (file == 'volvo') {
        pointArr4 = wowhead(pointArr4);
      } else if (file === WHOLE_CHAIR_TYPE) {
        pointArr4 = normalizeWholeChairFrame('head', pointArr4);
      }


      pointArr4zeroData = [...pointArr4]

      if (pointArr4zero.length) {
        pointArr4 = pointArr4.map((a, index) => numLessZeroToZero(a - pointArr4zero[index]))
      }

      if (flag && shouldStoreCollectionFrame('head') && hasEnoughCollectionDiskSpace()) {
        const resDataArr = {
          data: JSON.stringify(pointArr4),
          time: new Date().getTime(),
        };
        // csvWriterback.writeRecords([resDataArr]);

        const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
        const date = saveTime;
        const insertQuery =
          "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

        db2.run(
          insertQuery,
          [JSON.stringify(pointArr4), timestamp, date],
          function (err) {
            handleCollectionDbError(err, 'head');
          }
        );
      }

      if (!localFlag) {
        let jsonData = JSON.stringify({ headData: pointArr4 });
        if (isCar(file)) {
          jsonData = JSON.stringify({
            headData: pointArr4,
            sitFlag: port1?.isOpen,
            backFlag: port2?.isOpen,
          });
        } else {
          jsonData = JSON.stringify({ headData: pointArr4 });
        }

        server.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }


    }


    if (buffer.length == 130) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]

      firstArr = firstArr.splice(2, length)

      if (order == 1) {
        firstBlueData2 = [...firstArr]
      } else {
        lastBlueData2 = [...firstArr]
        pointArr = [...firstBlueData2, ...lastBlueData2]
        pointArr = footVideo1(pointArr)

        if (pointArr1zero.length) {
          pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        }
        const arr = [...pointArr]
        const jsonData = JSON.stringify({
          backData: arr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        });
        // server.clients.forEach(function each(client) {
        //   if (client.readyState === WebSocket.OPEN) {
        //     client.send(jsonData);
        //   }
        // });

        colOrSendData1(jsonData, [])
      }



    }

    if (buffer.length == 146) {
      let pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // pointArr = [...arr]
      // dataItem.next = pointArr
      lastBlueData2 = [...pointArr]
      let newArr = []

      pointArr4 = [...firstBlueData2, ...lastBlueData2]

      const realArr = [...pointArr4]

      if (file == 'footVideo') {
        newArr = footR(pointArr4)
        pointArr4 = footVideo1(pointArr4)

      } else if (file == 'hand0507' || isHandGloveType(file)) {
        newArr = handR(pointArr4)

        pointArr4 = handRVideo1470506(pointArr4)

      }

      newArr147_2 = [...newArr]

      pointArr4zeroData = [...pointArr4]

      if (pointArr4zero.length) {
        pointArr4 = pointArr4.map((a, index) => numLessZeroToZero(a - pointArr4zero[index]))
      }

      if (pointArr147zero_2.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]))
      }
      // arr = [...pointArr]
      const rotate = bytes4ToInt10(arr)


      let jsonDataObj = {
        headData: pointArr4,
        realArr,
        rawPressureData: pointArr4,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj)

      colOrSendData2(jsonData, [])

    }

  }
});


function colOrSendData2(jsonData) {
  if (flag && shouldStoreCollectionFrame('head') && hasEnoughCollectionDiskSpace()) {
    const resDataArr = {
      data: JSON.stringify(pointArr),
      time: new Date().getTime(),
    };

    // 1.0
    // csvWriter.writeRecords([resDataArr]);

    // 2.0
    // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
    const timestamp = Date.now(); // 閼惧嘲褰囪ぐ鎾冲閺冨爼妫块惃鍕闂傚瓨鍩?
    const date = saveTime;
    const insertQuery =
      "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";


    const frameToStore = JSON.parse(jsonData);
    db2.run(
      insertQuery,
      [isZeroFrameStorageType(file) ? buildZeroAwareStorageData(frameToStore, 'headData', 'head') : isSmallBedMatrixType(file) ? JSON.stringify(getFrameMatrixData(frameToStore, 'headData')) : JSON.stringify([...frameToStore.backData]), timestamp, date],
      function (err) {
        handleCollectionDbError(err, 'head');
      }
    );
  }

  if (!localFlag) {

    server.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonData);
      }
    });
  }
}

// 闁插秷绻?
reconnectTimer = setInterval(() => {
  if (com && !port1.isOpen && sitClose == false) {
    // if()
    console.log(com)
    if (file != "bigBed") {
      try {
        port1 = new SerialPort(
          {
            path: com,
            baudRate: baudRate,
            autoOpen: true,
          },
          function (err) {
            logger.warn(err, "err");
          }
        );
        //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
        port1.pipe(getSitParser());
      } catch (e) {
        logger.warn(e, "e");
      }
    } else {
      try {
        port1 = new SerialPort(
          // com,
          {
            path: com,
            baudRate: baudRate,
            autoOpen: true,
          },
          function (err) {
            logger.warn(err, "err");
          }
        );
        //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
        port1.pipe(parser3);
      } catch (e) {
        logger.warn(e, "e");
      }
    }

  }

  if (com1 && !port2.isOpen && backClose == false) {
    try {
      port2 = new SerialPort(
        // com1,
        {
          path: com1,
          baudRate: baudRate,
          autoOpen: true,
        },
        function (err) {
          logger.warn(err, "err");
        }
      );
      //缁狅繝浜惧ǎ璇插鐟欙絾鐎介崳?
      bindBackPortParser();
    } catch (e) {
      logger.warn(e, "e");
    }
  }

  if (comSensor && (!portSensor || !portSensor.isOpen) && sensorClose == false) {
    openMinzhenSensorPort(comSensor);
  }
}, 3000);

// jqbed 鏁版嵁缈昏浆鍙樻崲锛堜緵 callPy 浣跨敤锛?
function jqbedOppo(arr) {
  let wsPointData = [...arr];
  let b = wsPointData.splice(0, 17 * 32);
  wsPointData = wsPointData.concat(b);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 32; j++) {
      [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
        wsPointData[(14 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }
  return wsPointData;
}

function normalizePetCareResult(data, systemKey) {
  const runtime = petCareSystems[systemKey].runtime;
  const postureState = Number(data?.posture_state);
  const inBed = postureState >= 1 && postureState <= 3 ? 1 : 0;

  if (runtime.stateArr.length < 2) {
    runtime.stateArr.push(inBed);
  } else {
    runtime.stateArr.shift();
    runtime.stateArr.push(inBed);
  }

  if (runtime.stateArr.length === 2 && runtime.stateArr.every((value) => value === inBed)) {
    if (runtime.stableState !== inBed) {
      runtime.stableState = inBed;
      runtime.stateStartedAt = Date.now();
    }
  } else if (runtime.stableState == null) {
    runtime.stableState = inBed;
    runtime.stateStartedAt = Date.now();
  }

  const startedAt = runtime.stateStartedAt || Date.now();
  const petInBed = runtime.stableState ?? inBed;
  const breathRate = Number(data?.breath_rate);
  let heartRate = 0;

  if (petInBed === 1 && Number.isFinite(breathRate) && breathRate > 0) {
    const simulator = runtime.heartRateSimulator;
    const effectiveBreathRate = normalizePetHeartRateBreathRate(breathRate);
    simulator.breathRateQueue.push(effectiveBreathRate);
    if (simulator.breathRateQueue.length > 2) {
      simulator.breathRateQueue.shift();
    }
    const shouldRecompute =
      simulator.breathRateQueue.length === 2 &&
      simulator.breathRateQueue[0] !== simulator.breathRateQueue[1];

    if (!simulator.lastHeartRate) {
      heartRate = nextPetHeartRate(Number(effectiveBreathRate), simulator);
      simulator.lastHeartRate = heartRate;
    } else if (shouldRecompute) {
      heartRate = nextPetHeartRate(Number(effectiveBreathRate), simulator);
      simulator.lastHeartRate = heartRate;
    } else {
      heartRate = simulator.lastHeartRate;
    }
  } else {
    resetPetCareHeartRateSimulatorState(runtime.heartRateSimulator);
  }

  return {
    ...data,
    heart_rate: heartRate,
    petInBed,
    onBedTime: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  };
}

function normalizeVitalSignsHeartRate(data, systemKey) {
  if (!VITAL_SIGNS_SYSTEM_TYPES.has(systemKey)) {
    return data;
  }

  const currentHeartRate = Number(data?.heart_rate);
  if (Number.isFinite(currentHeartRate) && currentHeartRate > 0) {
    return {
      ...data,
      heart_rate: currentHeartRate,
    };
  }

  const simulator = vitalSignsHeartRateSimulator[systemKey];
  const stateInBed = Number(data?.stateInBbed);
  const breathRate = Number(data?.rate);

  if (!simulator || stateInBed !== 1 || !Number.isFinite(breathRate) || breathRate <= 0 || breathRate === 88) {
    if (simulator) {
      resetVitalSignsHeartRateSimulatorState(simulator);
    }
    return {
      ...data,
      heart_rate: 0,
    };
  }

  const now = Date.now();
  if (simulator.lastHeartRateAt && now - simulator.lastHeartRateAt < PET_CARE_HEART_RATE_UPDATE_INTERVAL_MS) {
    return {
      ...data,
      heart_rate: simulator.lastHeartRate,
    };
  }

  const heartRate = nextPetHeartRate(breathRate, simulator);
  simulator.lastHeartRate = heartRate;
  simulator.lastHeartRateAt = now;

  return {
    ...data,
    heart_rate: heartRate,
  };
}

function logPetCareResult(result, systemKey) {
  if (systemKey === 'petCareMini') {
    return;
  }

  const runtime = petCareSystems[systemKey].runtime;
  const now = Date.now();
  if (now - runtime.lastLoggedAt < 1000) {
    return;
  }

  runtime.lastLoggedAt = now;
  const postureState = Number(result?.posture_state);
  const postureLabel =
    postureState === 0 ? 'Empty'
      : postureState === 1 ? 'Paws'
        : postureState === 2 ? 'Torso'
          : postureState === 3 ? 'Motion'
            : 'Unknown';

  logger.info(`[${systemKey}] algorithm result`, {
    breath_rate: result?.breath_rate,
    effective_breath_rate: postureState === 2 ? result?.breath_rate : null,
    posture_state: postureState,
    posture_label: postureLabel,
    is_motion: result?.is_motion,
    snr_db: result?.snr_db,
    quality: result?.quality,
    bed_exit_flag: result?.bed_exit_flag,
    pressure_coefficient: result?.pressure_coefficient,
    petInBed: result?.petInBed,
    onBedTime: result?.onBedTime,
  });
}

// jqbed 鍋ュ悍鐩戞祴绠楁硶瀹氭椂璋冪敤锛?25ms锛?
jqbedTimer = setInterval(async () => {
  if (pointArr&&pointArr.length  && pointArr.every((a) => typeof a == 'number') && ['jqbed', 'smallBed'].includes(file) && port1 && port1.isOpen) {
    const newArr = jqbedOppo(pointArr);
    // console.log(newArr.reduce((a,b) => a+b , 0),pointArr.length,'nweArr')
    try {
      const rawData = await callPy('getData', { data: newArr });
      if (rawData && rawData.rate != -1) {
        const data = normalizeVitalSignsHeartRate(rawData, file);
        // console.log('[jqbed] pyResult:', data,data.matrix_origin.reduce((a,b) => a+b , 0));

        // 缂撳瓨绠楁硶杩斿洖鐨?matrix_origin锛堜緵 useMatrixOrigin flag 浣跨敤锛?
        if (data.matrix_origin && Array.isArray(data.matrix_origin)) {
          jqbedMatrixOrigin = data.matrix_origin;
        }

        if (onbedArr.length < 2) {
          onbedArr.push(data.stateInBbed);
        } else {
          onbedArr.shift();
          onbedArr.push(data.stateInBbed);
        }

        if (onbedArr.every((a) => a == 1)) {
          onBedTime += 2;
          data.onBedTime = onBedTime;
        } else if (onbedArr.every((a) => a == 0)) {
          onBedTime += 2;
          data.onBedTime = onBedTime;
        } else {
          onBedTime = 0;
          data.onBedTime = 0;
        }

        const jsonData = JSON.stringify({ rate: data });
        server.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
          }
        });
      }
    } catch (e) {
      console.error('[jqbed] callPy error:', e.message);
    }
  }
}, 125);

function startPetCareTimer(systemKey) {
  const system = petCareSystems[systemKey];

  return setInterval(async () => {
    if (system.runtime.processing) {
      return;
    }

    if (!(pointArr && pointArr.length && pointArr.every((a) => typeof a == 'number') && file == systemKey && port1 && port1.isOpen)) {
      return;
    }

    system.runtime.processing = true;

    try {
      if (system.runtime.resetPending) {
        await callPy(system.rpcReset, {});
        system.runtime.resetPending = false;
      }

      const data = await callPy(system.rpcStep, { data: [...pointArr] }, { timeoutMs: 30000 });
      const result = normalizePetCareResult(data, systemKey);
      logPetCareResult(result, systemKey);
      const jsonData = JSON.stringify({ [system.eventKey]: result });

      server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(jsonData);
        }
      });
    } catch (e) {
      console.error(`[${system.eventKey}] callPy error:`, e.message);
    } finally {
      system.runtime.processing = false;
    }
  }, 20);
}

petCareTimer = startPetCareTimer('petCare');
petCareMiniTimer = startPetCareTimer('petCareMini');

module.exports.shutdownServer = shutdownServer;

// ============================================================
// Express HTTP 服务 (端口 19245) - OneStep 足压报告接口
// ============================================================
let pdfArrData = [];

function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  let safe = name.trim();
  safe = safe.replace(/[\\/]/g, '');
  safe = safe.replace(/[\x00-\x1F<>:"|?*]/g, '');
  safe = safe.replace(/[.\s]+$/g, '');
  return safe;
}

function fixMojibake(value) {
  if (typeof value !== 'string') return value;
  try {
    const buf = Buffer.from(value, 'latin1');
    const utf = buf.toString('utf8');
    if (Buffer.from(utf, 'utf8').equals(buf)) return utf;
  } catch {}
  return value;
}

function decodeMaybeUri(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch { break; }
  }
  return result;
}

function decodeField(value) {
  return decodeMaybeUri(fixMojibake(value));
}

const httpApp = express();
httpApp.use(cors());
httpApp.use(express.json({ limit: '50mb' }));
httpApp.use(express.urlencoded({ limit: '50mb', extended: true }));

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imgPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const tempName = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
    cb(null, tempName);
  },
});
const upload = multer({ storage: multerStorage });
const PY_HEATMAP_TIMEOUT_MS = 60000;
const PY_REPORT_TIMEOUT_MS = 120000;

httpApp.post('/getDbHeatmap', async (req, res) => {
  try {
    const { time } = req.body;
    const selectQuery = 'select * from matrix WHERE date=?';
    const params = [time];
    db.all(selectQuery, params, async (err, rows) => {
      if (err) {
        logger.error('[getDbHeatmap] db error:', err);
        return res.json(new HttpResult(1, {}, 'db error'));
      }
      if (!rows || rows.length === 0) {
        return res.json(new HttpResult(1, {}, 'no data'));
      }
      const foot = rows.map(r => JSON.parse(r.data));
      pdfArrData = foot;
      try {
        await warmFootAnalysis();
        const peak_frame = await callPy('get_peak_frame', { sensor_data: foot }, {
          timeoutMs: PY_HEATMAP_TIMEOUT_MS,
        });
        return res.json(new HttpResult(0, peak_frame, 'success'));
      } catch (e) {
        logger.error('[getDbHeatmap] callPy error:', e.message);
        return res.json(new HttpResult(1, {}, 'callPy error'));
      }
    });
  } catch (e) {
    logger.error('[getDbHeatmap] error:', e.message);
    res.json(new HttpResult(1, {}, 'error'));
  }
});

httpApp.post('/uploadCanvas', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json(new HttpResult(1, {}, 'missing file'));
    }
    if (typeof req.body.filename === 'string') req.body.filename = decodeField(req.body.filename);
    if (typeof req.body.collectName === 'string') req.body.collectName = decodeField(req.body.collectName);
    if (typeof req.body.date === 'string') req.body.date = decodeField(req.body.date);
    if (typeof req.body.gender === 'string') req.body.gender = decodeField(req.body.gender);
    logger.info('[uploadCanvas]', { collectName: req.body.collectName, age: req.body.age, gender: req.body.gender });
    const requestedDate =
      (typeof req.body.date === 'string' && req.body.date.trim()) ||
      (typeof req.query.date === 'string' && req.query.date.trim()) ||
      '';
    const sanitizedRequested = sanitizeFilename(requestedDate);
    if (!sanitizedRequested) {
      fs.unlinkSync(req.file.path);
      return res.json(new HttpResult(1, {}, 'missing date'));
    }
    const finalName = `${sanitizedRequested}.png`;
    const newPath = path.join(imgPath, finalName);
    fs.renameSync(req.file.path, newPath);
    req.file.filename = finalName;
    req.file.path = newPath;
    const absolutePath = path.resolve(req.file.path);
    const name = `${pdfPath}/${sanitizedRequested}`;
    logger.info('[uploadCanvas] calling generate_foot_pressure_report1', name);
    await warmFootAnalysis();
    await callPy('generate_foot_pressure_report1', {
      sensor_data: pdfArrData,
      pdf_name: name,
      heatmap_png_path: `${imgPath}/${sanitizedRequested}.png`,
      user_name: req.body.collectName,
      user_age: req.body.age,
      user_gender: req.body.gender,
      user_id: req.body.userId || 9527,
    }, {
      timeoutMs: PY_REPORT_TIMEOUT_MS,
    });
    const pdfFilePath = `${name}.pdf`;
    res.json(new HttpResult(0, { file: req.file, body: req.body, absolutePath, pdfFilePath, pdfDir: pdfPath }, 'success'));
  } catch (e) {
    logger.error('[uploadCanvas] error:', e.message);
    res.json(new HttpResult(1, {}, 'upload failed'));
  }
});

const HTTP_PORT = 19245;
reportHttpServer = httpApp.listen(HTTP_PORT, '127.0.0.1', () => {
  logger.info(`[HTTP] OneStep report server listening on http://127.0.0.1:${HTTP_PORT}`);
});
