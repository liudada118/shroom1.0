const smallBed12B = require('./smallBed12B');
const minzhen = require('./minzhen');
const wholeChair = require('./wholeChair');
const handGloveFullPacket = require('./handGloveFullPacket');
const handGloveDouble = require('./handGloveDouble');

const SENSOR_CAPABILITIES = {
  REALTIME: 'realtime',
  PLAYBACK: 'playback',
  COLLECTION: 'collection',
  CSV: 'csv',
  ZERO_FRAME: 'zeroFrame',
  THREE_PORT: 'threePort',
  HAND_STORAGE: 'handStorage',
  SMALL_BED_MATRIX: 'smallBedMatrix',
};

const HAND_GLOVE_FULL_PACKET = 'handGloveFullPacket';
const HAND_GLOVE_DOUBLE = handGloveDouble.TYPE;
const HAND_GLOVE_TYPES = ['hand0205', HAND_GLOVE_DOUBLE, 'handGlove115200', HAND_GLOVE_FULL_PACKET];

const TEMP_FULL_BED_TYPE = 'tempFullBed';
const JQ_BED_TYPE = 'jqbed';
const SMALL_BED_TYPE = 'smallBed';
const SMALL_BED_NO_ALG_TYPE = 'smallBedNoAlg';
const SMALL_BED_12B_TYPE = smallBed12B.TYPE;
const HAND_SINGLE_POINT_TYPE = 'handSinglePoint';
const WHOLE_CHAIR_TYPE = 'wholeChair';
const MINZHEN_TYPE = minzhen.TYPE;
const THREE_PORT_SENSOR_TYPES = new Set(['volvo', WHOLE_CHAIR_TYPE]);

const MATRIX_32 = { width: 32, height: 32, total: 1024 };
const MATRIX_16 = { width: 16, height: 16, total: 256 };
const MATRIX_BIG_BED = { width: 64, height: 32, total: 2048 };
const MATRIX_TEMP_FULL_BED = { width: 15, height: 12, total: 180 };
const MATRIX_CAR_COL = { width: 10, height: 9, total: 90 };
const MATRIX_10X10 = { width: 10, height: 10, total: 100 };

const DEFAULT_CAPABILITIES = [
  SENSOR_CAPABILITIES.REALTIME,
  SENSOR_CAPABILITIES.PLAYBACK,
  SENSOR_CAPABILITIES.COLLECTION,
  SENSOR_CAPABILITIES.CSV,
];

const SENSOR_DEFINITIONS = {
  car10: { matrix: MATRIX_10X10, channels: ['sit', 'back'], capabilities: DEFAULT_CAPABILITIES },
  car: { matrix: MATRIX_32, channels: ['sit', 'back'], capabilities: DEFAULT_CAPABILITIES },
  yanfeng10: { matrix: MATRIX_10X10, channels: ['sit', 'back'], capabilities: DEFAULT_CAPABILITIES },
  volvo: { matrix: MATRIX_32, channels: ['sit', 'back', 'head'], capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.THREE_PORT] },
  carQX: { matrix: MATRIX_32, channels: ['sit', 'back'], capabilities: DEFAULT_CAPABILITIES },
  [WHOLE_CHAIR_TYPE]: { matrix: MATRIX_32, channels: ['sit', 'back', 'head'], capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.THREE_PORT] },
  sofa: { matrix: MATRIX_32, channels: ['sit', 'back'], capabilities: DEFAULT_CAPABILITIES },
  carY: { matrix: MATRIX_32, channels: ['sit', 'back'], capabilities: DEFAULT_CAPABILITIES },

  [MINZHEN_TYPE]: { matrix: MATRIX_32, channels: ['sit', 'sensor'], baudRate: minzhen.SENSOR_BAUD_RATE, capabilities: DEFAULT_CAPABILITIES },

  hand: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  [HAND_SINGLE_POINT_TYPE]: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  handL: { matrix: MATRIX_16, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  handR: { matrix: MATRIX_16, channels: ['back'], capabilities: DEFAULT_CAPABILITIES },
  hand0507: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 921600, capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.ZERO_FRAME] },
  hand0205: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 921600, capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.HAND_STORAGE, SENSOR_CAPABILITIES.ZERO_FRAME] },
  [HAND_GLOVE_DOUBLE]: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 921600, capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.HAND_STORAGE, SENSOR_CAPABILITIES.ZERO_FRAME], plugin: handGloveDouble },
  handGlove115200: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 115200, capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.HAND_STORAGE, SENSOR_CAPABILITIES.ZERO_FRAME] },
  [HAND_GLOVE_FULL_PACKET]: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 921600, capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.HAND_STORAGE, SENSOR_CAPABILITIES.ZERO_FRAME] },
  gloves: { matrix: MATRIX_16, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  gloves1: { matrix: MATRIX_16, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  gloves2: { matrix: MATRIX_16, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },

  foot: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  footL: { matrix: MATRIX_16, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  footR: { matrix: MATRIX_16, channels: ['back'], capabilities: DEFAULT_CAPABILITIES },
  footVideo: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 921600, capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.ZERO_FRAME] },

  [SMALL_BED_TYPE]: { matrix: MATRIX_32, channels: ['sit'], capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.SMALL_BED_MATRIX] },
  [SMALL_BED_NO_ALG_TYPE]: { matrix: MATRIX_32, channels: ['sit'], capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.SMALL_BED_MATRIX] },
  [SMALL_BED_12B_TYPE]: { matrix: MATRIX_32, channels: ['sit'], baudRate: 1500000, capabilities: DEFAULT_CAPABILITIES, plugin: smallBed12B },
  smallBed1: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  [TEMP_FULL_BED_TYPE]: { matrix: MATRIX_TEMP_FULL_BED, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  [JQ_BED_TYPE]: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  petCare: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  petCareMini: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  bigBed: { matrix: MATRIX_BIG_BED, channels: ['sit', 'head'], capabilities: DEFAULT_CAPABILITIES },

  sit: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  sit10: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  sit100: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  sitCol: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  matCol: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  matColPos: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  carCol: { matrix: MATRIX_CAR_COL, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },

  smallM: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  rect: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  short: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  matColLine: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  eye: { matrix: MATRIX_16, channels: ['sit', 'back'], baudRate: 921600, capabilities: DEFAULT_CAPABILITIES },
  daliegu: { matrix: MATRIX_32, channels: ['sit'], baudRate: 921600, capabilities: DEFAULT_CAPABILITIES },
  smallSample: { matrix: MATRIX_32, channels: ['sit'], baudRate: 921600, capabilities: DEFAULT_CAPABILITIES },
  humanBody: { matrix: MATRIX_32, channels: ['sit'], baudRate: 1000000, capabilities: DEFAULT_CAPABILITIES },
  xiyueReal1: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  handBlue: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  newHand: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  fast1024: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  fast1024sit: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  normalFast: { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES },
  bed4096: { matrix: { width: 64, height: 64, total: 4096 }, channels: ['sit'], baudRate: 3000000, capabilities: DEFAULT_CAPABILITIES },
  bed4096num: { matrix: { width: 64, height: 64, total: 4096 }, channels: ['sit'], baudRate: 3000000, capabilities: DEFAULT_CAPABILITIES },
};

function getSensorDefinition(sensorType = '') {
  const type = String(sensorType || '');
  if (SENSOR_DEFINITIONS[type]) return SENSOR_DEFINITIONS[type];
  if (type.includes('robot')) {
    return {
      matrix: MATRIX_16,
      channels: ['sit', 'back'],
      baudRate: 921600,
      capabilities: [...DEFAULT_CAPABILITIES, SENSOR_CAPABILITIES.HAND_STORAGE, SENSOR_CAPABILITIES.ZERO_FRAME],
    };
  }
  return { matrix: MATRIX_32, channels: ['sit'], capabilities: DEFAULT_CAPABILITIES };
}

function hasCapability(sensorType, capability) {
  return getSensorDefinition(sensorType).capabilities.includes(capability);
}

function isHandGloveType(sensorType) {
  return HAND_GLOVE_TYPES.includes(sensorType);
}

function isHandStorageType(sensorType = '') {
  return hasCapability(sensorType, SENSOR_CAPABILITIES.HAND_STORAGE) || String(sensorType).includes('robot');
}

function isZeroFrameStorageType(sensorType = '') {
  return hasCapability(sensorType, SENSOR_CAPABILITIES.ZERO_FRAME) || String(sensorType).includes('robot');
}

function isSmallBedMatrixType(sensorType) {
  return hasCapability(sensorType, SENSOR_CAPABILITIES.SMALL_BED_MATRIX);
}

function isThreePortFile(sensorType) {
  return hasCapability(sensorType, SENSOR_CAPABILITIES.THREE_PORT);
}

function getFrameMatrixData(frame, key) {
  return Array.isArray(frame?.[key]) ? frame[key] : [];
}

function getSensorBaudRate(sensorType) {
  return getSensorDefinition(sensorType).baudRate || 1000000;
}

function getSensorMatrix(sensorType) {
  return getSensorDefinition(sensorType).matrix;
}

function getSensorChannels(sensorType) {
  return getSensorDefinition(sensorType).channels;
}

module.exports = {
  HAND_GLOVE_FULL_PACKET,
  HAND_GLOVE_DOUBLE,
  HAND_GLOVE_TYPES,
  TEMP_FULL_BED_TYPE,
  JQ_BED_TYPE,
  SMALL_BED_TYPE,
  SMALL_BED_NO_ALG_TYPE,
  SMALL_BED_12B_TYPE,
  HAND_SINGLE_POINT_TYPE,
  WHOLE_CHAIR_TYPE,
  MINZHEN_TYPE,
  THREE_PORT_SENSOR_TYPES,
  SENSOR_CAPABILITIES,
  SENSOR_DEFINITIONS,
  getFrameMatrixData,
  getSensorBaudRate,
  getSensorChannels,
  getSensorDefinition,
  getSensorMatrix,
  hasCapability,
  isHandGloveType,
  isHandStorageType,
  isSmallBedMatrixType,
  isThreePortFile,
  isZeroFrameStorageType,
  minzhen,
  smallBed12B,
  wholeChair,
  handGloveFullPacket,
  handGloveDouble,
};
