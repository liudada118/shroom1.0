export const DISPLAY_CAPABILITIES = {
  REALTIME: 'realtime',
  PLAYBACK: 'playback',
  COLLECTION: 'collection',
  RAW_2D: 'raw2d',
  THREE_D: '3d',
  CSV: 'csv',
  THREE_PORT: 'threePort',
};

const MATRIX_32 = { width: 32, height: 32, total: 1024 };
const MATRIX_16 = { width: 16, height: 16, total: 256 };
const MATRIX_BIG_BED = { width: 64, height: 32, total: 2048 };
const MATRIX_TEMP_FULL_BED = { width: 15, height: 12, total: 180 };
const MATRIX_CAR_COL = { width: 10, height: 9, total: 90 };
const MATRIX_10X10 = { width: 10, height: 10, total: 100 };
const MATRIX_64 = { width: 64, height: 64, total: 4096 };

const DEFAULT_CAPABILITIES = [
  DISPLAY_CAPABILITIES.REALTIME,
  DISPLAY_CAPABILITIES.PLAYBACK,
  DISPLAY_CAPABILITIES.COLLECTION,
  DISPLAY_CAPABILITIES.RAW_2D,
  DISPLAY_CAPABILITIES.CSV,
];

function defineDisplay(type, options = {}) {
  return {
    type,
    label: options.label || type,
    matrix: options.matrix || MATRIX_32,
    channels: options.channels || ['sit'],
    defaultMode: options.defaultMode || 'num',
    capabilities: options.capabilities || DEFAULT_CAPABILITIES,
    realtimeOptions: options.realtimeOptions,
  };
}

export const DISPLAY_REGISTRY = {
  car10: defineDisplay('car10', { matrix: MATRIX_10X10, channels: ['sit', 'back'] }),
  car: defineDisplay('car', { channels: ['sit', 'back'], defaultMode: 'normal' }),
  yanfeng10: defineDisplay('yanfeng10', { matrix: MATRIX_10X10, channels: ['sit', 'back'] }),
  volvo: defineDisplay('volvo', { channels: ['sit', 'back', 'head'], capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_PORT] }),
  carQX: defineDisplay('carQX', { channels: ['sit', 'back'] }),
  wholeChair: defineDisplay('wholeChair', { label: '整椅展示', channels: ['sit', 'back', 'head'], capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_PORT] }),
  sofa: defineDisplay('sofa', { channels: ['sit', 'back'] }),
  carY: defineDisplay('carY', { channels: ['sit', 'back'] }),
  minzhen: defineDisplay('minzhen', { label: '轮椅', channels: ['sit', 'sensor'] }),

  hand: defineDisplay('hand', { defaultMode: 'normal', capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_D] }),
  handSinglePoint: defineDisplay('handSinglePoint', { label: '手部检测(检测点)' }),
  handL: defineDisplay('handL', { matrix: MATRIX_16 }),
  handR: defineDisplay('handR', { matrix: MATRIX_16, channels: ['back'] }),
  hand0507: defineDisplay('hand0507', { matrix: MATRIX_16, channels: ['sit', 'back'], defaultMode: 'normal' }),
  hand0205: defineDisplay('hand0205', { label: '触觉手套', matrix: MATRIX_16, channels: ['sit', 'back'], defaultMode: 'normal', capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_D] }),
  hand0205Double: defineDisplay('hand0205Double', { label: '触觉手套2', matrix: MATRIX_16, channels: ['sit', 'back'], defaultMode: 'normal', capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_D] }),
  handGlove115200: defineDisplay('handGlove115200', { label: '触觉手套115200', matrix: MATRIX_16, channels: ['sit', 'back'], defaultMode: 'normal', capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_D] }),
  handGloveFullPacket: defineDisplay('handGloveFullPacket', { label: '触觉手套整包', matrix: MATRIX_16, channels: ['sit', 'back'], defaultMode: 'normal', capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_D] }),
  gloves: defineDisplay('gloves', { matrix: MATRIX_16 }),
  gloves1: defineDisplay('gloves1', { matrix: MATRIX_16 }),
  gloves2: defineDisplay('gloves2', { matrix: MATRIX_16 }),

  foot: defineDisplay('foot'),
  footL: defineDisplay('footL', { matrix: MATRIX_16 }),
  footR: defineDisplay('footR', { matrix: MATRIX_16, channels: ['back'] }),
  footVideo: defineDisplay('footVideo', { matrix: MATRIX_16, channels: ['sit', 'back'], defaultMode: 'normal' }),

  smallBed: defineDisplay('smallBed', { defaultMode: 'numoriginal' }),
  smallBedNoAlg: defineDisplay('smallBedNoAlg', { defaultMode: 'numoriginal' }),
  smallBed12B: defineDisplay('smallBed12B', {
    label: '小床检测(12B)',
    defaultMode: 'numoriginal',
    realtimeOptions: {
      matrixModes: ['32x32', '16x16'],
      defaultMatrixMode: '32x32',
      samplePoints: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
    },
  }),
  smallBed1: defineDisplay('smallBed1'),
  tempFullBed: defineDisplay('tempFullBed', { matrix: MATRIX_TEMP_FULL_BED }),
  jqbed: defineDisplay('jqbed'),
  petCare: defineDisplay('petCare'),
  petCareMini: defineDisplay('petCareMini'),
  bigBed: defineDisplay('bigBed', { matrix: MATRIX_BIG_BED, channels: ['sit', 'head'] }),

  sit: defineDisplay('sit'),
  sit10: defineDisplay('sit10'),
  sit100: defineDisplay('sit100'),
  sitCol: defineDisplay('sitCol'),
  matCol: defineDisplay('matCol'),
  matColPos: defineDisplay('matColPos'),
  carCol: defineDisplay('carCol', { matrix: MATRIX_CAR_COL }),

  smallM: defineDisplay('smallM'),
  rect: defineDisplay('rect'),
  short: defineDisplay('short'),
  matColLine: defineDisplay('matColLine'),
  eye: defineDisplay('eye', { matrix: MATRIX_16, channels: ['sit', 'back'] }),
  daliegu: defineDisplay('daliegu'),
  smallSample: defineDisplay('smallSample'),
  humanBody: defineDisplay('humanBody', { defaultMode: 'skin', capabilities: [...DEFAULT_CAPABILITIES, DISPLAY_CAPABILITIES.THREE_D] }),
  xiyueReal1: defineDisplay('xiyueReal1'),
  handBlue: defineDisplay('handBlue'),
  newHand: defineDisplay('newHand'),
  fast1024: defineDisplay('fast1024'),
  fast1024sit: defineDisplay('fast1024sit'),
  normalFast: defineDisplay('normalFast'),
  bed4096: defineDisplay('bed4096', { matrix: MATRIX_64 }),
  bed4096num: defineDisplay('bed4096num', { matrix: MATRIX_64 }),
};

const RUNTIME_DISPLAY_REGISTRY = new Map();

export function registerRuntimeDisplayDefinition(runtimeDefinition = {}) {
  const metadata = runtimeDefinition.displayMetadata || runtimeDefinition;
  const sensor = runtimeDefinition.sensorDefinition || {};
  const sensorType = sensor.type || metadata.sensorType;
  if (!sensorType) return null;

  const views = Array.isArray(metadata.views) ? metadata.views : [];
  const definition = defineDisplay(sensorType, {
    label: metadata.name || sensorType,
    matrix: metadata.matrix || sensor.matrix,
    channels: sensor.ports || ['sit'],
    defaultMode: metadata.defaultView || views[0]?.id || views[0]?.type || 'num',
  });
  definition.source = 'manifest';
  definition.displaySystemId = metadata.id || sensor.id;
  definition.protocol = metadata.protocol || sensor.protocol || null;
  definition.algorithmType = metadata.algorithmType || sensor.algorithm?.type || 'none';
  definition.page = {
    layout: metadata.layout,
    views,
    widgets: metadata.widgets || views,
    controls: metadata.controls || {},
    sidebar: metadata.sidebar || null,
    renderers: metadata.renderers || [],
    visualizationAlgorithms: metadata.visualizationAlgorithms || [],
    profiles: metadata.profiles || [],
    defaultProfile: metadata.defaultProfile || null,
  };
  RUNTIME_DISPLAY_REGISTRY.set(sensorType, definition);
  return definition;
}

export function listRuntimeDisplayDefinitions() {
  return [...RUNTIME_DISPLAY_REGISTRY.values()];
}

export function getDisplayDefinition(sensorType) {
  return RUNTIME_DISPLAY_REGISTRY.get(sensorType) || DISPLAY_REGISTRY[sensorType] || null;
}

export function getDisplayMatrix(sensorType, fallback = MATRIX_32) {
  return getDisplayDefinition(sensorType)?.matrix || fallback;
}

export function getDisplayChannels(sensorType, fallback = ['sit']) {
  return getDisplayDefinition(sensorType)?.channels || fallback;
}

export function getDefaultDisplayMode(sensorType, fallback = 'num') {
  return getDisplayDefinition(sensorType)?.defaultMode || fallback;
}

export function displaySupports(sensorType, capability) {
  return Boolean(getDisplayDefinition(sensorType)?.capabilities?.includes(capability));
}
