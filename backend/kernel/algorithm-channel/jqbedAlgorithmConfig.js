/**
 * JQBed（智能床垫）算法参数的持久化与校验。
 *
 * 用法：`createJqbedAlgorithmConfigStore()` 建单实例（server.js 装配期），`load` 读盘、
 * `getSnapshot` 取副本、`save` 全量覆盖、`reset` 恢复出厂。全部值都是 `number`（开关也是
 * 1.0/0.0）以对齐 Python 侧类型期待，别为了「好看」改成布尔。
 *
 * ⚠️ **字段名不是本仓定的**，会被原样塞进 Python 的 `getData`（见 jqbedAlgorithmProtocol）。
 * 加字段前必须先确认 Python 认识它 —— 否则参数被静默忽略：滑块动了、算法行为不变、无报错。
 */
const fs = require('node:fs');
const path = require('node:path');

// 配置文件格式版本。改这个数字意味着旧配置文件要走迁移分支（见 load），
// 而不是被当成不兼容直接丢回默认值。
const JQBED_ALGORITHM_CONFIG_VERSION = 2;

// 出厂默认值。它同时是**唯一一份「完整」的参数集合** —— 因为
// normalizeJqbedAlgorithmValues 要求 18 个键全部到齐，v1 配置的迁移和 reset() 都靠它补齐。
// 冻结（含内层数组）是为了防止某个调用方顺手改了默认值，让后续 reset 拿到被污染的基线。
const DEFAULT_JQBED_ALGORITHM_VALUES = Object.freeze({
  threshold_factor: 0.0,
  continuous_on_bed_duration_minutes: 0.0,
  unlock_sitting_alarm_duration_minutes: 0.0,
  sos_peak_threshold: 0.0,
  points_threshold_in: 0.0,
  sos_disable_area: Object.freeze([6.0, 10.0]),
  min_sos_sequence: 0.0,
  filter_switch: 1.0,
  strel_switch: 1.0,
  leave_bed_disable_area: Object.freeze([0.0, 0.0]),
  small_object_size: Object.freeze([0.0, 0.0]),
  breath_detect_mode: 0.0,
  sitting_area: Object.freeze([0.0, 0.0]),
  body_movement_threshold: 30.0,
  step_leavebed_trigger: 50.0,
  edge_align_ratio: 0.0,
  sensitivity_threshold: 0.0,
  breath_th: 0.0,
});

// 每个字段的校验类型。kind：number 非负有限数 / integer 非负整数 / switch 只能 0 或 1 /
// pair 两元非负数组且各 ≤ 32（矩阵 32×32）/ sittingPair 同 pair 但额外放行 [255,255] 哨兵 /
// sensitivityMode 0..3 枚举。
//
// ⚠️ 键集合必须与 DEFAULT_JQBED_ALGORITHM_VALUES **完全一致**（normalize 按这张表遍历）：
// 漏键 = 那个参数永远存不进去，多键 = 默认值补不上它、每次校验都报 missing。
const FIELD_RULES = Object.freeze({
  threshold_factor: { kind: 'number' },
  continuous_on_bed_duration_minutes: { kind: 'number' },
  unlock_sitting_alarm_duration_minutes: { kind: 'number' },
  sos_peak_threshold: { kind: 'number' },
  points_threshold_in: { kind: 'number' },
  sos_disable_area: { kind: 'pair' },
  min_sos_sequence: { kind: 'integer' },
  filter_switch: { kind: 'switch' },
  strel_switch: { kind: 'switch' },
  leave_bed_disable_area: { kind: 'pair' },
  small_object_size: { kind: 'pair' },
  breath_detect_mode: { kind: 'integer' },
  sitting_area: { kind: 'sittingPair' },
  body_movement_threshold: { kind: 'number' },
  step_leavebed_trigger: { kind: 'number' },
  edge_align_ratio: { kind: 'number' },
  sensitivity_threshold: { kind: 'sensitivityMode' },
  breath_th: { kind: 'number' },
});

/**
 * 参数校验失败。
 *
 * `errors` 是一张 `{字段名: 失败原因}` 的表（原因取值见 FIELD_RULES 注释以及
 * `'unknown'`/`'missing'`），前端靠它高亮具体哪个输入框填错了。所以校验是
 * **收集全部错误再抛**而不是遇错即抛 —— 让用户一次改完，而不是保存 18 次。
 *
 * 协议层（jqbedAlgorithmProtocol）会 `instanceof` 判断这个类型来区分「用户填错了」和
 * 「后端出问题了」，两者回给前端的文案不同。所以**别把它换成普通 Error**。
 */
class JqbedAlgorithmConfigValidationError extends Error {
  /**
   * @param {Record<string, string>} errors 字段名 → 失败原因。
   */
  constructor(errors) {
    super('Invalid jqbed algorithm configuration');
    this.name = 'JqbedAlgorithmConfigValidationError';
    this.errors = errors;
  }
}

/**
 * 解析单个非负数，**不抛错**，用 `{value}` / `{error}` 两种形状回报结果。
 *
 * 返回而不抛，是因为调用方要收集全部字段的失败原因成一张表，抛错只能拿到第一个。接受数字
 * 也接受非空数字字符串（值来自前端输入框，`"0.35"` 是常态）。非负是这批参数的物理性质
 * （时长、阈值、点数、面积都不可能为负）。
 *
 * ⚠️ 空串（含纯空白）判失败而不是当 0：清空输入框是「没填」不是「填了 0」，静默当 0 会让
 * 阈值意外归零。
 *
 * @param {*} value 原始值。
 * @returns {{value: number}|{error: string}} 成功时带归一后的数字，失败时带原因
 *          （`'number'` 类型不对 / `'finite'` 是 NaN 或 Infinity / `'nonnegative'` 是负数）。
 */
function parseNonnegativeNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
    return { error: 'number' };
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return { error: 'finite' };
  if (number < 0) return { error: 'nonnegative' };
  return { value: number };
}

/**
 * 校验一个两元区域参数。
 *
 * 长度必须正好是 2（不是「至少 2」）：多余元素说明前端传错了结构，静默截断会让用户以为第三
 * 个值生效了。上限 32 来自矩阵尺寸（jqbed 32×32），写死在这里是已知耦合点 —— 换尺寸的传感器
 * 要一起改。
 *
 * ⚠️ `sittingPair` 的 `[255, 255]` 是「关闭坐起报警区域」哨兵，绕过 32 上限，且**必须两个都
 * 是 255**（只有一个判 `'sentinel'`）：Python 按「整对是不是哨兵」判断，混着写会被当成一个
 * 越界的真实区域。
 *
 * @param {*} value 原始值，期望是两元数组。
 * @param {string} kind FIELD_RULES 里的 kind，只有 `'sittingPair'` 会启用哨兵分支。
 * @returns {{value: number[]}|{error: string}} 成功时带归一后的两元数组，失败时带原因。
 */
function normalizePair(value, kind) {
  if (!Array.isArray(value) || value.length !== 2) return { error: 'pair' };
  const normalized = value.map(parseNonnegativeNumber);
  const invalid = normalized.find((item) => item.error);
  if (invalid) return invalid;
  const pair = normalized.map((item) => item.value);
  const isSittingSentinel = pair[0] === 255 || pair[1] === 255;
  if (kind === 'sittingPair' && isSittingSentinel) {
    return pair[0] === 255 && pair[1] === 255 ? { value: pair } : { error: 'sentinel' };
  }
  if (pair[0] > 32 || pair[1] > 32) return { error: 'range' };
  return { value: pair };
}

/**
 * 校验并归一整套算法参数，**全有或全无**。
 *
 * 所有错误收集完再一次性抛。非对象输入兜成 `{}` 而不是抛错，让 null/数组/字符串都走进「18 个
 * 字段全 missing」的路径，前端拿到的错误表形状一致。
 *
 * ⚠️ 两条严格规则都是刻意的：**未知字段报 `'unknown'`** 而不是忽略（多带字段通常意味着前后端
 * 版本不一致，忽略会让用户以为新参数已生效）；**缺字段报 `'missing'`** 而不是补默认值 ——
 * 保存必须是完整覆盖，否则「只改了一个滑块」和「前端漏传一半字段」无法区分，后者会把没传的
 * 参数悄悄重置。所以前端每次都要发全 18 个字段。（v1 配置的补默认值在 `load` 里，那是迁移。）
 *
 * @param {*} values 待校验的参数对象。
 * @returns {Record<string, number|number[]>} 归一后的参数（新对象，键序按 FIELD_RULES）。
 * @throws {JqbedAlgorithmConfigValidationError} 任一字段不合法。
 */
function normalizeJqbedAlgorithmValues(values) {
  const errors = Object.create(null);
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};

  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(FIELD_RULES, key)) errors[key] = 'unknown';
  }

  const normalized = {};
  for (const [key, rule] of Object.entries(FIELD_RULES)) {
    if (!Object.hasOwn(source, key)) {
      errors[key] = 'missing';
      continue;
    }
    const result = rule.kind === 'pair' || rule.kind === 'sittingPair'
      ? normalizePair(source[key], rule.kind)
      : parseNonnegativeNumber(source[key]);
    if (result.error) {
      errors[key] = result.error;
      continue;
    }
    if (rule.kind === 'integer' && !Number.isInteger(result.value)) {
      errors[key] = 'integer';
      continue;
    }
    if (rule.kind === 'switch' && result.value !== 0 && result.value !== 1) {
      errors[key] = 'switch';
      continue;
    }
    if (rule.kind === 'sensitivityMode'
      && (!Number.isInteger(result.value) || result.value < 0 || result.value > 3)) {
      errors[key] = 'sensitivityMode';
      continue;
    }
    normalized[key] = result.value;
  }

  if (Object.keys(errors).length > 0) throw new JqbedAlgorithmConfigValidationError(errors);
  return normalized;
}

/**
 * 深拷贝一份配置信封。
 *
 * 用 `normalizeJqbedAlgorithmValues` 来做拷贝而不是 `structuredClone`/展开，是一举两得：
 * - **真深拷贝**。`values` 里有几个两元数组，浅拷贝会让调用方通过 `snapshot.values.sitting_area[0] = x`
 *   改到 store 内部的状态（现象是「没点保存但算法行为变了，重启又变回来」）。
 * - **顺带复检**。内部快照按理永远是合法的（只在 normalize 成功后才赋值），所以这里
 *   不会抛；真抛了就说明有代码绕过 save 直接改了 `snapshot`，早炸比带着脏数据跑好。
 *
 * @param {{version: number, values: object, savedAt: string|null}} envelope 源信封。
 * @returns {{version: number, values: object, savedAt: string|null}} 独立的新信封。
 */
function cloneEnvelope(envelope) {
  return {
    version: envelope.version,
    values: normalizeJqbedAlgorithmValues(envelope.values),
    savedAt: envelope.savedAt,
  };
}

/**
 * 造一份出厂默认信封。
 *
 * `savedAt: null` 是「**从未保存过**」的标记，前端靠它区分「用户配置过并存下来的值」和
 * 「还在用出厂值」。注意这个 null 不会被写进文件：`reset()` 走的是 `save()`，会打上
 * 真实时间戳；而 `load` 读文件时要求 `savedAt` 必须是字符串，null 的信封读不回来。
 * 所以 null 只存在于内存中「没有配置文件」的那一刻。
 *
 * @returns {{version: number, values: object, savedAt: null}} 默认信封（每次都是新对象）。
 */
function defaultEnvelope() {
  return {
    version: JQBED_ALGORITHM_CONFIG_VERSION,
    values: normalizeJqbedAlgorithmValues(DEFAULT_JQBED_ALGORITHM_VALUES),
    savedAt: null,
  };
}

/**
 * 原子写配置文件：**先写临时文件，再 rename 覆盖**。
 *
 * ⚠️ 不能改成直接 `writeFileSync(filePath)`：断电/进程被杀会留下截断的 JSON，下次 `load` 解析
 * 失败就静默回落默认值 —— 用户的全套参数无声丢失。`rename` 在同一文件系统上是原子的。
 *
 * 临时名带 pid + 时间戳（同时跑两个实例不会互踩）。清理临时文件的失败被吞掉、**原样抛原始
 * 错误**：调用方要知道的是磁盘满/权限，不是「临时文件删不掉」。`fsImpl` 可注入供测试。
 *
 * @param {string} filePath 目标文件路径。
 * @param {object} envelope 要写入的信封。
 * @param {object} fsImpl fs 实现（需要 mkdirSync/writeFileSync/renameSync/unlinkSync）。
 * @returns {void}
 * @throws {Error} 写入或改名失败时原样抛出。
 */
function persistEnvelope(filePath, envelope, fsImpl) {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsImpl.writeFileSync(tempPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    fsImpl.renameSync(tempPath, filePath);
  } catch (error) {
    try { fsImpl.unlinkSync(tempPath); } catch (_cleanupError) {}
    throw error;
  }
}

/**
 * 创建 JQBed 算法参数存储（单实例，server.js 装配期建一个）。
 *
 * 「store」在这里的含义是「内存快照 + 一个 JSON 文件」，不涉及数据库。参数写在
 * `runtimeWritableRoot` 下（见 server.js 的 `jqbed-algorithm-config.json`），
 * 属于**可写运行态**而不是随包分发的只读资源 —— 打包后用户改的参数要能存下来。
 *
 * @param {object} options 依赖。
 * @param {string} options.filePath 配置文件路径。
 * @param {object} [options.fsImpl] fs 实现，测试可注入。
 * @param {Function} [options.now] 取当前时间，测试可注入以固定 savedAt。
 * @param {object} [options.logger] 日志器；只在回落默认值时用到。
 * @returns {{load: Function, getSnapshot: Function, save: Function, reset: Function}} store。
 */
function createJqbedAlgorithmConfigStore({ filePath, fsImpl = fs, now = () => new Date(), logger } = {}) {
  let snapshot = defaultEnvelope();

  /**
   * 配置文件不可用时回落到出厂默认值。
   *
   * **只记 warn，不抛。** 参数文件坏了不该让整个后端起不来 —— 智能床垫的算法带着默认
   * 参数仍然能跑（精度差一点），而抛错会让用户连界面都看不到、更没法重新配一遍。
   * 代价是「参数被悄悄重置」只在日志里有痕迹，排查时要去看这条 warn。
   *
   * @param {Error} error 触发回落的错误。
   * @returns {object} 默认信封的副本。
   */
  function fallBackToDefaults(error) {
    logger?.warn?.(`Unable to load jqbed algorithm configuration: ${error.message}`);
    snapshot = defaultEnvelope();
    return cloneEnvelope(snapshot);
  }

  /**
   * 从磁盘读入配置，**任何异常都回落默认值**（不抛）。
   *
   * 文件不存在是正常情况（首次运行），用默认值且不记 warn。三条「不兼容」判据（version 不认、
   * savedAt 非字符串、整体为空）都走 catch 回落；判 `savedAt` 类型是在挡「手改坏了的文件」。
   *
   * **v1 → v2 迁移**：按 v2 的键遍历，v1 里有的沿用、没有的从默认值补，只补键不改值（老用户
   * 的调参结果不变）。⚠️ 迁移**只写内存快照，不落盘** —— 磁盘上仍是 v1，等用户下次保存才
   * 升级。刻意如此：读一次配置不该产生一次写盘。
   *
   * @returns {object} 当前生效的信封副本。
   */
  function load() {
    if (!fsImpl.existsSync(filePath)) {
      snapshot = defaultEnvelope();
      return cloneEnvelope(snapshot);
    }
    try {
      const envelope = JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
      if (!envelope
        || ![1, JQBED_ALGORITHM_CONFIG_VERSION].includes(envelope.version)
        || typeof envelope.savedAt !== 'string') {
        throw new Error('incompatible configuration envelope');
      }
      const values = envelope.version === 1
        ? Object.fromEntries(Object.keys(DEFAULT_JQBED_ALGORITHM_VALUES).map((key) => [
          key,
          Object.hasOwn(envelope.values || {}, key)
            ? envelope.values[key]
            : DEFAULT_JQBED_ALGORITHM_VALUES[key],
        ]))
        : envelope.values;
      snapshot = {
        version: JQBED_ALGORITHM_CONFIG_VERSION,
        values: normalizeJqbedAlgorithmValues(values),
        savedAt: envelope.savedAt,
      };
      return cloneEnvelope(snapshot);
    } catch (error) {
      return fallBackToDefaults(error);
    }
  }

  /**
   * 读当前配置。
   *
   * 返回**副本**而不是内部引用：这个方法在采集期被高频调用（petCareRuntimeService 每
   * 125ms 一轮，每次把快照塞进 Python 调用参数），如果返回引用，下游任何一次就地改动
   * 都会污染 store。拷贝的代价是 18 个字段的一次 normalize，相对 Python 调用可忽略。
   *
   * @returns {object} 当前信封的副本。
   */
  function getSnapshot() {
    return cloneEnvelope(snapshot);
  }

  /**
   * 保存一整套参数：校验 → 落盘 → 更新内存快照。
   *
   * 校验在最前面，非法参数既不落盘也不改内存。`savedAt` 用 ISO 字符串（要直接显示给用户，
   * 也要能被 `load` 的类型检查认出来）。
   *
   * ⚠️ **顺序是关键：先 `persistEnvelope` 成功，才改 `snapshot`。** 反过来的话磁盘写失败时内存
   * 已是新配置，「保存失败」的现象要延迟到下次开机才显现。
   *
   * @param {object} values 完整的 18 个参数。
   * @returns {object} 保存后的信封副本。
   * @throws {JqbedAlgorithmConfigValidationError} 参数不合法。
   * @throws {Error} 落盘失败（磁盘满、权限等）。
   */
  function save(values) {
    const next = {
      version: JQBED_ALGORITHM_CONFIG_VERSION,
      values: normalizeJqbedAlgorithmValues(values),
      savedAt: now().toISOString(),
    };
    persistEnvelope(filePath, next, fsImpl);
    snapshot = next;
    return cloneEnvelope(snapshot);
  }

  /**
   * 恢复出厂参数。
   *
   * 走 `save` 而不是 `snapshot = defaultEnvelope()`，所以**重置是持久的**：它会落盘并
   * 打上新的 `savedAt`。这是有意的 —— 用户点「恢复默认」的预期是永久生效，而不是重启
   * 后又回到之前调坏的那套参数。
   *
   * 副作用：重置之后 `savedAt` 不再是 null，所以前端无法再靠它判断「用户从没配过」。
   *
   * @returns {object} 重置后的信封副本。
   * @throws {Error} 落盘失败。
   */
  function reset() {
    return save(DEFAULT_JQBED_ALGORITHM_VALUES);
  }

  return { load, getSnapshot, save, reset };
}

module.exports = {
  JQBED_ALGORITHM_CONFIG_VERSION,
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
  normalizeJqbedAlgorithmValues,
  createJqbedAlgorithmConfigStore,
};
