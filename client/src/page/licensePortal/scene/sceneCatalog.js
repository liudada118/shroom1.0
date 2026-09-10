/** 入口预览使用本地模型，不依赖安装目录、外网或实时传感数据。 */
export const SCENE_MODELS = [
  { key: 'shroom', label: '蘑菇', url: './model/shroom.glb', loader: 'gltf', color: '#7dd3fc', targetSize: 4.45, rotation: [-0.08, 0.2, 0] },
  { key: 'care', label: '床垫', url: './model/bed.glb', loader: 'gltf', color: '#8bd8ff', targetSize: 4.7, rotation: [0.36, -0.64, 0.04] },
  { key: 'chair', label: '座椅', url: './model/chair3.glb', loader: 'gltf', color: '#d9f2ff', targetSize: 4.1, rotation: [-0.08, 0.42, 0] },
  { key: 'robot', label: '机器人', url: './model/jiqirenGggg.fbx', loader: 'fbx', color: '#83d3ff', targetSize: 3.95, rotation: [-0.1, -0.2, 0], offset: [-0.72, 0.08, 0] },
  { key: 'glove', label: '触觉手套', url: './model/hand1.glb', loader: 'gltf', color: '#a8e4ff', targetSize: 4.1, rotation: [Math.PI / 6, 0, -Math.PI] },
];

/** 直接使用参考项目的场景强调色；新增矩阵与手套沿用默认青色。 */
export function getPortalAccent(system) {
  return { care: '#3df2a4', chair: '#6f83ff', robot: '#ff9f43' }[getPortalScene(system)] || '#63d5ff';
}

/** 按真实系统身份选择场景；未知与 Agent 系统显示通用矩阵，不猜测设备外形。 */
export function getPortalScene(system) {
  if (!system) return 'shroom';
  if (system.source === 'manifest') return 'matrix';
  if (['hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket'].includes(system.value)) return 'glove';
  if (system.value.startsWith('robot')) return 'robot';
  if (['wholeChair', 'minzhen', 'carQX'].includes(system.value)) return 'chair';
  if (['bed4096num', 'bed4096', 'jqbed', 'smallBedNoAlg', 'smallBed12B', 'matCol', 'tempFullBed'].includes(system.value)) return 'care';
  return 'matrix';
}
