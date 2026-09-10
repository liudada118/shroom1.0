const { createPythonAlgorithmRunner } = require('../../kernel/algorithm-channel/displaySystemAlgorithmRunner');
const { SENSOR_DEFINITIONS } = require('@shroom/backend/sensors');

/** 解析算法输入尺寸；旧帧只借用已登记的本系统通道定义，不猜方阵、不改标准帧。 */
function resolveMarketInput(frame) {
  let matrix = frame.payload.matrix;
  if (matrix == null && frame.displaySystemId === frame.sensorType) {
    // ⚠️ getSensorDefinition 对未知型号会默认返回 32×32，此处必须只查显式登记项。
    const definition = Object.hasOwn(SENSOR_DEFINITIONS, frame.sensorType) ? SENSOR_DEFINITIONS[frame.sensorType] : null;
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
function createAlgorithmMarketService({ channelBus, packages = [], getContext, createRunner = createPythonAlgorithmRunner, now = Date.now, schedule = setInterval, unschedule = clearInterval }) {
  const catalog = new Map(packages.map((item) => [item.id, item]));
  const channels = new Map();
  const instances = new Map();
  const closing = new Map();
  let contextKey = '';
  let generation = 0;
  let closed = false;

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
      for (const id of instances.keys()) remove(id);
    }
    for (const id of value.reservedPackageIds || []) remove(id);
    return value;
  }

  /** 转成安全的公开摘要，绝不下发入口文件、资源路径或 Python 源码。 */
  function snapshot() {
    const current = context();
    return {
      sensorType: current.sensorType,
      allowed: !closed && current.allowed && !current.playback,
      reason: closed ? '服务已停止' : !current.allowed ? '请先激活授权' : current.playback ? '会话算法仅用于实时数据，回放沿用原系统算法' : '',
      packages: packages.map(({ id, name, description, metricDefinitions, compatibility, sampleRateHz }) => ({
        id, name, description, metricDefinitions, compatibility, sampleRateHz,
        reserved: (current.reservedPackageIds || []).includes(id),
      })),
      channels: [...channels.values()].map(({ frame, receivedAt, matrix, inputError }) => ({ channelId: frame.channelId, label: frame.sensorLabel || frame.sensorId || frame.channelId, matrix, inputError, live: now() - receivedAt < 2000 })),
      instances: [...instances.values()].map(({ id, channelId, token, status, error, history, dropped, lastReceived }) => ({ id, channelId, token, status: status !== 'error' && now() - lastReceived > 2000 ? 'waiting' : status, error, history, dropped })),
    };
  }

  /** 拒绝不可执行的请求，错误文本只包含用户可理解的限制。 */
  function fail(message, httpStatus = 409) {
    const error = new Error(message); error.httpStatus = httpStatus; throw error;
  }

  /** 按已收帧的通道启停受信包，重复点击幂等，销毁完成前不能重建同一 Python 模块。 */
  async function toggle({ sensorType, packageId, channelId, enabled } = {}) {
    if (typeof enabled !== 'boolean') fail('enabled 必须是布尔值', 400);
    const current = context();
    if (closed || !current.allowed) fail('当前不可启用算法', 403);
    if (sensorType !== current.sensorType) fail('系统已切换，请刷新算法超市');
    if (!catalog.has(packageId)) fail('算法包不存在', 404);
    if (!enabled) { await remove(packageId); return snapshot(); }
    if (current.playback) fail('请切换到实时模式后启用');
    if ((current.reservedPackageIds || []).includes(packageId)) fail('当前系统已内置运行此算法，请使用原有算法设置');
    const selected = channels.get(channelId);
    if (!selected || now() - selected.receivedAt > 2000) fail('此通道尚未收到实时数据，请先连接传感器');
    if (selected.inputError) fail(selected.inputError);
    const item = catalog.get(packageId);
    const reason = incompatibility(item, selected.matrix);
    if (reason) fail(reason);
    const selectedValues = selected.frame.payload.stages?.normalized || selected.frame.payload.value;
    if (!Array.isArray(selectedValues) || selectedValues.length !== selected.matrix.total || !selectedValues.every(Number.isFinite)) fail('当前帧数据不完整，请检查协议和线序后重试');
    const existing = instances.get(packageId);
    if (existing) {
      if (existing.channelId !== channelId) fail('此算法已在另一通道运行，请先停用');
      return snapshot();
    }
    await closing.get(packageId);
    const latestContext = context();
    if (latestContext.sensorType !== sensorType || !contextKey || closed || (latestContext.reservedPackageIds || []).includes(packageId)) fail('当前系统状态已变化，请重试');
    if (!channels.has(channelId) || now() - channels.get(channelId).receivedAt > 2000) fail('传感器数据已中断，请重新连接后启用');
    if (instances.has(packageId)) return toggle({ sensorType, packageId, channelId, enabled });
    const runner = createRunner({ entry: item.resolvedPackage.resolvedEntry, algorithmPackage: item.resolvedPackage, timeoutMs: 3000 });
    instances.set(packageId, { id: packageId, channelId, runner, token: ++generation, status: 'waiting', error: '', history: [], dropped: 0, lastReceived: now(), lastTimestamp: null });
    return snapshot();
  }

  /** 结果仅保留包声明的有限数值；算法异常不会回写或中断标准帧发布。 */
  function execute(instance, item, { frame, matrix, inputError }) {
    if (instance.faulted) return;
    if (instance.retryAfter > now()) return;
    const values = frame.payload.stages?.normalized || frame.payload.value;
    if (inputError || incompatibility(item, matrix) || !Array.isArray(values) || values.length !== matrix.total || !values.every(Number.isFinite)) {
      instance.faulted = true; instance.status = 'error'; instance.error = '矩阵与算法输入不匹配，请检查线序与点数后重新启用'; return;
    }
    const timestamp = frame.timestamp;
    if (!Number.isFinite(timestamp)) return;
    if (instance.lastTimestamp !== null && timestamp <= instance.lastTimestamp) return;
    if (instance.lastTimestamp !== null && now() - instance.lastReceived > 2000) {
      instance.faulted = true; instance.status = 'error'; instance.error = '数据中断，需停用后重新启用以重置算法窗口'; return;
    }
    instance.lastTimestamp = timestamp; instance.lastReceived = now();
    const token = instance.token;
    /** 迟到结果既核对系统也核对实例代次，错误窗口不能自行变回运行中。 */
    const owned = () => !closed && !instance.faulted && instances.get(instance.id)?.token === token && contextKey === frame.sensorType;
    const normalized = [...values];
    Promise.resolve().then(() => {
      if (!owned()) return null;
      return instance.runner(normalized, { normalizedData: normalized, rawData: [...(frame.payload.stages?.decoded || values)], matrix: { ...matrix }, timestamp, identity: { channelId: frame.channelId, sensorId: frame.sensorId, displaySystemId: frame.displaySystemId }, algorithm: item.resolvedPackage });
    }).then((result) => {
      if (!owned() || !result) return;
      const metrics = Object.fromEntries(item.metricDefinitions.filter(({ id }) => Number.isFinite(result.metrics?.[id])).map(({ id }) => [id, result.metrics[id]]));
      if (!Object.keys(metrics).length) throw new Error('empty metrics');
      const point = { timestamp, sequence: frame.sequence, metrics };
      if (!instance.history.length || timestamp - instance.history.at(-1).timestamp >= 500) instance.history.push(point);
      else instance.history[instance.history.length - 1] = { ...point, timestamp: instance.history.at(-1).timestamp };
      if (instance.history.length > 120) instance.history.shift();
      instance.status = 'running'; instance.error = metrics.onbedFilterHealthy === 0 ? '生命体征算法不可用，CoP 仍独立输出' : '';
    }).catch((error) => {
      if (!owned()) return;
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
      if (closed || !contextKey || frame?.type !== 'sensor.frame' || frame.sensorType !== current.sensorType || frame.source !== 'realtime' || !frame.payload) return;
      const input = { frame, receivedAt: now(), ...resolveMarketInput(frame) };
      channels.set(frame.channelId, input);
      if (channels.size > 32) channels.delete(channels.keys().next().value);
      for (const instance of instances.values()) if (instance.channelId === frame.channelId) execute(instance, catalog.get(instance.id), input);
    } catch { /* 保持标准帧通道独立。 */ }
  }
  const unsubscribe = channelBus.subscribe('*', receive);
  /** 装配状态异常时停用旁路，不能升级为 Electron 主进程未捕获异常。 */
  function tick() {
    if (closed) return;
    try { context(); } catch {
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
