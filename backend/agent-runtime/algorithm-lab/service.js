const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { writeJsonAtomic, readJson } = require('../storage');
const { agentError } = require('../errors');
const { FEATURES, EXAMPLE, compile } = require('./restrictedPython');
const { realtimePackage } = require('./realtimeCatalog');
const { trainCpuClassifier } = require('./cpuTrainingProcess');
const { CPU_RUNTIME, validateCpuModel, modelDigest } = require('./cpuModel');
const { FEATURE_VERSION } = require('./spatialFeatures');

/** 计算配置及源码的稳定校验值，测试报告不能绑定到另一份代码。 */
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

/** 数值解释器在独立线程运行，超时、取消及内存限制均不依赖生成代码配合。 */
function compute(payload, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(agentError('AGENT_CANCELLED', '已停止算法测试。')); return; }
    const worker = new Worker(path.join(__dirname, 'worker.js'), { workerData: payload, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
    let finished = false;
    /** 所有完成路径释放 worker、定时器和取消监听。 */
    function finish(error, result) {
      if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); void worker.terminate();
      if (error) reject(error); else resolve(result);
    }
    /** 用户停止后立即终结隔离的计算线程。 */
    function abort() { finish(agentError('AGENT_CANCELLED', '已停止算法测试。')); }
    const timer = setTimeout(() => finish(agentError('ALGORITHM_TIMEOUT', '算法分析超过 10 秒，已停止。')), 10000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.on('message', (value) => finish(value.ok ? null : agentError('ALGORITHM_EVALUATION_FAILED', value.message), value.result));
    worker.on('error', () => finish(agentError('ALGORITHM_WORKER_FAILED', '算法线程异常或内存超限，已停止。')));
    worker.on('exit', () => { if (!finished) finish(agentError('ALGORITHM_WORKER_FAILED', '算法线程提前退出。')); });
  });
}

/** 管理选定数据的快照、数值源码测试与版本化算法库。 */
function createAlgorithmLab({ root, request, trainCpu = trainCpuClassifier }) {
  const snapshots = new Map(), attempts = new Map(), adaptations = new Map(), featureCache = new Map();
  const ledgerFile = path.join(root, 'algorithm-lab', 'validation-ledger.json');
  const ledger = readJson(ledgerFile, {});
  /** 仅允许宿主生成的文件标识进入工作目录。 */
  function file(kind, id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw agentError('ALGORITHM_ID_INVALID', '算法标识无效。');
    return path.join(root, 'algorithm-lab', kind, `${id}.json`);
  }
  /** 获取当前会话明确选中的数据范围，不接受模型替换选择。 */
  function selection(context) {
    const value = context.algorithmSelection;
    if (!value?.records?.length) throw agentError('ALGORITHM_SELECTION_REQUIRED', '请在本轮聊天中选择采集记录，已有标签会自动带入。');
    return value;
  }
  /** 按有界分页取数并固定本次记录摘要，原始压力数组只留本机。 */
  async function load(context) {
    const chosen = selection(context), key = digest(chosen);
    const catalog = await request('/api/agent-algorithms/records', { ...context, method: 'POST', body: { offset: chosen.catalogOffset || 0 } });
    if (catalog.systemId !== chosen.systemId) throw agentError('ALGORITHM_SYSTEM_CHANGED', '当前系统已变化，请重新选择算法数据。');
    for (const item of chosen.records) {
      const current = catalog.records.find((record) => record.id === item.id);
      if (!current || current.maxId !== item.maxId || current.count !== item.count) throw agentError('ALGORITHM_RECORD_CHANGED', '选中记录已变化，请重新选择数据。');
    }
    if (snapshots.has(key)) return snapshots.get(key);
    const records = []; let values = 0;
    for (const item of chosen.records) {
      const frames = [];
      for (let offset = item.startFrame; offset < item.startFrame + item.frameLimit;) {
        context.signal?.throwIfAborted();
        const pageSize = frames.length ? Math.max(1, Math.min(8, Math.floor(1000000 / (frames[0].values.length * 32)))) : 1;
        const limit = Math.min(pageSize, item.startFrame + item.frameLimit - offset);
        const page = await request('/api/agent-algorithms/frames', { ...context, method: 'POST', body: { systemId: chosen.systemId, recordId: item.id, maxId: item.maxId, offset, limit } });
        if (!page.frames?.length) throw agentError('ALGORITHM_RECORD_CHANGED', '所选帧范围不完整，请刷新数据选择。');
        for (const frame of page.frames) { values += frame.values.length; if (values > 2000000) throw agentError('ALGORITHM_DATA_LIMIT', '本次超过 200 万压力数值，请缩小选择范围。'); }
        frames.push(...page.frames); offset += page.frames.length;
      }
      records.push({ ...item, frames });
    }
    const loaded = { key, records, dataDigest: digest(records), labels: [...new Set(chosen.records.filter((item) => item.split === 'development').map((item) => item.label))], windowFrames: chosen.windowFrames };
    snapshots.clear(); snapshots.set(key, loaded); return loaded;
  }
  /** 仅在同一任务和数据选择内沿用宿主实测的目标采样间隔。 */
  function activeAdaptation(context, loaded) {
    const adaptation = adaptations.get(context.taskId || 'manual');
    if (adaptation && (adaptation.selectionKey !== loaded.key || Date.now() - adaptation.measuredAt >= 10 * 60 * 1000)) {
      throw agentError('ALGORITHM_ADAPTATION_STALE', '适配测量已过期或选择的数据发生变化，请重新测量当前设备后再测试算法。');
    }
    return adaptation || null;
  }
  /** 开始新的设备测量时清除旧目标，失败后不能沿用上次帧率。 */
  function clearAdaptation(context) { adaptations.delete(context.taskId || 'manual'); }
  /** 按当前设备节奏重建已选标签数据的特征窗口，原始压力帧保持不变。 */
  async function adapt(context, { sensorId, measuredIntervalMs }) {
    const loaded = await load(context);
    if (loaded.records.some((record) => record.channel !== sensorId)) throw agentError('ALGORITHM_CHANNEL_MISMATCH', '所选采集记录必须全部来自当前要绑定的同一传感器通道。');
    const sourceIntervals = loaded.records.map((record) => {
      const deltas = record.frames.slice(1).map((frame, index) => frame.timestamp - record.frames[index].timestamp).filter((delta) => delta > 0 && delta <= 5000).sort((a, b) => a - b);
      if (!deltas.length) throw agentError('ALGORITHM_DATA_CADENCE', `记录“${record.date || record.id}”缺少可计算的采样间隔。`);
      return { id: record.id, medianIntervalMs: deltas[Math.floor(deltas.length / 2)] };
    });
    const targetIntervalMs = Math.max(measuredIntervalMs, ...sourceIntervals.map((item) => item.medianIntervalMs));
    if (!Number.isFinite(targetIntervalMs) || targetIntervalMs <= 0 || targetIntervalMs > 5000) throw agentError('ALGORITHM_DATA_CADENCE', '实测采样间隔超出算法工作台的适配范围。');
    const result = await compute({ ...loaded, targetIntervalMs }, context.signal);
    adaptations.set(context.taskId || 'manual', { selectionKey: loaded.key, measuredAt: Date.now(), targetIntervalMs, sensorId });
    while (adaptations.size > 100) adaptations.delete(adaptations.keys().next().value);
    return { ...result, labels: loaded.labels, dataDigest: loaded.dataDigest,
      adaptation: { sensorId, measuredIntervalMs, targetIntervalMs, sourceIntervals, method: 'nearest-real-frame',
        explanation: '按当前设备与已选记录中较慢的节奏选择真实压力帧；不插值、不补造峰值。后续 analyze_algorithm_data 和 test_algorithm 沿用此目标节奏。' } };
  }
  /** 返回语言契约、选择范围及已安装算法，不读取用户未选择的帧。 */
  function workspace(context) {
    const directory = path.join(root, 'algorithm-lab', 'installed');
    const installed = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => /^[A-Za-z0-9_-]+\.json$/.test(name)).slice(-100).flatMap((name) => {
      try {
        const item = readJson(path.join(directory, name), null);
        const systemId = context.currentSystemId || context.algorithmSelection?.systemId;
        if (!systemId || item?.systemId !== systemId) return [];
        const realtime = realtimePackage(item);
        return [{ id: item.id, name: item.name, language: item.language, source: item.source, labels: item.labels,
          ...(item.model ? { modelSummary: { kind: item.model.kind, featureNames: item.model.featureNames }, report: { ...item.report, predictions: item.report.predictions?.slice(0, 30) } } : { report: item.report }),
          realtimePackageId: realtime?.id || null, realtimeStatus: realtime ? '已进入实时算法目录；启用前需核验当前设备的采样节奏' : '旧版本缺少实时输入契约；用原源码在已选数据上重新测试并保存新版本即可登记' }];
      } catch { return []; }
    }) : [];
    return { language: CPU_RUNTIME, languages: [CPU_RUNTIME, 'restricted-python-v1'], features: FEATURES, example: EXAMPLE, instructions: '优先调用 train_algorithm 在本机比较 CPU 分类器，自动选择和保存有真实报告的模型草稿；不需要模型手写阈值或导入库。只有用户明确要求自定义规则时才用受限 def predict(f)：四空格缩进；局部数值赋值、if/elif/else、return、算术与比较、and/or/not、abs/min/max/sqrt。特征键使用双引号。返回按开发集 labels 顺序的 0 基类别下标，不确定返回 -1。不支持 import、循环、文件、网络或安装库。', selection: context.algorithmSelection || null, installed,
      training: { available: true, tool: 'train_algorithm', runtime: CPU_RUNTIME, featureVersion: FEATURE_VERSION, execution: 'local single-thread CPU process', candidates: ['linear', 'tree', 'forest'], timeoutSeconds: 60, maxWindows: 16000, featureCache: 'same selected data and input contract only', validation: 'grouped by collection session; insufficient groups are explicitly development-only', onlySelectedRanges: true },
      recordSemantics: 'count 是本记录存储帧数；maxId 是数据库全局行 ID 的读取上界，不是本记录帧数，不能据 maxId 大于 count 推断缺口、丢帧或时间异常。startFrame 是记录内从 0 开始的位置，frameLimit 是原始读取数量。连续性必须以实际分析结果为准：同毫秒采样仅用于分析时跳过并报告数量；真正倒序或超过 5 秒的断点会返回具体记录和帧位置。不要仅凭这些元数据建议删除或重采记录。',
      limits: { maxValues: 2000000, restrictedRuleWorker: { maxSourceChars: 16000, maxAttemptsPerTask: 6, computeTimeoutSeconds: 10, memoryMiB: 128 } },
      featureUnits: 'duration 秒；压力特征使用存储值原单位，rise/fall 为每秒变化；activeMean 为值>0的点数均值；meanChange 为相邻帧总值绝对差均值。' };
  }
  /** 分析只返回开发集统计；验证数据仅在冻结代码后运行一次。 */
  async function analyze(context) {
    const loaded = await load(context), adaptation = activeAdaptation(context, loaded);
    return { ...await compute({ ...loaded, ...(adaptation ? { targetIntervalMs: adaptation.targetIntervalMs } : {}) }, context.signal),
      labels: loaded.labels, dataDigest: loaded.dataDigest, ...(adaptation ? { adaptation: { sensorId: adaptation.sensorId, targetIntervalMs: adaptation.targetIntervalMs } } : {}) };
  }
  /** 运行开发测试或独立验证并将真实报告与源码一起固定到磁盘。 */
  async function test({ source, name, validation = false }, context) {
    compile(source);
    const loaded = await load(context), adaptation = activeAdaptation(context, loaded), taskKey = context.taskId || 'manual';
    const count = (attempts.get(taskKey) || 0) + 1;
    if (count > 6) throw agentError('ALGORITHM_ATTEMPT_LIMIT', '本任务已运行 6 次算法测试，请检查报告后再开新任务。');
    attempts.set(taskKey, count); while (attempts.size > 100) attempts.delete(attempts.keys().next().value);
    const validationKeys = [...new Set(loaded.records.filter((item) => item.split === 'validation').map((item) => digest([item.systemId, item.date])))];
    if (validation && validationKeys.some((key) => Object.hasOwn(ledger, key))) throw agentError('ALGORITHM_VALIDATION_USED', '这批验证数据已用于评估，继续调参应作为开发数据；请选择新的独立验证记录。');
    if (validation && loaded.labels.some((label) => !loaded.records.some((item) => item.split === 'validation' && item.label === label))) throw agentError('ALGORITHM_VALIDATION_MISSING', '独立验证集需要覆盖开发集的全部类别。');
    if (validation) {
      if (Object.keys(ledger).length > 10000) throw agentError('ALGORITHM_HISTORY_LIMIT', '独立验证记录已达上限，请联系维护人员归档。');
      for (const key of validationKeys) ledger[key] = new Date().toISOString();
      writeJsonAtomic(ledgerFile, ledger);
    }
    const evaluated = await compute({ ...loaded, ...(adaptation ? { targetIntervalMs: adaptation.targetIntervalMs } : {}), source, split: validation ? 'validation' : 'development' }, context.signal);
    const report = { ...evaluated,
      dataDigest: loaded.dataDigest, sourceDigest: digest(source), windowFrames: loaded.windowFrames,
      records: loaded.records.filter((item) => item.split === (validation ? 'validation' : 'development')).map(({ id, date, channel, label, startFrame, frameLimit }) => ({
        ...evaluated.records.find((record) => record.id === id), id, date, channel, label, startFrame, frameLimit })) };
    const id = randomUUID();
    const draft = { id, name, source, language: 'restricted-python-v1', systemId: selection(context).systemId, selectionDigest: loaded.key, dataDigest: loaded.dataDigest,
      labels: loaded.labels, windowFrames: loaded.windowFrames, report, createdAt: new Date().toISOString() };
    writeJsonAtomic(file('drafts', id), draft);
    return { draftId: id, name, ...report, predictions: report.predictions.slice(0, 30), predictionsTruncated: report.predictions.length > 30,
      warning: validation ? '验证数据已用于本次评估，不能重复调参后继续称为独立验证；报告仅反映选定记录。' : '仅开发集结果，尚未进行独立验证，不能据此宣称泛化准确率。' };
  }
  /** 使用已授权范围训练固定 CPU 模型，特征留本机，验证记录不参与模型选择。 */
  async function train({ name }, context, { matrix = null, validateInput } = {}) {
    const loaded = await load(context), adaptation = activeAdaptation(context, loaded);
    const key = digest([loaded.dataDigest, loaded.windowFrames, FEATURE_VERSION, matrix, adaptation?.targetIntervalMs]);
    context.onStep?.({ message: featureCache.has(key) ? '复用本机缓存特征，准备 CPU 分类训练。' : '正在从所选范围提取统一窗口特征。' });
    let prepared = featureCache.get(key);
    if (!prepared) {
      prepared = await compute({ ...loaded, operation: 'features', featureVersion: FEATURE_VERSION, matrix,
        ...(adaptation ? { targetIntervalMs: adaptation.targetIntervalMs } : {}) }, context.signal);
      featureCache.set(key, prepared); while (featureCache.size > 2) featureCache.delete(featureCache.keys().next().value);
    }
    if (!prepared.windows?.length) throw agentError('CPU_TRAINING_DATA_INVALID', '所选范围没有完整窗口，请增加连续数据或缩小窗口。');
    const validationRecords = loaded.records.filter((item) => item.split === 'validation');
    const validationKeys = [...new Set(validationRecords.map((item) => digest([selection(context).systemId, item.date])))];
    if (validationKeys.some((key) => Object.hasOwn(ledger, key))) throw agentError('ALGORITHM_VALIDATION_USED', '这批验证采集已用于评估，请选择新的独立验证记录。');
    if (validationRecords.length && loaded.labels.some((label) => !validationRecords.some((item) => item.label === label))) throw agentError('ALGORITHM_VALIDATION_MISSING', '独立验证记录需要覆盖全部类别。');
    if (validationKeys.length) {
      if (Object.keys(ledger).length + validationKeys.length > 10000) throw agentError('ALGORITHM_HISTORY_LIMIT', '独立验证记录已达上限，请联系维护人员归档。');
      for (const validationKey of validationKeys) ledger[validationKey] = new Date().toISOString();
      writeJsonAtomic(ledgerFile, ledger);
    }
    const names = Object.keys(prepared.windows[0].features);
    const records = new Map(loaded.records.map((record) => [record.id, record]));
    const windows = prepared.windows.map((window) => {
      const record = records.get(window.recordId);
      return { features: names.map((key) => window.features[key]), label: loaded.labels.indexOf(window.label),
        group: digest([selection(context).systemId, record.date]), split: window.split,
        recordId: window.recordId, startFrame: window.startFrame, timestamp: window.timestamp };
    });
    context.onStep?.({ message: '正在本机单线程比较线性、决策树和随机森林；可以停止本轮任务。' });
    let trained;
    try { trained = await trainCpu({ schemaVersion: 1, featureNames: names, labels: loaded.labels, windows, mode: 'quick', minConfidence: 0.55 }, { signal: context.signal }); }
    catch (error) {
      if (validationKeys.length) error.message += ' 本轮验证采集已登记使用；再次独立验证需选择新采集，也可仅用开发集训练。';
      throw error;
    }
    context.signal?.throwIfAborted();
    const model = validateCpuModel(trained.model);
    if (JSON.stringify(model.featureNames) !== JSON.stringify(names) || JSON.stringify(model.classLabels) !== JSON.stringify(loaded.labels)) throw agentError('CPU_TRAINING_RESULT_INVALID', '训练结果与所选类别或特征不一致，未保存。');
    const evaluated = trained.report;
    if (!evaluated || !['development', 'validation'].includes(evaluated.split) || !Number.isInteger(evaluated.windows) || evaluated.windows < 1 || !Array.isArray(evaluated.predictions)
      || !Number.isFinite(evaluated.accuracy) || evaluated.accuracy < 0 || evaluated.accuracy > 1) throw agentError('CPU_TRAINING_RESULT_INVALID', '训练报告不完整，未保存。');
    // ⚠️ 长时间训练期间切系统或采集增长会使选择失效，不能把旧模型保存到新系统。
    await load(context); await validateInput?.(); context.signal?.throwIfAborted();
    const reference = prepared.windows.filter((window) => window.split === 'development');
    const sampleIntervalMs = adaptation?.targetIntervalMs || reference.reduce((sum, window) => sum + window.features.duration * 1000 / (window.features.frameCount - 1), 0) / reference.length;
    const report = { ...evaluated, candidates: trained.candidates || evaluated.candidates || [], dataDigest: loaded.dataDigest,
      warnings: [...(evaluated.warnings || []), ...(!prepared.matrix ? ['当前系统未提供可匹配的矩阵，只使用整体压力特征；左右或前后位置识别需核对系统矩阵配置。'] : [])],
      modelDigest: modelDigest(model), windowFrames: loaded.windowFrames,
      inputContract: { pointCount: prepared.pointCount, stage: prepared.stage, sampleIntervalMs, featureVersion: FEATURE_VERSION, matrix: prepared.matrix || null },
      records: loaded.records.map(({ id, date, channel, label, split, startFrame, frameLimit }) => ({ ...prepared.records.find((record) => record.id === id), id, date, channel, label, split, startFrame, frameLimit })),
      ...(adaptation ? { preprocessing: { mode: 'nearest-real-frame', targetIntervalMs: adaptation.targetIntervalMs, source: 'measured-current-device', noInterpolation: true } } : {}) };
    const id = randomUUID();
    const draft = { id, name, language: CPU_RUNTIME, model, featureVersion: FEATURE_VERSION, matrix: prepared.matrix || null,
      systemId: selection(context).systemId, selectionDigest: loaded.key, dataDigest: loaded.dataDigest,
      labels: loaded.labels, windowFrames: loaded.windowFrames, report, createdAt: new Date().toISOString() };
    if (!realtimePackage(draft)) throw agentError('CPU_TRAINING_RESULT_INVALID', '模型输入契约未通过校验，未保存。');
    writeJsonAtomic(file('drafts', id), draft);
    context.onStep?.({ message: '本机训练完成，已生成真实评估报告；保存后可绑定当前系统。' });
    return { draftId: id, name, language: CPU_RUNTIME, modelSummary: { kind: model.kind, featureNames: names }, ...report,
      predictions: report.predictions.slice(0, 30), predictionsTruncated: report.predictions.length > 30,
      warning: report.evaluation === 'independent-validation' ? '仅代表所选独立采集的验证效果，尚未启用实时识别。' : '未提供新的独立验证采集；交叉验证或开发集结果不能代替真实设备验收。' };
  }
  /** 只允许为当前选择真实测试过的固定源码生成应用提案。 */
  function proposal({ draftId }, context) {
    const draft = readJson(file('drafts', draftId), null);
    if (!draft || draft.selectionDigest !== digest(selection(context))) throw agentError('ALGORITHM_DRAFT_STALE', '算法草稿不属于当前数据选择，请重新测试。');
    const { predictions, ...report } = draft.report;
    if (draft.language === CPU_RUNTIME) report.mistakes = (predictions || []).filter((item) => !item.correct).slice(0, 10);
    const realtime = realtimePackage(draft);
    return { kind: 'algorithm_package', systemId: draft.systemId, summary: `保存算法“${draft.name}”${realtime ? '并登记到实时算法目录' : '到离线算法库'}`, input: { draftId }, draftDigest: digest(draft),
      after: { name: draft.name, language: draft.language, labels: draft.labels, source: draft.source,
        ...(draft.model ? { modelSummary: { kind: draft.model.kind, featureNames: draft.model.featureNames }, featureVersion: draft.featureVersion } : {}), report, realtimePackageId: realtime?.id || null,
        activation: realtime ? '保存后可在当前系统配置算法；首次启用时需有兼容的实时设备输入，Agent 会在准备和应用配置时核验。' : '此版本缺少实时输入契约，保存后可继续离线测试。' } };
  }
  /** 原子保存经测试版本，重复应用相同草稿幂等且不覆盖其他算法。 */
  function apply(proposal) {
    const draft = readJson(file('drafts', proposal.input?.draftId), null);
    if (!draft || digest(draft) !== proposal.draftDigest || draft.systemId !== proposal.systemId) throw agentError('ALGORITHM_DRAFT_STALE', '算法源码或测试报告已变化，不能应用旧提案。');
    if (draft.language === CPU_RUNTIME) { validateCpuModel(draft.model); if (!realtimePackage(draft)) throw agentError('ALGORITHM_DRAFT_STALE', '训练模型或输入契约无效，请重新训练。'); }
    else compile(draft.source);
    writeJsonAtomic(file('installed', draft.id), draft);
    const saved = readJson(file('installed', draft.id), null);
    if (digest(saved) !== digest(draft)) throw agentError('AGENT_OPERATION_UNCERTAIN', '算法保存后读回不一致，请检查算法库。');
    const realtime = realtimePackage(saved);
    return { id: draft.id, systemId: draft.systemId, verified: true, offlineOnly: !realtime, realtimePackageId: realtime?.id || null, realtimeEnabled: false, independentValidation: draft.report.split === 'validation' };
  }
  return { workspace, analyze, adapt, clearAdaptation, test, train, proposal, apply };
}

module.exports = { createAlgorithmLab, compute, digest };
