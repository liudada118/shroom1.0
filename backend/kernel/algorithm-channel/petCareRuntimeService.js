/**
 * 宠物看护和生命体征运行时服务。
 *
 * 负责定时调用 Python 算法、维护宠物在床状态稳定窗口、模拟/补齐心率，
 * 并把 jqbed/smallBed/petCare/petCareMini 的算法结果发布给前端。
 *
 * ⚠️⚠️ **这里的「心率」多数情况下是算出来的，不是测出来的。** 压力垫只能测呼吸（体动引起的
 * 压力波动），`nextHeartRate` 是由呼吸率驱动的合成模型，输出夹在 55–100。生命体征那条路只在
 * Python 给不出有效 `heart_rate` 时才用它兜底，宠物看护那条路**一直是模拟的**。所以改模型
 * 参数不会让读数「更准」—— 它本来就不是测量值，当临床依据是误用。
 *
 * ⚠️ 与 Python 侧的字段名（`posture_state`/`breath_rate`/`stateInBbed`/`rate`…）是协议，不能
 * 在这一层改拼写 —— 包括 `stateInBbed` 那个明显的笔误。
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
 * 四部分叠加：`base = 65 + (rr - 12) * 1.5`（呼吸快则心率高的经验关系，12 次/分是基线）+
 * `trendHR`（缓慢随机漫步，夹 60–80，制造长时程起伏）+ `rsa`（呼吸性心率变异，按相位正弦
 * 调制，`breathPhase - 1.0` 那个偏移让心率峰值滞后于呼吸峰值）+ `event`（0.3% 概率抬升
 * 5–12，每拍乘 0.95 衰减，模拟翻身/惊醒）。`dt = 1.0` 写死＝模型假定每秒被调一次，宠物看护
 * 那条路是「呼吸率变了才重算」所以相位推进偏慢，是已知近似。
 *
 * ⚠️ `rr === 0` 的早退**不能去掉**：呼吸率 0 表示没测到人/宠物，此时给一个心率等于凭空造出
 * 一个生命体征。
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
 * 32 列 × 32 行（1024 点），两步：① 前 17 行搬到末尾（按行循环移位，对齐设备物理起始行与
 * 算法假定的起始行）；② 移位后的前 15 行上下镜像（`i` 与 `14 - i` 对调，`i` 走 0..7）。
 * 先 `[...arr]` 拷一份，因为 `splice` 就地改数组，直接改会破坏调用方持有的实时帧。
 *
 * ⚠️ **17/32/8/14 全写死**，绑的是 jqbed 这一款床垫的走线方式，别的型号即使也是 32×32 也不能
 * 复用（所以调用点显式判了 `activeFile`）。改排线就得改这里，而错的表现是「算法结果颠倒」
 * 而不是报错 —— 算法照样跑，只是把脚当成头。
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
   * 三级缓存、一次探测终身有效：依赖没注入 → 直接 false（不缓存，那是装配问题）；有缓存结果
   * → 直接用（原生库在进程生命周期内不会换，每 125ms 探一次会把 worker 打满）；探测在飞 →
   * 返回同一个 Promise 共享。判据要求 `onbedFilterAvailable` 与
   * `onbedFilterSensitivitySchema` 两个都 `=== true`（严格比而非真值：旧版 worker 缺字段，
   * undefined 必须算不支持）。不支持时把状态推成 error 供界面提示，但算法继续跑，只是参数
   * 面板失效。
   *
   * ⚠️ `catch` 里把能力标成 false 而**不是留 null**：探测失败也算不支持，否则每轮都会重探一个
   * 探不通的东西。代价是首次探测赶上偶发故障就永久降级、要重启才恢复 —— 刻意取舍，算法链路
   * 稳定性优先于动态参数。
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
   * 核心是**两帧确认窗口**：`posture_state` 逐帧抖动很常见（宠物体积小、压力变化弱），直接
   * 每帧发给前端会让「在床/离床」图标狂闪，所以连续两帧一致才认定变化并记下
   * `stateStartedAt`。窗口取 2 是因为定时器 20ms 一轮，再大会让真实离床事件明显延迟。
   * `else if (stableState == null)` 那一支是冷启动（否则界面要空一帧），判 `== null` 而非真值
   * 是因为合法值包含 0（离床）。在床判据 `>= 1 && <= 3`：0 空床，1/2/3 是爪/躯干/体动。
   * 心率只在在床且呼吸率有效时合成，否则复位模拟器（不复位则离床再上床会接着用上次的趋势）。
   *
   * ⚠️ 这里的 `onBedTime` 单位是**秒**（墙上时钟差），生命体征那条路的**同名字段不是秒**
   * （见 `startVitalSignsTimer`）—— 名字一样含义不同，前端不能共用一套换算。
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
   * **真实值优先**：Python 给出 `heart_rate > 0` 就原样用，模拟只兜底算法暂时算不出的那些帧
   * （信噪比不足时算法回 0）。四种情况回 0 并复位模拟器：没有该型号的模拟器（防御性）、
   * `stateInBbed !== 1`（床上没人，`Bbed` 是 Python 侧既有笔误）、呼吸率非有限数或 ≤ 0、
   * `breathRate === 88`。复位而非保留，是因为离床再上床该重新起一条趋势。限频那一支
   * （`< HEART_RATE_UPDATE_INTERVAL_MS`）回上一个值 —— 定时器 125ms 一轮，不限频心率就每
   * 125ms 跳一次像噪声，也会让 `nextHeartRate` 的 `dt = 1.0` 假设失真。非生命体征型号原样返回
   * （本函数在通用路径上被无条件调用）。
   *
   * ⚠️ **`breathRate === 88` 那条不能漏**：88 是 Python 算法的「无效/占位」哨兵值，不是真的 88
   * 次/分。漏掉它会在算法失效时输出一个看起来很正常的心率 —— 比输出 0 危险得多。
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
   * 开头那串前置条件**每轮都重新读**（`getPointArr`/`getFile`/`getPort` 是取值函数而不是装配期
   * 快照）：型号和串口开关运行期会变，缓存会让切换型号后仍按旧型号跑算法。
   * `every(typeof === 'number')` 防半帧脏数据进算法。`rawData.rate !== -1` 是「这一帧没结果」
   * 信号（不是错误），此时什么都不发 —— 发空结果会让界面读数闪成 0。catch 只 warn 不停表，
   * 下一轮 125ms 后自然重试。
   *
   * ⚠️ **这个定时器没有重入保护**（对比 `startPetCareTimer` 的 `processing`），只有探测期那条
   * 早退。Python 慢于 125ms 时会有多个 `callPy` 并发在飞，靠 worker 自己的队列消化。现象上没
   * 出过问题，但加重活算法之前值得先补一个 `processing` 守卫。
   *
   * ⚠️ **`onBedTime` 那三支里前两支代码完全相同**（在床、离床都累加），只有「两帧不一致」才
   * 归零 —— 所以它的实际语义是「当前稳定状态持续了多久」，不是字面的在床时长，且单位不是秒
   * （每个算法结果 `+= 2`）。改它会影响历史数据解读，不在注释这一轮里动。
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
   * 20ms 是宠物动作短促所需（慢了漏体动事件）。`resetPending` 保证每次开跑前先让 Python 侧
   * 复位一次（清历史缓冲），`resetRuntime` 会把它置回 true，所以「切走再切回来」也会复位；
   * 成功才置 false，失败下一轮重试。`timeoutMs: 30000` 只给 `rpcStep`（首次调用要加载模型）。
   * `petCareMini` 不打日志（两套常同时跑，20ms 双份日志会淹掉别的信息）。catch 只 warn 不停表。
   *
   * ⚠️ **`processing` 重入保护在这里是必须的**（对比 `startVitalSignsTimer` 就没有）：Python
   * 一轮远超 20ms，没有它会瞬间堆出成百个并发调用把 worker 打死。`finally` 里无条件复位。
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
