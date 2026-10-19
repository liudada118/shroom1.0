const RANGES = { valuej: [1, 65535], valueg: [0, 8], valuel: [0, 100], valuef: [0, 65535], valuelInit: [0, 1e15] };

/** 仅接受有限的数值滑块，0 可关闭过滤和平滑。 */
export function normalizeMatrixVisualTuning(previous = {}, patch = {}) {
  const next = { valuej: 200, valueg: 0, valuel: 0, valuef: 0, valuelInit: 0, ...previous };
  for (const [key, [minimum, maximum]] of Object.entries(RANGES)) {
    if (typeof patch[key] === 'number' && Number.isFinite(patch[key])) next[key] = Math.min(maximum, Math.max(minimum, patch[key]));
  }
  return next;
}

/** 在行列分别做有界高斯卷积，只返回视觉副本。 */
export function gaussianMatrixFrame(values, width, height, sigma) {
  if (!(sigma > 0) || width * height !== values.length) return values.slice();
  const radius = Math.ceil(Math.min(8, sigma) * 2.57);
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma ** 2)));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const horizontal = new Array(values.length), result = new Array(values.length);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) sum += values[row * width + Math.max(0, Math.min(width - 1, col + offset))] * weights[offset + radius];
    horizontal[row * width + col] = sum / weightSum;
  }
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) sum += horizontal[Math.max(0, Math.min(height - 1, row + offset)) * width + col] * weights[offset + radius];
    result[row * width + col] = sum / weightSum;
  }
  return result;
}

/** 缓存原帧并只处理视觉输出，调低过滤可恢复同一帧的原值。 */
export function createMatrixVisualTuning({ width, height, max = 200, filter = 0 } = {}) {
  let tuning = normalizeMatrixVisualTuning({}, { valuej: max, valuef: filter });
  let raw = [], previousRaw = [], displayed = [], previousDisplayed = [];

  /** 下限及总值过滤先作用于副本，未开门槛时保留原始数值。 */
  function spatial(values) {
    const filtered = values.map((value) => tuning.valuef > 0 && value < tuning.valuef ? 0 : value);
    if (tuning.valuelInit > 0 && filtered.reduce((sum, value) => sum + value, 0) < tuning.valuelInit) return new Array(filtered.length).fill(0);
    return gaussianMatrixFrame(filtered, width, height, tuning.valueg);
  }

  /** 仅跨真实帧平滑；被总值门槛清空时立即清空画面。 */
  function blend(target, baseline) {
    if (!(tuning.valuel > 1) || target.length !== baseline.length || (tuning.valuelInit > 0 && target.every((value) => value === 0))) return target;
    return target.map((value, index) => baseline[index] + (value - baseline[index]) / tuning.valuel);
  }

  return {
    /** 收到新帧时推进时间状态，外部修改入参不会污染缓存。 */
    push(values) {
      previousRaw = raw; previousDisplayed = displayed;
      raw = Array.from(values, (value) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1e15, Math.max(-1e15, value)) : 0);
      displayed = blend(spatial(raw), previousDisplayed);
      return displayed.slice();
    },
    /** 从未过滤的缓存重新计算，重复拖动不会重复推进同一帧。 */
    update(patch) {
      const previous = tuning;
      tuning = normalizeMatrixVisualTuning(tuning, patch);
      if (['valueg', 'valuel', 'valuef', 'valuelInit'].some((key) => tuning[key] !== previous[key])) {
        displayed = blend(spatial(raw), spatial(previousRaw));
      }
      return displayed.slice();
    },
    /** 读取渲染副本，不暴露内部历史缓冲。 */
    read() { return displayed.slice(); },
    /** 返回归一化参数供颜色阈值和宿主状态使用。 */
    settings() { return { ...tuning }; },
  };
}
