/**
 * 宠物看护和生命体征运行时服务。
 *
 * 负责定时调用 Python 算法、维护宠物在床状态稳定窗口、模拟/补齐心率，
 * 并把 jqbed/smallBed/petCare/petCareMini 的算法结果发布给前端。
 */
const PET_CARE_SYSTEM_TYPES = new Set(['petCare', 'petCareMini']);
const VITAL_SIGNS_SYSTEM_TYPES = new Set(['jqbed', 'smallBed']);
const HEART_RATE_UPDATE_INTERVAL_MS = 1000;

const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
const randValue = (min, max) => min + Math.random() * (max - min);
const randProb = (probability) => Math.random() < probability;
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
 * 根据呼吸率推算下一拍心率。
 *
 * @param {number} rr 呼吸率。
 * @param {object} simulator 心率模拟器状态。
 * @returns {number} 模拟心率。
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
 * @param {number[]} arr 原始压力矩阵。
 * @returns {number[]} 翻转后的矩阵。
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

  function safeAlgorithmErrorMessage(error, fallback) {
    const message = typeof error?.message === 'string' && error.message
      ? error.message.split(/\r?\n/, 1)[0]
      : fallback;
    return message.slice(0, 500);
  }

  /**
   * 探测当前原生 onbed_filter 是否支持 sensitivity_threshold 新 ABI。
   * 探测失败或不支持时保留旧 getData(data) 调用，避免动态配置破坏稳定算法链路。
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
   * @param {object} data Python 算法返回值。
   * @param {'petCare' | 'petCareMini'} systemKey 系统 key。
   * @returns {object} 前端可用结果。
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
   * @param {object} data Python 算法返回值。
   * @param {'jqbed' | 'smallBed'} systemKey 系统 key。
   * @returns {object} 前端可用结果。
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
   * 启动 jqbed/smallBed 生命体征算法定时器。
   *
   * @returns {NodeJS.Timeout} 定时器句柄。
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
   * 启动宠物看护算法定时器。
   *
   * @param {'petCare' | 'petCareMini'} systemKey 系统 key。
   * @returns {NodeJS.Timeout} 定时器句柄。
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
