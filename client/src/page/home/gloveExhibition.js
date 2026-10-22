import { TERRAIN_DEFAULTS, TERRAIN_BASE_GAIN_RANGE } from '../../components/three/gloveTerrain/terrainConfig';

export const GLOVE_EXHIBITION_MODES = Object.freeze(['gloveMotion', 'gloveTerrain']);

/** 判断是否使用手套专用的展示场景。 */
export function isGloveExhibitionMode(mode) {
  return GLOVE_EXHIBITION_MODES.includes(mode);
}

/** 只给当前系统的目标手置零；旧双手事件缺少手侧时不能推测或同时清除。 */
export function resolveGloveQuaternionResetSide(message, { dual = false, hand = true, acceptedIdentities = [] } = {}) {
  if (!message?.handReset) return null;
  const identity = String(message.displaySystemId || '').trim();
  if (identity && !acceptedIdentities.filter(Boolean).includes(identity)) return null;
  const declaredSide = message.handSide ?? message.outputSide;
  if (declaredSide != null) {
    const side = String(declaredSide).toLowerCase();
    return ['left', 'right'].includes(side) ? side : null;
  }
  if (message.outputChannel === 'sit') return 'left';
  if (message.outputChannel === 'back') return 'right';
  if (typeof message.backFlag === 'boolean') return message.backFlag ? 'right' : 'left';
  return dual ? null : hand ? 'left' : 'right';
}

/** 独立保存地形参数；旧整帧阈值不迁移为初始底形强度。 */
export function gloveExhibitionConfig(mode, saved = {}) {
  if (mode !== 'gloveTerrain') return {};
  const maximum = Number(saved?.valuej1), height = Number(saved?.value1), baseGain = Number(saved?.terrainBaseGain);
  return { valuej1: Number.isFinite(maximum) && maximum > 0 ? maximum : TERRAIN_DEFAULTS.max,
    value1: Number.isFinite(height) && height > 0 ? height : TERRAIN_DEFAULTS.height,
    valuelInit1: Number.isFinite(baseGain) && baseGain >= 0 && baseGain <= TERRAIN_BASE_GAIN_RANGE.max
      ? baseGain : TERRAIN_DEFAULTS.baseGain };
}

/** 复制有效数值数组，避免旧视图的 splice 操作污染缓存和采集帧。 */
function numbers(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map((item) => Number.isFinite(Number(item)) ? Number(item) : 0) : [];
  } catch { return []; }
}

/** 按既有手套线序提取五指基准；归零后的压力不能替代未归零弯指输入。 */
export function getGloveFingerPoints(message, pressure) {
  if (pressure.length === 195) return null;
  const unzeroed = numbers(message.newArr147Raw);
  const source = unzeroed.length >= 75 ? unzeroed : pressure;
  if (source.length < 75) return null;
  if (message.newArr != null) {
    return Array.from({ length: 5 }, (_, finger) => [0, 1, 2].reduce((sum, row) =>
      sum + source[row * 10 + finger * 2] + source[row * 10 + finger * 2 + 1], 0)).reverse();
  }
  return Array.from({ length: 5 }, (_, finger) =>
    source[60 + finger * 3] + source[61 + finger * 3] + source[62 + finger * 3]);
}

/** 将本侧真实五指采样按平铺/握拳基准归一化，供实时帧和校准后缓存重算共用。 */
export function getCalibratedGloveFingers(fingerPoints, calibration) {
  if (!Array.isArray(fingerPoints)) return null;
  return fingerPoints.map((value, index) => {
    const baseline = Number(calibration?.[0]?.[index]) || 0;
    const span = (Number(calibration?.[1]?.[index]) || 0) - baseline;
    return Math.max(0, Math.min(1, (value - baseline) / (span || 255)));
  });
}

/** 将已通过当前系统身份检查的帧转为展示输入，保留零帧与左右手身份。 */
export function buildGloveExhibitionFrame({ message, channel, channelPressure, rawPressure, calibration }) {
  const declaredSide = String(message.handSide ?? message.outputSide ?? '').toLowerCase();
  const side = ['left', 'right'].includes(declaredSide) ? declaredSide : channel === 'back' ? 'right' : 'left';
  const mapped = numbers(message.mappedArr195 ?? message.newArr ?? message.newArr147);
  const current = numbers(channelPressure);
  const pressure = mapped.length ? mapped : current;
  const processed = numbers(message.processedData);
  // ⚠️ 地形必须消费当前压力，优先 processed；使用未扣零基准会导致点了清零仍有山峰。
  const matrix = [processed, current, numbers(rawPressure)].find((values) => values.length >= 256) || [];
  const fingerPoints = getGloveFingerPoints(message, pressure);
  const fingers = getCalibratedGloveFingers(fingerPoints, calibration);
  const orientation = Array.isArray(message.rotate) ? message.rotate.map(Number) : [];
  const validQuaternion = orientation.length === 4 && message.rotate.every((value) => value != null)
    && orientation.every((value) => Number.isFinite(value) && Math.abs(value) <= 1)
    && orientation.some((value) => value !== 0);
  return { side, pressure, rawPressure: matrix.slice(0, 256),
    quaternion: validQuaternion ? orientation : null, fingers, fingerPoints };
}
