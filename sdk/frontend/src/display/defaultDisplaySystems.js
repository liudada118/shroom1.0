import { DisplayRegistry } from './DisplayRegistry.js';

const COMMON_PRESSURE_CONTROLS = {
  serial: true,
  zero: true,
  capture: true,
  replay: true,
  download: true,
  color: true,
  filter: true,
};

export const DEFAULT_DISPLAY_SYSTEMS = [
  {
    key: 'hand0205',
    label: '触觉手套',
    channels: ['sit', 'back'],
    defaultMode: 'normal',
    modes: ['normal', 'num', 'num3D', 'numoriginal', 'skin'],
    renderers: {
      normal: 'Hand0205',
      num: 'Num2D',
      num3D: 'Num3D',
      numoriginal: 'Num2DOriginal',
      skin: 'HandSkin',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      calibrate: true,
    },
  },
  {
    key: 'handGlove115200',
    label: '触觉手套 115200',
    channels: ['sit', 'back'],
    defaultMode: 'normal',
    modes: ['normal', 'num', 'num3D', 'numoriginal', 'skin'],
    renderers: {
      normal: 'Hand0205',
      num: 'Num2D',
      num3D: 'Num3D',
      numoriginal: 'Num2DOriginal',
      skin: 'HandSkin',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      calibrate: true,
    },
  },
  {
    key: 'handGloveFullPacket',
    label: '整包触觉手套',
    channels: ['sit', 'back'],
    defaultMode: 'num',
    modes: ['num', 'numoriginal'],
    renderers: {
      num: 'Num2D',
      numoriginal: 'Num2DOriginal',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'hand',
    label: '手部检测',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'CanvasHand',
      numoriginal: 'Fast1024',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'handSinglePoint',
    label: '32*32(检测点)',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'CanvasHand',
      numoriginal: 'Fast1024',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'minzhen',
    label: '轮椅',
    channels: ['sit', 'sensor'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'Minzhen',
      numoriginal: 'Fast1024',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      animation: true,
      sensorPanel: true,
    },
  },
  {
    key: 'smallBed',
    label: '小床检测',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'SmallBed',
      numoriginal: 'Num2DOriginal',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'smallBedNoAlg',
    label: '小床检测(无算法)',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'SmallBed',
      numoriginal: 'Num2DOriginal',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'smallBed12B',
    label: '小床检测 12B',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'SmallBed',
      numoriginal: 'Fast1024',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'jqbed',
    label: '小床监测',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'SmallBed',
      numoriginal: 'Num2DOriginal',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      algorithm: true,
    },
  },
  {
    key: 'petCare',
    label: '宠物看护',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'SmallBed',
      numoriginal: 'Num2DOriginal',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      algorithm: true,
    },
  },
  {
    key: 'petCareMini',
    label: '宠物看护 Mini',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'SmallBed',
      numoriginal: 'Num2DOriginal',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      algorithm: true,
    },
  },
  {
    key: 'bed4096',
    label: '64*64',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'Canvas4096WebGL',
      numoriginal: 'Fast4096',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'bed4096num',
    label: '64*64数字',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal'],
    renderers: {
      normal: 'Fast4096',
      numoriginal: 'Fast4096',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'footVideo',
    label: '触觉足底',
    channels: ['sit', 'back'],
    defaultMode: 'num',
    modes: ['num', 'num3D', 'numoriginal', 'skin'],
    renderers: {
      num: 'Num2D',
      num3D: 'Num3D',
      numoriginal: 'Num2DOriginal',
      skin: 'FootVideo',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
  {
    key: 'wholeChair',
    label: '整椅',
    channels: ['sit', 'back', 'head'],
    defaultMode: 'normal',
    modes: ['normal'],
    renderers: {
      normal: 'WholeChair',
    },
    controls: {
      ...COMMON_PRESSURE_CONTROLS,
      headSerial: true,
      animation: true,
    },
  },
  {
    key: 'humanBody',
    label: '人体',
    channels: ['sit'],
    defaultMode: 'normal',
    modes: ['normal', 'numoriginal', 'skin'],
    renderers: {
      normal: 'HumanBodyCanvas',
      numoriginal: 'HumanBodyRawData',
      skin: 'HumanBodyCanvas',
    },
    controls: COMMON_PRESSURE_CONTROLS,
  },
];

export function createDefaultDisplayRegistry(extraSystems = []) {
  return new DisplayRegistry([
    ...DEFAULT_DISPLAY_SYSTEMS,
    ...extraSystems,
  ]);
}
