/**
 * 宠物看护和生命体征运行时服务。
 *
 * 负责定时调用 Python 算法、维护宠物在床状态稳定窗口、模拟/补齐心率，
 * 并把 jqbed/smallBed/petCare/petCareMini 的算法结果发布给前端。
 *
 * ⚠️⚠️ **这里的「心率」在多数情况下是算出来的，不是测出来的。**
 * 压力垫本身测不到心率，只能测呼吸（体动引起的压力波动）。`nextHeartRate` 是一个**由
 * 呼吸率驱动的合成模型**（基线 + 趋势漂移 + 呼吸性心率变异 + 随机事件 + 高斯噪声），
 * 输出被夹在 55–100。生命体征那条路只在 Python 算法给不出有效 `heart_rate` 时才用模拟值
 * 兜底；宠物看护那条路**一直是模拟的**（Python 只回呼吸率）。
 *
 * 记住这一点再动这个文件：改模型参数不会让读数「更准」，因为它本来就不是测量值。
 * 任何把这个数字当临床依据的用法都是误用，界面上要不要标注是产品决定，不是这一层的事。
 *
 * 与 Python 侧的字段名（`posture_state`/`breath_rate`/`stateInBbed`/`rate`…）是协议，
 * 不能在这一层改拼写 —— 包括 `stateInBbed` 那个明显的笔误。
 */
const PET_CARE_SYSTEM_TYPES = new Set(['petCare', 'petCareMini']);
const VITAL_SIGNS_SYSTEM_TYPES = new Set(['jqbed', 'smallBed']);
// 模拟心率的最小刷新间隔。心率不该比这更快地跳变（看着像噪声），所以两次重算之间
// 直接复用上一个值。宠物看护那条路不用这个常量，它按呼吸率是否变化来决定重算。
const HEART_RATE_UPDATE_INTERVAL_MS = 1000;

/** 把值夹到 [min, max]。心率模拟的每个中间量都要夹，否则随机漂移会跑出生理范围。 */
const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
/** [min, max) 均匀随机。用于模拟里的小幅漂移。 */
const randValue = (min, max) => min + Math.random() * (max - min);
/** 以给定概率返回 true。用于触发模拟里的偶发心率事件。 */
const randProb = (probability) => Math.random() < probability;
/**
 * 呼吸率归一到一位小数。
 *
 * ⚠️ **返回的是字符串**（`toFixed`），这不是笔误：宠物看护那条路把它压进
 * `breathRateQueue` 后用 `!==` 比较前后两次，靠的正是「保留一位小数后是否变了」这个判据。
 * 换成数字比较会因为浮点尾差而每帧都判「变了」，心率就会每帧重算、抖得没法看。
 * 要拿它参与运算的地方必须显式 `Number()`（见 normalizePetCareResult）。
 */
const normalizeBreathRate = (value) => Number(value).toFixed(1);

/**
 * 生成正态分布随机数，用于心率模拟中的小幅噪声。
 *
 * @param {number} mean 均值。
 * @param {number} std 标准差。
 * @returns {number} 随机值。
 */
function gaussian(mean, std) {
  let u1;
  do {
    u1 = Math.random();
  } while (u1 === 0);
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * std;
}

/**
 * 创建心率模拟公式的基础状态。
 *
 * @returns {object} 公式状态。
 */
function createFormulaState() {
  return {
    breathPhase: 0,
    rsaAmp: 3.5,
    trendHR: 70,
    trendRR: 14,
    event: 0,
    lastHeartRate: 0,
  };
}

/**
 * 创建宠物看护心率模拟器状态。
 *
 * @returns {object} 宠物看护心率状态。
 */
function createPetCareHeartRateSimulatorState() {
  return {
    ...createFormulaState(),
    breathRateQueue: [],
  };
}

/**
 * 创建 jqbed/smallBed 生命体征心率模拟器状态。
 *
 * @returns {object} 生命体征心率状态。
 */
function createVitalSignsHeartRateSimulatorState() {
  return {
    ...createFormulaState(),
    lastHeartRateAt: 0,
  };
}

/**
 * 重置宠物看护心率模拟器。
 *
 * @param {object} simulator 心率模拟器状态。
 */
function resetPetCareHeartRateSimulatorState(simulator) {
  simulator.breathPhase = 0;
  simulator.rsaAmp = 3.5;
  simulator.trendHR = 70;
  simulator.trendRR = 14;
  simulator.event = 0;
  simulator.lastHeartRate = 0;
  simulator.breathRateQueue = [];
}

/**
 * 重置生命体征心率模拟器。
 *
 * @param {object} simulator 心率模拟器状态。
 */
function resetVitalSignsHeartRateSimulatorState(simulator) {
  simulator.breathPhase = 0;
  simulator.rsaAmp = 3.5;
  simulator.trendHR = 70;
  simulator.trendRR = 14;
  simulator.event = 0;
  simulator.lastHeartRate = 0;
  simulator.lastHeartRateAt = 0;
}

/**
 * 根据呼吸率**合成**下一拍心率。见文件头的警告：这不是测量值。
 *
 * 模型由四部分叠加，各自的作用：
 * - `base = 65 + (rr - 12) * 1.5` —— 呼吸快则心率高的经验关系，12 次/分是参考基线。
 * - `trendHR` —— 缓慢随机漫步（夹在 60–80），让读数有长时程起伏而不是恒定值。
 * - `rsa` —— 呼吸性心率变异：按呼吸相位做正弦调制，幅度自身也在 2–6 之间漂。
 *   `breathPhase - 1.0` 那个相位偏移让心率峰值滞后于呼吸峰值。
 * - `event` —— 以 0.3% 概率触发一次 5–12 的抬升，然后每拍乘 0.95 衰减，模拟偶发的
 *   短时心率上冲（翻身、惊醒）。
 *
 * `dt = 1.0` 写死，意味着模型**假定自己每秒被调一次**。生命体征那条路靠
 * HEART_RATE_UPDATE_INTERVAL_MS 保证了这一点；宠物看护那条路是「呼吸率变了才重算」，
 * 调用间隔并不严格是 1 秒，所以那边的呼吸相位推进会偏慢。这是已知的近似，不影响
 * 读数落在合理区间。
 *
 * `rr === 0` 直接回 0：呼吸率为 0 表示没测到人/宠物，此时给一个心率会凭空造出一个生命
 * 体征。**这个早退不能去掉。**
 *
 * @param {number} rr 呼吸率（次/分）。
 * @param {object} simulator 模拟器状态，会被就地更新（这是有状态的，不是纯函数）。
 * @returns {number} 合成心率，整数，夹在 55–100；呼吸率为 0 时返回 0。
 */
function nextHeartRate(rr, simulator) {
  if (rr === 0) return 0;

  const dt = 1.0;
  simulator.breathPhase += 2 * Math.PI * rr / 60.0 * dt;
  simulator.rsaAmp += randValue(-0.05, 0.05);
  simulator.rsaAmp = clampValue(simulator.rsaAmp, 2, 6);

  const rsa = Math.sin(simulator.breathPhase - 1.0) * simulator.rsaAmp;
  const base = 65 + (rr - 12) * 1.5;

  simulator.trendHR += randValue(-0.1, 0.1);
  simulator.trendHR = clampValue(simulator.trendHR, 60, 80);

  if (randProb(0.003)) {
    simulator.event = randValue(5, 12);
  }
  simulator.event *= 0.95;

  const heartRate = base * 0.4 + simulator.trendHR * 0.6 + rsa + simulator.event + gaussian(0, 1);
  return clampValue(Math.round(heartRate), 55, 100);
}

/**
 * 创建单个宠物看护系统的运行时状态。
 *
 * @returns {object} 运行时状态。
 */
function createPetCareRuntimeState() {
  return {
    stateArr: [],
    stableState: null,
    stateStartedAt: 0,
    resetPending: true,
    processing: false,
    lastLoggedAt: 0,
    heartRateSimulator: createPetCareHeartRateSimulatorState(),
  };
}

/**
 * 调整 jqbed 矩阵方向，使算法输入与 Python 侧预期一致。
 *
 * 矩阵是 32 列 × 32 行（1024 点）。两步变换：
 * 1. 把前 17 行搬到末尾（`splice(0, 17*32)` + `concat`）—— 相当于按行做一次循环移位，
 *    对齐设备的物理起始行与算法假定的起始行。
 * 2. 把移位后的前 15 行（`i` 与 `14 - i` 对调，`i` 走 0..7）上下镜像。
 *
 * ⚠️ **17/32/8/14 全是写死的**，它们绑定的是 jqbed 这一款床垫的走线方式。别的型号即使也是
 * 32×32 也不能复用这个函数 —— 所以调用点显式判了 `activeFile`。改传感器排线就得改这里，
 * 而错误的表现是「算法结果颠倒」而不是报错：算法照样能跑，只是把脚当成头。
 *
 * 输入先 `[...arr]` 拷一份，因为下面 `splice` 会就地改数组，直接改会破坏调用方持有的实时帧。
 *
 * @param {number[]} arr 原始压力矩阵（1024 点）。
 * @returns {number[]} 翻转后的新矩阵。
 */
function jqbedOppo(arr) {
  let wsPointData = [...arr];
  const b = wsPointData.splice(0, 17 * 32);
  wsPointData = wsPointData.concat(b);
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
        wsPointData[(14 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }
  return wsPointData;
}

/**
 * 创建宠物看护运行时服务。
 *
 * @param {object} deps Python 调用、实时数据读取和发布依赖。
 * @returns {object} 宠物看护运行时 API。
 */
function createPetCareRuntimeService({
  buildJqbedGetDataArgs = (data) => ({ data }),
  getJqbedAlgorithmConfigSnapshot,
  logger,
  callPy,
  getPointArr,
  getFile,
  getPort,
  probeJqbedAlgorithmConfig,
  publishSystemEvent,
  setJqbedAlgorithmStatus,
  setJqbedMatrixOrigin,
} = {}) {
  let onbedArr = [];
  let onBedTime = 0;
  let jqbedConfigCapability = null;
  let jqbedConfigProbePromise = null;
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

  /**
   * 判断当前传感器类型是否属于宠物看护系统。
   *
   * @param {string} type 传感器类型。
   * @returns {boolean} 是否是宠物看护系统。
   */
  function isPetCareSystem(type) {
    return PET_CARE_SYSTEM_TYPES.has(type);
  }

  /**
   * 把算法错误裁成**可以发给前端**的一行短文本。
   *
   * 两道裁剪各有理由：
   * - **只取第一行**（`split(/\r?\n/, 1)`）。Python 的错误往往带整段 traceback，里面有
   *   绝对路径和源码片段；那既是信息泄露也会把前端的提示框撑爆。完整信息在后端日志里。
   * - **截到 500 字**。这个字符串会进 `jqbedAlgorithmStatus` 并被广播给所有客户端，
   *   一条超长消息会让每个连接都付传输代价。
   *
   * @param {*} error 原始错误。
   * @param {string} fallback error 没有可用 message 时的兜底文案。
   * @returns {string} 单行、≤500 字的错误描述。
   */
  function safeAlgorithmErrorMessage(error, fallback) {
    const message = typeof error?.message === 'string' && error.message
      ? error.message.split(/\r?\n/, 1)[0]
      : fallback;
    return message.slice(0, 500);
  }

  /**
   * 探测当前原生 onbed_filter 是否支持 sensitivity_threshold 新 ABI。
   * 探测失败或不支持时保留旧 getData(data) 调用，避免动态配置破坏稳定算法链路。
   *
   * **三级缓存，一次探测终身有效：**
   * 1. 依赖没注入 → 直接 false（不缓存，因为这是装配问题不是运行时能力问题）。
   * 2. `jqbedConfigCapability !== null` → 用缓存结果。**探测只做一次**，因为原生库在进程
   *    生命周期内不会换；每 125ms 探一次会把 worker 打满。
   * 3. `jqbedConfigProbePromise` 存在 → 返回同一个 Promise，让并发调用共享一次探测
   *    （125ms 的定时器在首次探测未完成时会再进来）。
   *
   * `catch` 里把能力标成 false 而**不是**留 null：探测失败也算「不支持」，否则每一轮都会
   * 重新探测一个探不通的东西。代价是首次探测赶上一次偶发故障就会永久降级到不带参数的调用
   * —— 重启才能恢复。这是刻意取的舍：算法链路的稳定性优先于动态参数。
   *
   * 判据要求 `onbedFilterAvailable` 与 `onbedFilterSensitivitySchema` **两个都为 true**，
   * 严格比 `=== true` 而不是真值：health 回的可能是缺字段的旧版 worker，undefined 必须算不支持。
   *
   * 不支持时会把状态推成 error 让界面能提示，但**不影响算法继续跑** —— 只是参数面板失效。
   *
   * @returns {Promise<boolean>} 是否支持动态参数 ABI。
   */
  async function supportsJqbedAlgorithmConfig() {
    if (typeof getJqbedAlgorithmConfigSnapshot !== 'function'
      || typeof probeJqbedAlgorithmConfig !== 'function') {
      return false;
    }
    if (jqbedConfigCapability !== null) return jqbedConfigCapability;
    if (jqbedConfigProbePromise) return jqbedConfigProbePromise;

    jqbedConfigProbePromise = Promise.resolve()
      .then(() => probeJqbedAlgorithmConfig())
      .then((health) => {
        jqbedConfigCapability = health?.onbedFilterAvailable === true
          && health?.onbedFilterSensitivitySchema === true;
        if (!jqbedConfigCapability) {
          setJqbedAlgorithmStatus?.({
            state: 'error',
            error: 'JQBed algorithm runtime does not support dynamic configuration',
            code: 'JQBED_CONFIG_ABI_UNAVAILABLE',
          });
        }
        return jqbedConfigCapability;
      })
      .catch((error) => {
        jqbedConfigCapability = false;
        setJqbedAlgorithmStatus?.({
          state: 'error',
          error: safeAlgorithmErrorMessage(error, 'Unable to inspect JQBed algorithm runtime'),
          code: 'JQBED_CONFIG_ABI_PROBE_FAILED',
        });
        return false;
      })
      .finally(() => {
        jqbedConfigProbePromise = null;
      });

    return jqbedConfigProbePromise;
  }

  /**
   * 重置指定宠物看护系统运行时。
   *
   * @param {'petCare' | 'petCareMini'} systemKey 系统 key。
   */
  function resetRuntime(systemKey) {
    const system = petCareSystems[systemKey];
    if (!system) return;
    Object.assign(system.runtime, createPetCareRuntimeState());
  }

  /**
   * 重置全部宠物看护和生命体征运行时状态。
   */
  function resetAll() {
    Object.keys(petCareSystems).forEach(resetRuntime);
    Object.values(vitalSignsHeartRateSimulator).forEach(resetVitalSignsHeartRateSimulatorState);
    onbedArr = [];
    onBedTime = 0;
  }

  /**
   * 标准化宠物看护算法结果，补齐稳定在床状态、在床时长和心率。
   *
   * **两帧确认窗口**是这个函数的核心：`posture_state` 逐帧抖动很常见（宠物体积小、
   * 压力变化弱），直接把每帧结果发给前端会让「在床/离床」图标狂闪。所以要连续两帧
   * 一致才认定状态变化，并在变化的那一刻记下 `stateStartedAt`。
   * 窗口长度是 2 而不是更大：定时器 20ms 一轮，2 帧≈几十毫秒，再大就会让真实的离床
   * 事件明显延迟。
   *
   * `else if (runtime.stableState == null)` 那一支是**冷启动**：刚开始只有一帧，
   * 没有它就要等到第二帧才有任何状态可发，界面会先空一下。判 `== null` 而不是真值，
   * 因为 `stableState` 的合法值就包含 0（离床）。
   *
   * 在床判据 `postureState >= 1 && <= 3`：0 是空床，1/2/3 分别是爪/躯干/体动（见
   * logPetCareResult 的标签映射），三者都算在床。
   *
   * 心率部分：只在**在床且呼吸率有效**时合成，否则整个模拟器复位 —— 不复位的话宠物离
   * 床再上床会接着用上次的趋势值，读数不连续。重算的触发条件是「呼吸率保留一位小数后
   * 变了」或「还没有过心率」，其余时候复用上一个值（避免每 20ms 抖一次）。
   *
   * ⚠️ 这里的 `onBedTime` 单位是**秒**（真实墙上时钟差）。生命体征那条路的同名字段
   * **不是秒**（见 startVitalSignsTimer），两个字段名一样但含义不同，前端不能共用一套
   * 换算。
   *
   * @param {object} data Python 算法返回值。
   * @param {'petCare' | 'petCareMini'} systemKey 系统 key。
   * @returns {object} 前端可用结果：原 data 加上 `heart_rate`（合成）、`petInBed`、
   *          `onBedTime`（秒）。
   */
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
      const effectiveBreathRate = normalizeBreathRate(breathRate);
      simulator.breathRateQueue.push(effectiveBreathRate);
      if (simulator.breathRateQueue.length > 2) {
        simulator.breathRateQueue.shift();
      }
      const shouldRecompute =
        simulator.breathRateQueue.length === 2 &&
        simulator.breathRateQueue[0] !== simulator.breathRateQueue[1];

      if (!simulator.lastHeartRate || shouldRecompute) {
        heartRate = nextHeartRate(Number(effectiveBreathRate), simulator);
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

  /**
   * 标准化 jqbed/smallBed 生命体征心率，没有有效心率时根据呼吸率模拟。
   *
   * **真实值优先**：Python 给出 `heart_rate > 0` 就原样用，模拟器完全不介入。模拟只是
   * 兜底，用于算法暂时算不出心率的那些帧（信噪比不足时算法会回 0）。
   *
   * 不合成的四个条件（任一命中就回 0 并复位模拟器）：
   * - 没有该型号的模拟器（不该发生，防御性）。
   * - `stateInBbed !== 1` —— 床上没人，凭空造心率是错的。（字段名的 `Bbed` 是 Python
   *   侧的既有笔误，不能在这层改。）
   * - 呼吸率非有限数或 ≤ 0 —— 没有可用的驱动量。
   * - **`breathRate === 88`** —— 88 是 Python 算法的「无效/占位」哨兵值，不是真的 88 次/分。
   *   漏掉这条判断会在算法失效时输出一个看起来很正常的心率，比输出 0 危险得多。
   *
   * 复位而不是保留：离床再上床应该重新起一条趋势，否则读数会从上次的值突然接续。
   *
   * 限频那一支（`< HEART_RATE_UPDATE_INTERVAL_MS`）直接回上一个值。定时器是 125ms 一轮，
   * 不限频的话心率每 125ms 跳一次，看着像噪声；也会让 `nextHeartRate` 的 `dt = 1.0`
   * 假设彻底失真。
   *
   * 非生命体征型号直接原样返回，不做任何事 —— 这个函数在通用路径上被无条件调用。
   *
   * @param {object} data Python 算法返回值。
   * @param {'jqbed' | 'smallBed'} systemKey 系统 key。
   * @returns {object} 前端可用结果；`heart_rate` 是真实值、合成值或 0。
   */
  function normalizeVitalSignsHeartRate(data, systemKey) {
    if (!VITAL_SIGNS_SYSTEM_TYPES.has(systemKey)) return data;

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
      if (simulator) resetVitalSignsHeartRateSimulatorState(simulator);
      return {
        ...data,
        heart_rate: 0,
      };
    }

    const now = Date.now();
    if (simulator.lastHeartRateAt && now - simulator.lastHeartRateAt < HEART_RATE_UPDATE_INTERVAL_MS) {
      return {
        ...data,
        heart_rate: simulator.lastHeartRate,
      };
    }

    const heartRate = nextHeartRate(breathRate, simulator);
    simulator.lastHeartRate = heartRate;
    simulator.lastHeartRateAt = now;

    return {
      ...data,
      heart_rate: heartRate,
    };
  }

  /**
   * 限频记录宠物看护算法结果，避免日志刷屏。
   *
   * @param {object} result 标准化后的算法结果。
   * @param {'petCare' | 'petCareMini'} systemKey 系统 key。
   */
  function logPetCareResult(result, systemKey) {
    if (systemKey === 'petCareMini') return;

    const runtime = petCareSystems[systemKey].runtime;
    const now = Date.now();
    if (now - runtime.lastLoggedAt < 1000) return;

    runtime.lastLoggedAt = now;
    const postureState = Number(result?.posture_state);
    const postureLabel =
      postureState === 0 ? 'Empty'
        : postureState === 1 ? 'Paws'
          : postureState === 2 ? 'Torso'
            : postureState === 3 ? 'Motion'
              : 'Unknown';

    logger?.info?.(`[${systemKey}] algorithm result`, {
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

  /**
   * 启动 jqbed/smallBed 生命体征算法定时器（125ms 一轮）。
   *
   * 开头那一长串前置条件是**每轮都重新读**的（`getPointArr`/`getFile`/`getPort` 都是
   * 取值函数而不是装配期快照）：传感器型号、串口开关都会在运行期变，缓存下来会让切换型号
   * 后仍然按旧型号跑算法。`pointArr.every(typeof === 'number')` 是防半帧/脏数据进算法。
   *
   * ⚠️ **这个定时器没有「上一轮还在跑就跳过」的重入保护**（对比 startPetCareTimer 的
   * `processing` 标志）。只有探测期那一条 `jqbedConfigProbePromise` 早退。所以 Python 慢于
   * 125ms 时会有多个 `callPy` 并发在飞，worker 侧靠自己的队列消化。现象上没出过问题，
   * 但要加重活算法之前值得先补一个 `processing` 守卫。
   *
   * `rawData.rate !== -1` 是算法的「这一帧没有结果」信号（不是错误），此时**什么都不发** ——
   * 发一个空结果会让界面读数闪成 0。
   *
   * ⚠️ **`onBedTime` 那三支里，前两支代码完全相同**（在床累加、离床也累加），只有「两帧
   * 不一致」才归零。所以这个字段的实际语义是「**当前稳定状态已经持续了多久**」，
   * 而不是字面上的在床时长 —— 离床期间它同样在涨。前端要区分的话得配合 `stateInBbed` 看。
   * 单位也不是秒：每有一个算法结果就 `+= 2`，与 125ms 的轮询间隔并不构成秒。
   * 这是既有行为，改它属于会影响历史数据解读的改动，不在注释这一轮里动。
   *
   * catch 只 warn 不停表：一次算法失败（worker 忙、原生库偶发）不该让整条生命体征通道停掉，
   * 下一轮 125ms 后自然重试。错误状态推给前端时用 `safeAlgorithmErrorMessage` 裁过。
   *
   * @returns {NodeJS.Timeout} 定时器句柄；调用方负责在关闭时 clearInterval。
   */
  function startVitalSignsTimer() {
    return setInterval(async () => {
      const pointArr = getPointArr?.();
      const activeFile = getFile?.();
      const port = getPort?.();
      if (!(pointArr && pointArr.length && pointArr.every((a) => typeof a === 'number') && VITAL_SIGNS_SYSTEM_TYPES.has(activeFile) && port && port.isOpen)) {
        return;
      }
      // 首次启动 Python 可能较慢；探测期间不让 125ms 定时器堆积同一批等待任务。
      if (activeFile === 'jqbed' && jqbedConfigProbePromise) return;

      const newArr = jqbedOppo(pointArr);
      try {
        const configEnvelope = activeFile === 'jqbed' && await supportsJqbedAlgorithmConfig()
          ? getJqbedAlgorithmConfigSnapshot()
          : null;
        const rawData = await callPy(
          'getData',
          buildJqbedGetDataArgs(newArr, activeFile, configEnvelope),
        );
        if (activeFile === 'jqbed' && jqbedConfigCapability === true) {
          setJqbedAlgorithmStatus?.({ state: 'ready', error: null });
        }
        if (rawData && rawData.rate !== -1) {
          const data = normalizeVitalSignsHeartRate(rawData, activeFile);

          if (Array.isArray(data.matrix_origin)) {
            setJqbedMatrixOrigin?.(data.matrix_origin);
          }

          if (onbedArr.length < 2) {
            onbedArr.push(data.stateInBbed);
          } else {
            onbedArr.shift();
            onbedArr.push(data.stateInBbed);
          }

          if (onbedArr.every((a) => a === 1)) {
            onBedTime += 2;
            data.onBedTime = onBedTime;
          } else if (onbedArr.every((a) => a === 0)) {
            onBedTime += 2;
            data.onBedTime = onBedTime;
          } else {
            onBedTime = 0;
            data.onBedTime = 0;
          }

          publishSystemEvent?.(JSON.stringify({ rate: data }));
        }
      } catch (error) {
        logger?.warn?.('[jqbed] callPy error:', error.message || error);
        if (activeFile === 'jqbed') {
          setJqbedAlgorithmStatus?.({
            state: 'error',
            error: safeAlgorithmErrorMessage(error, 'Unable to run jqbed algorithm'),
            errorAt: new Date().toISOString(),
          });
        }
      }
    }, 125);
  }

  /**
   * 启动宠物看护算法定时器（20ms 一轮）。
   *
   * 20ms 比生命体征那条快 6 倍，是因为宠物的动作短促，慢了会漏掉体动事件。也正因为这么快，
   * **`processing` 重入保护在这里是必须的**：Python 一轮远超 20ms，没有它会瞬间堆出成百个
   * 并发调用把 worker 打死。`finally` 里无条件复位，所以抛错也不会把标志卡住。
   *
   * `resetPending` 那一支保证**每次开始跑之前先让 Python 侧复位一次**（清掉上次的历史缓冲）。
   * 它初值为 true（见 createPetCareRuntimeState），并且 `resetRuntime` 会把它重新置回 true ——
   * 所以「切走再切回来」也会重新复位。复位成功才置 false，失败会在下一轮重试。
   *
   * `timeoutMs: 30000` 只给 `rpcStep`，比默认超时长得多：宠物看护算法首次调用要加载模型。
   * 复位调用不给超时，用默认值。
   *
   * `petCareMini` 不打日志（见 logPetCareResult 的早退）—— 两套系统常同时跑，20ms 一轮的
   * 双份日志会淹掉别的信息。
   *
   * catch 只 warn 不停表，理由同 startVitalSignsTimer。
   *
   * @param {'petCare' | 'petCareMini'} systemKey 系统 key。
   * @returns {NodeJS.Timeout} 定时器句柄；调用方负责在关闭时 clearInterval。
   */
  function startPetCareTimer(systemKey) {
    const system = petCareSystems[systemKey];
    return setInterval(async () => {
      if (system.runtime.processing) return;

      const pointArr = getPointArr?.();
      const file = getFile?.();
      const port = getPort?.();
      if (!(pointArr && pointArr.length && pointArr.every((a) => typeof a === 'number') && file === systemKey && port && port.isOpen)) {
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
        publishSystemEvent?.(JSON.stringify({ [system.eventKey]: result }));
      } catch (error) {
        logger?.warn?.(`[${system.eventKey}] callPy error:`, error.message || error);
      } finally {
        system.runtime.processing = false;
      }
    }, 20);
  }

  return {
    isPetCareSystem,
    resetAll,
    resetRuntime,
    startPetCareTimer,
    startVitalSignsTimer,
  };
}

module.exports = {
  createPetCareRuntimeService,
};
