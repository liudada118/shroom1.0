const { createPythonAlgorithmRunner } = require('../../kernel/algorithm-channel/displaySystemAlgorithmRunner');
const { SENSOR_DEFINITIONS } = require('@shroom/backend/sensors');
const { createRealtimeClassifier } = require('../../agent-runtime/algorithm-lab/realtimeRunner');
const { RUNTIME } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');

/** 用户分类器按离线记录的阶段读取，不能一律用归一化矩阵替换已测试压力值。 */
function inputValues(frame, item) {
  const stage = item?.resolvedPackage?.classifier?.inputStage;
  if (stage) return stage === 'processed' ? (frame.payload.stages?.processed || frame.payload.value) : frame.payload.stages?.[stage];
  return frame.payload.stages?.normalized || frame.payload.value;
}

/** 解析算法输入尺寸；副本原型号只能来自宿主上下文，不能信任帧自报的模板来源。 */
function resolveMarketInput(frame, nativeSensorType = frame.sensorType) {
  let matrix = frame.payload.matrix;
  if (matrix == null && frame.displaySystemId === frame.sensorType) {
    // ⚠️ getSensorDefinition 对未知型号会默认返回 32×32，此处必须只查显式登记项。
    const definition = Object.hasOwn(SENSOR_DEFINITIONS, nativeSensorType) ? SENSOR_DEFINITIONS[nativeSensorType] : null;
    if (definition?.channels.includes(frame.sensorId) && frame.outputChannel === frame.sensorId) {
      const { height, width, total } = definition.matrix;
      matrix = { rows: height, cols: width, total };
    }
  }
  if (!matrix) return { matrix: null, inputError: '已收到数据，但缺少矩阵尺寸；请检查传感器定义或线序配置' };
  const { rows, cols, total } = matrix;
  if (![rows, cols, total].every((value) => Number.isInteger(value) && value > 0) || rows * cols !== total) {
    return { matrix: null, inputError: '矩阵尺寸无效，请检查传感器定义或线序配置' };
  }
  const values = frame.payload.stages?.normalized || frame.payload.value;
  const inputError = !Array.isArray(values) || values.length !== total
    ? `当前帧数据不完整：矩阵需要 ${total} 点，收到 ${values?.length ?? 0} 点`
    : !values.every(Number.isFinite) ? '当前帧含无效数值，请检查传感器数据' : '';
  return { matrix: { rows, cols, total }, inputError };
}

/** 返回适配限制，不能为了匹配算法而截断、补零或伪造矩阵。 */
function incompatibility(item, matrix) {
  if (!matrix) return '请先连接传感器并接收实时数据';
  if (item.attachable === false || item.resolvedPackage?.input?.mode === 'multi-sensor') return '此包需要在展示系统配置中绑定输入';
  const totals = item.compatibility?.matrixTotals || [];
  if (totals.length && !totals.includes(matrix.total)) return `需要 ${totals.join('/')} 点，当前 ${matrix.total} 点`;
  const shapes = item.compatibility?.recommendedMatrices || [];
  if (shapes.length && !shapes.some((shape) => shape.rows === matrix.rows && shape.cols === matrix.cols)) return `需要 ${shapes.map((s) => `${s.rows}×${s.cols}`).join('/')} 矩阵`;
  return '';
}

/** 只读订阅标准帧的会话算法超市；不改采集帧、存储、回放和渲染数据。
 * ⚠️ Python 缓存按 entry 共用，每个包仅允许一个通道，已由系统运行的包不能再次初始化。
 * 结果和清单走有界 HTTP 快照；退出当前系统、授权失效或回放时停用会话实例。
 */
function createAlgorithmMarketService({ channelBus, packages = [], listUserPackages = () => [], getContext, createRunner = createPythonAlgorithmRunner, now = Date.now, schedule = setInterval, unschedule = clearInterval }) {
  const catalog = new Map(packages.map((item) => [item.id, item]));
  const channels = new Map();
  const instances = new Map();
  const closing = new Map();
  const configuredPending = new Map();
  const configuredErrors = new Map();
  let contextKey = '';
  let generation = 0;
  let closed = false;

  /** 仅在目录查询、启停和低频维护时刷新保存版本，不在逐帧路径读磁盘。 */
  function refreshCatalog() {
    const next = new Map([...packages, ...listUserPackages()].map((item) => [item.id, item]));
    for (const [id, previous] of catalog) if (!next.has(id) || previous.revision !== next.get(id).revision) remove(id);
    catalog.clear(); for (const [id, item] of next) catalog.set(id, item);
  }

  /** 停用先摘掉引用，迟到的 Python 结果就不会进入新的系统或队列。 */
  function remove(id) {
    const instance = instances.get(id);
    if (!instance) return closing.get(id) || Promise.resolve();
    instances.delete(id);
    const task = Promise.resolve().then(() => instance.runner.dispose()).catch(() => {}).finally(() => {
      if (closing.get(id) === task) closing.delete(id);
    });
    closing.set(id, task);
    return task;
  }

  /** 每次读写和收帧均核对当前系统，防止旧页的开关影响新系统。 */
  function context() {
    const value = getContext();
    const key = value.allowed && !value.playback ? String(value.sensorType || '') : '';
    if (key !== contextKey) {
      contextKey = key; channels.clear();
      configuredErrors.clear();
      for (const id of instances.keys()) remove(id);
    }
    for (const [id, instance] of instances) {
      const binding = value.systemConfiguration?.algorithms?.find((entry) => entry.packageId === id && entry.enabled);
      if (instance.configurationKey && (!binding || instance.configurationKey !== JSON.stringify(binding))) remove(id);
      else if (!instance.native && (value.reservedPackageIds || []).includes(id)) remove(id);
    }
    return value;
  }

  /** 转成安全的公开摘要，绝不下发入口文件、资源路径或 Python 源码。 */
  function snapshot() {
    refreshCatalog();
    const current = context();
    return {
      sensorType: current.sensorType,
      configuration: current.systemConfiguration || null,
      configuredAlgorithms: (current.systemConfiguration?.algorithms || []).map((binding) => ({ ...binding,
        channelId: `${current.sensorType}:${binding.sensorId}`,
        error: configuredErrors.get(binding.packageId)?.key === `${contextKey}:${JSON.stringify(binding)}` ? configuredErrors.get(binding.packageId).message : '' })),
      allowed: !closed && current.allowed && !current.playback,
      reason: closed ? '服务已停止' : !current.allowed ? '请先激活授权' : current.playback ? '会话算法仅用于实时数据，回放沿用原系统算法' : '',
      packages: [...catalog.values()].filter((item) => !item.systemId || item.systemId === current.sensorType).map(({ id, name, description, metricDefinitions, compatibility, sampleRateHz, runtime }) => ({
        id, name, description, metricDefinitions, compatibility, sampleRateHz, runtime,
        reserved: (current.reservedPackageIds || []).includes(id),
      })),
      channels: [...channels.values()].map(({ frame, receivedAt, matrix, inputError }) => ({ channelId: frame.channelId, label: frame.sensorLabel || frame.sensorId || frame.channelId, matrix, inputError, live: now() - receivedAt < 2000 })),
      instances: [...instances.values()].map(({ id, channelId, token, status, error, history, dropped, lastReceived, configurationKey }) => ({ id, channelId, token, managed: Boolean(configurationKey), status: status !== 'error' && now() - lastReceived > 2000 ? 'waiting' : status, error, history, dropped })),
    };
  }

  /** 拒绝不可执行的请求，错误文本只包含用户可理解的限制。 */
  function fail(message, httpStatus = 409) {
    const error = new Error(message); error.httpStatus = httpStatus; throw error;
  }

  /** 按已收帧的通道启停受信包，重复点击幂等，销毁完成前不能重建同一 Python 模块。 */
  async function toggle({ sensorType, packageId, channelId, enabled } = {}, configurationKey = null) {
    refreshCatalog();
    if (typeof enabled !== 'boolean') fail('enabled 必须是布尔值', 400);
    const current = context();
    if (closed || !current.allowed) fail('当前不可启用算法', 403);
    if (sensorType !== current.sensorType) fail('系统已切换，请刷新算法超市');
    if (!catalog.has(packageId)) fail('算法包不存在', 404);
    const binding = current.systemConfiguration?.algorithms?.find((entry) => entry.packageId === packageId);
    if (binding && !configurationKey) fail('此算法属于系统配置，请在系统编辑器中启用、停用或删除。');
    if (configurationKey && (!binding?.enabled || JSON.stringify(binding) !== configurationKey)) fail('系统算法配置已变化');
    if (!enabled) { await remove(packageId); return snapshot(); }
    if (current.playback) fail('请切换到实时模式后启用');
    const native = (current.reservedPackageIds || []).includes(packageId);
    if (native && !configurationKey) fail('当前系统已内置运行此算法，请使用原有算法设置');
    const selected = channels.get(channelId);
    if (!selected || now() - selected.receivedAt > 2000) fail('此通道尚未收到实时数据，请先连接传感器');
    const item = catalog.get(packageId);
    if (item.systemId && item.systemId !== sensorType) fail('此用户算法属于另一系统，请在目标系统重新测试后保存。');
    if (item.systemId && selected.frame.displaySystemId !== item.systemId) fail('输入通道不属于此算法的系统。');
    if (selected.inputError && item.runtime !== RUNTIME) fail(selected.inputError);
    const reason = incompatibility(item, selected.matrix);
    if (reason) fail(reason);
    const selectedValues = inputValues(selected.frame, item);
    if (!Array.isArray(selectedValues) || selectedValues.length !== selected.matrix.total || !selectedValues.every(Number.isFinite)) fail('当前帧数据不完整，请检查协议和线序后重试');
    const existing = instances.get(packageId);
    if (existing) {
      if (configurationKey && !existing.configurationKey) { await remove(packageId); return toggle({ sensorType, packageId, channelId, enabled }, configurationKey); }
      if (existing.channelId !== channelId) fail('此算法已在另一通道运行，请先停用');
      return snapshot();
    }
    await closing.get(packageId);
    const latestContext = context();
    if (latestContext.sensorType !== sensorType || !contextKey || closed || (!native && (latestContext.reservedPackageIds || []).includes(packageId))) fail('当前系统状态已变化，请重试');
    if (configurationKey && !latestContext.systemConfiguration?.algorithms?.some((entry) => entry.enabled && JSON.stringify(entry) === configurationKey)) fail('系统算法配置已变化');
    if (!channels.has(channelId) || now() - channels.get(channelId).receivedAt > 2000) fail('传感器数据已中断，请重新连接后启用');
    if (instances.has(packageId)) return toggle({ sensorType, packageId, channelId, enabled }, configurationKey);
    if (instances.size >= 8) fail('最多同时运行 8 个算法，请先停用其他算法。');
    if (catalog.get(packageId)?.revision !== item.revision) fail('算法版本已变化，请刷新后重试。');
    const runner = native ? { dispose: async () => {} } : item.runtime === RUNTIME ? createRealtimeClassifier(item.resolvedPackage)
      : createRunner({ entry: item.resolvedPackage.resolvedEntry, algorithmPackage: item.resolvedPackage, timeoutMs: 3000 });
    instances.set(packageId, { id: packageId, channelId, runner, native, configurationKey, token: ++generation, windowEpoch: 0, status: 'waiting', error: '', history: [], dropped: 0, lastReceived: now(), lastTimestamp: null });
    return snapshot();
  }

  /** 首个兼容实时帧到达后启动已保存算法；切换、删改或迟到结果不能复活旧实例。 */
  function ensureConfigured(current, input) {
    for (const binding of current.systemConfiguration?.algorithms || []) {
      if (!binding.enabled || binding.sensorId !== input.frame.sensorId) continue;
      const id = binding.packageId;
      const signature = JSON.stringify(binding);
      const key = `${contextKey}:${signature}`;
      if (instances.get(id)?.configurationKey === signature || configuredPending.get(id)?.key === key) continue;
      const previous = configuredErrors.get(id);
      if (previous?.key === key && now() - previous.at < 1000) continue;
      const pending = { key };
      configuredPending.set(id, pending);
      pending.promise = toggle({ sensorType: current.sensorType, packageId: id, channelId: input.frame.channelId, enabled: true }, signature)
        .then(() => { if (configuredPending.get(id) === pending) configuredErrors.delete(id); })
        .catch((error) => { if (configuredPending.get(id) === pending) configuredErrors.set(id, { key, at: now(), message: error.message }); })
        .finally(() => { if (configuredPending.get(id) === pending) configuredPending.delete(id); });
    }
  }

  /** 结果仅保留包声明的有限数值；算法异常不会回写或中断标准帧发布。 */
  function execute(instance, item, { frame, matrix, inputError }) {
    if (instance.faulted || !item || (item.systemId && frame.displaySystemId !== item.systemId)) return;
    if (instance.retryAfter > now()) return;
    const values = inputValues(frame, item);
    if ((inputError && item.runtime !== RUNTIME) || incompatibility(item, matrix) || !Array.isArray(values) || values.length !== matrix.total || !values.every(Number.isFinite)) {
      instance.faulted = true; instance.status = 'error'; instance.error = '矩阵与算法输入不匹配，请检查线序与点数后重新启用';
      if (item.runtime === RUNTIME) void instance.runner.dispose(); return;
    }
    const timestamp = frame.timestamp;
    if (!Number.isFinite(timestamp)) return;
    // 同毫秒发布不代表倒序；仅跳过算法采样，不修改原帧或刷新有效数据接收时间。
    if (timestamp === instance.lastTimestamp) {
      if (item.runtime === RUNTIME) instance.dropped++;
      return;
    }
    const backwards = instance.lastTimestamp !== null && timestamp < instance.lastTimestamp;
    const interrupted = instance.lastTimestamp !== null && now() - instance.lastReceived > 2000;
    if (item.runtime !== RUNTIME && backwards) return;
    if (item.runtime !== RUNTIME && interrupted) {
      instance.faulted = true; instance.status = 'error'; instance.error = '数据中断，需停用后重新启用以重置算法窗口'; return;
    }
    const resetReason = backwards ? '数据时间戳倒序，正在重新积累分类窗口。'
      : interrupted ? '数据短时中断，正在重新积累分类窗口。' : '';
    if (resetReason) { instance.windowEpoch++; instance.history = []; instance.status = 'waiting'; instance.error = resetReason; }
    instance.lastTimestamp = timestamp; instance.lastReceived = now();
    const token = instance.token, windowEpoch = instance.windowEpoch;
    /** 迟到结果既核对系统也核对实例代次，错误窗口不能自行变回运行中。 */
    const owned = () => !closed && !instance.faulted && instances.get(instance.id)?.token === token && instance.windowEpoch === windowEpoch
      && contextKey === (frame.displaySystemId || frame.sensorType);
    const normalized = [...values];
    Promise.resolve().then(() => {
      if (!owned()) return null;
      if (instance.native) return { metrics: frame.payload.algorithmMetrics || frame.payload.metrics?.algorithm || {} };
      return instance.runner(normalized, { normalizedData: normalized, rawData: [...(frame.payload.stages?.decoded || values)], matrix: { ...matrix }, timestamp, resetReason, identity: { channelId: frame.channelId, sensorId: frame.sensorId, displaySystemId: frame.displaySystemId }, algorithm: item.resolvedPackage });
    }).then((result) => {
      if (!owned() || !result) return;
      if (result.pending) {
        if (result.reason) { instance.history = []; instance.status = 'waiting'; instance.error = result.reason; }
        else if (!instance.history.length && !instance.error.includes('已暂停识别')) { instance.status = 'waiting'; instance.error = `正在积累分类窗口：${result.buffered} / ${item.resolvedPackage.classifier.windowFrames} 帧`; }
        return;
      }
      const metrics = Object.fromEntries(item.metricDefinitions.filter(({ id }) => Number.isFinite(result.metrics?.[id])).map(({ id }) => [id, result.metrics[id]]));
      if (!Object.keys(metrics).length) {
        if (instance.native) { instance.status = 'waiting'; instance.error = '等待原生算法的标准指标输出'; return; }
        throw new Error('empty metrics');
      }
      const point = { timestamp, sequence: frame.sequence, metrics };
      if (item.runtime === RUNTIME || !instance.history.length || timestamp - instance.history.at(-1).timestamp >= 500) instance.history.push(point);
      else instance.history[instance.history.length - 1] = { ...point, timestamp: instance.history.at(-1).timestamp };
      if (instance.history.length > 120) instance.history.shift();
      instance.status = 'running'; instance.error = metrics.onbedFilterHealthy === 0 ? '生命体征算法不可用，CoP 仍独立输出' : '';
    }).catch((error) => {
      if (!owned()) return;
      if (item.runtime === RUNTIME) {
        if (error.code === 'ALGORITHM_REALTIME_RECOVERING') return;
        instance.faulted = true; instance.status = 'error'; instance.error = error.code === 'ALGORITHM_REALTIME_FAILED' ? error.message : '分类运行失败，请停用后重新启用。';
        instance.history = []; void instance.runner.dispose(); return;
      }
      if (error.code === 'DISPLAY_ALGORITHM_FRAME_DROPPED') { instance.dropped++; return; }
      instance.status = 'error'; instance.error = '算法运行失败，请检查 Python 运行库后停用重试';
      instance.retryAfter = now() + 1000;
    });
  }

  /** 总线回调只安排异步算法任务；自身异常也不能向发布者传播。 */
  function receive(event) {
    try {
      const current = context();
      const frame = event.payload;
      // ⚠️ Manifest 的 sensor.type 可以不同于展示系统 ID；按 canonical displaySystemId 判断归属，否则已绑定算法永远收不到帧。
      if (closed || !contextKey || frame?.type !== 'sensor.frame' || (frame.displaySystemId || frame.sensorType) !== current.sensorType || frame.source !== 'realtime' || !frame.payload) return;
      const input = { frame, receivedAt: now(), ...resolveMarketInput(frame, current.nativeSensorType || frame.sensorType) };
      channels.set(frame.channelId, input);
      if (channels.size > 32) channels.delete(channels.keys().next().value);
      for (const instance of instances.values()) if (instance.channelId === frame.channelId) execute(instance, catalog.get(instance.id), input);
      ensureConfigured(current, input);
    } catch { /* 保持标准帧通道独立。 */ }
  }
  const unsubscribe = channelBus.subscribe('*', receive);
  /** 装配状态异常时停用旁路，不能升级为 Electron 主进程未捕获异常。 */
  function tick() {
    if (closed) return;
    try { refreshCatalog(); context(); } catch {
      contextKey = ''; channels.clear();
      for (const id of instances.keys()) remove(id);
    }
  }
  const timer = schedule(tick, 1000);
  timer?.unref?.();
  return {
    snapshot, toggle,
    /** 必须先销毁会话算法，再停止全局 Python worker。 */
    async dispose() {
      closed = true; unsubscribe(); unschedule(timer); channels.clear();
      await Promise.all([...instances.keys()].map(remove).concat([...closing.values()]));
    },
  };
}

module.exports = { createAlgorithmMarketService, incompatibility };
