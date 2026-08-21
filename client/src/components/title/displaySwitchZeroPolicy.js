/**
 * 切展示模式时要不要自动做一次预压力清零。
 *
 * 分两种使用场景，因为「切换那一刻的读数」在两边的含义完全相反：
 *
 *   演示场景 —— 展台上垫子/手套自身就压着东西，或者有出厂预压力。每次切显示都想
 *     以当下读数为零点，画面才干净。这里自动清零等于替人按一下抽屉里的「清零」。
 *
 *   真实场景 —— 被测对象已经躺在垫子上、手已经握进手套里。切显示的那一刻清零，
 *     就是把人的实际负载当成零点，测量数据被抹平且没有任何提示。所以真实场景下
 *     切换永不自动清零，清零只能由抽屉里的「清零」按钮手动触发。
 *
 * 这个模块只做决策、不发消息，返回值就是要发给后端的那条 WS 消息（null = 什么都不发），
 * 这样能脱开 React 和 WebSocket 直接测。后端不需要任何改动：`{ resetZero: true }`
 * 本来就是手动按钮发的同一条命令。
 */

export const PRESSURE_SCENES = Object.freeze({
  real: 'real',
  demo: 'demo',
});

// 默认真实场景：漏改设置的后果应该是「少清一次零」，而不是「静默抹掉一次测量」。
export const DEFAULT_PRESSURE_SCENE = PRESSURE_SCENES.real;

export const PRESSURE_SCENE_STORAGE_KEY = 'pressureScene';

export function normalizePressureScene(value) {
  return value === PRESSURE_SCENES.demo ? PRESSURE_SCENES.demo : DEFAULT_PRESSURE_SCENE;
}

const defaultStorage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export function readPressureScene(storage = defaultStorage()) {
  try {
    return normalizePressureScene(storage?.getItem(PRESSURE_SCENE_STORAGE_KEY));
  } catch {
    return DEFAULT_PRESSURE_SCENE;
  }
}

export function writePressureScene(scene, storage = defaultStorage()) {
  const normalized = normalizePressureScene(scene);
  try {
    storage?.setItem(PRESSURE_SCENE_STORAGE_KEY, normalized);
  } catch {
    // localStorage 写不进去（隐私模式/配额）不该拦住切场景，本次会话内存里的值仍然有效
  }
  return normalized;
}

/**
 * @param {object} input
 * @param {string} input.sensorType    当前传感器类型（`matrixName`）
 * @param {string} input.nextMode      即将切到的展示模式（`numMatrixFlag` 的新值）
 * @param {string} input.scene         'demo' | 'real'
 * @param {string[]} [input.cancelZeroSensorTypes]
 *        这些传感器切到 3D 遥操（`normal`）时必须**取消**清零 —— 遥操走的是手指校准
 *        数据，带着清零基准手模会歪。这条是硬件语义，与场景无关，两边都执行；
 *        它做的是取消清零，不是清零，所以不违反「真实场景不自动清零」。
 * @returns {{ resetZero: boolean } | null} 要发的 WS 消息，null 表示不发
 */
export function resolveDisplaySwitchZero({
  sensorType,
  nextMode,
  scene,
  cancelZeroSensorTypes = [],
} = {}) {
  if (nextMode === 'normal' && cancelZeroSensorTypes.includes(sensorType)) {
    return { resetZero: false };
  }

  if (normalizePressureScene(scene) === PRESSURE_SCENES.demo) {
    return { resetZero: true };
  }

  return null;
}
