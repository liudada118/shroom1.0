import { NATIVE_SCENE_ASSETS } from '../../../displays/nativeSceneAssets';

/** 模型系统使用原生资源；矩阵、足底与热力系统由真实布局生成粒子。 */
export const SCENE_MODELS = [
  { key: 'shroom', label: '蘑菇', url: './model/shroom.glb', loader: 'gltf', color: '#7dd3fc', targetSize: 4.45, rotation: [-0.08, 0.2, 0] },
  { key: 'chair', label: '整椅', ...NATIVE_SCENE_ASSETS.wholeChair, color: '#d9f2ff', targetSize: 4.1 },
  { key: 'chairQX', label: 'chairQX', ...NATIVE_SCENE_ASSETS.carQX, color: '#d9f2ff', targetSize: 4.1 },
  { key: 'wheelchair', label: '轮椅', ...NATIVE_SCENE_ASSETS.minzhen, color: '#d9f2ff', targetSize: 4.1 },
  { key: 'robotSY', label: '松岩 N2', ...NATIVE_SCENE_ASSETS.robotSY, color: '#83d3ff', targetSize: 3.95 },
  { key: 'robotLCF', label: '零次方 H1', ...NATIVE_SCENE_ASSETS.robotLCF, color: '#83d3ff', targetSize: 3.95 },
  { key: 'humanBody', label: '人体全身优化', ...NATIVE_SCENE_ASSETS.humanBodyOptimized, color: '#a8e4ff', targetSize: 4.1 },
  { key: 'robot', label: '宇树 G1', ...NATIVE_SCENE_ASSETS.robot1, color: '#83d3ff', targetSize: 3.95 },
  { key: 'glove', label: '触觉手套', url: './model/hand1.glb', loader: 'gltf', color: '#a8e4ff', targetSize: 4.1, rotation: [Math.PI / 6, 0, -Math.PI] },
];

/** 直接使用参考项目的场景强调色；新增矩阵与手套沿用默认青色。 */
export function getPortalAccent(system) {
  const scene = getPortalScene(system);
  if (['smallBed', 'matrix64', 'heatmap64'].includes(scene)) return '#3df2a4';
  if (['chair', 'chairQX', 'wheelchair'].includes(scene)) return '#6f83ff';
  if (['robot', 'robotSY', 'robotLCF'].includes(scene)) return '#ff9f43';
  return '#63d5ff';
}

/** 按真实系统身份选择场景；未知与 Agent 系统显示通用矩阵，不猜测设备外形。 */
export function getPortalScene(system) {
  if (!system) return 'shroom';
  if (system.nativeSourceType) system = { ...system, value: system.nativeSourceType };
  if (system.source === 'manifest') return 'matrix';
  if (['hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket'].includes(system.value)) return 'glove';
  return {
    robot1: 'robot', robotSY: 'robotSY', robotLCF: 'robotLCF',
    wholeChair: 'chair', carQX: 'chairQX', minzhen: 'wheelchair', humanBodyOptimized: 'humanBody',
    footVideo: 'foot', bed4096num: 'matrix64', bed4096: 'heatmap64',
    jqbed: 'smallBed', smallBedNoAlg: 'smallBed', smallBed12B: 'matrix', matCol: 'matrix', tempFullBed: 'tempFullBed',
  }[system.value] || 'matrix';
}

/** 已接入原生粒子交接的页面直接从列表过渡，不再先放大预览后播放第二段动画。 */
export function supportsDirectSceneEntry(system) {
  if (system?.source === 'manifest') return false;
  return ['hand', 'hand0205', 'handGlove115200', 'handGloveFullPacket',
    'wholeChair', 'carQX', 'minzhen', 'footVideo', 'robot1', 'robotSY', 'robotLCF',
    'jqbed', 'smallBedNoAlg', 'bed4096num', 'petCare', 'petCareMini'].includes(system?.nativeSourceType || system?.value);
}
