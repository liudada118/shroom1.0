const assert = require('assert');
const path = require('path');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { createAlgorithmMarketService } = require('../../extension-host/runtime/algorithmMarketService');
const { discoverBuiltinAlgorithmPackages } = require('../../extension-host/manifest/builtinAlgorithmPackageCatalog');
const { createSit1024FrameProcessor } = require('../../extensions/built-in-sensors/sit1024FrameProcessor');
const { createRealtimeTelemetryGateway } = require('../../kernel/realtime/realtimeTelemetryGateway');
const { jqbed } = require('@shroom/backend/processing/lineOrders.js');

/** 排空本测试的 Promise 回调，不启动真实 Python 或串口。 */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** 所有测试输入都是显式模拟帧，生产代码不得生成这份数据。 */
function frame(timestamp = 1000, channelId = 'mat:seat', total = 1024) {
  return { type: 'sensor.frame', sensorType: 'mat', source: 'realtime', channelId, displaySystemId: 'mat', sensorId: 'seat', timestamp, sequence: timestamp,
    payload: { matrix: { rows: 32, cols: total / 32, total }, value: Array(total).fill(2), stages: { normalized: Array(total).fill(3), decoded: Array(total).fill(4) } } };
}

/** 模拟实际包目录、当前系统、单通道总线和可控制的异步运行器。 */
function fixture() {
  const packages = discoverBuiltinAlgorithmPackages({ roots: [path.resolve(__dirname, '../../../agent-resources/algorithm-packages')], includeResolved: true }).packages;
  const bus = createChannelBus();
  let current = { sensorType: 'mat', allowed: true, playback: false, reservedPackageIds: [] };
  let time = 1000;
  const calls = [];
  const runners = [];
  const service = createAlgorithmMarketService({ channelBus: bus, packages, getContext: () => current, now: () => time, schedule: () => null, unschedule: () => {}, createRunner: (options) => {
    const run = (values, context) => new Promise((resolve, reject) => calls.push({ values, context, resolve, reject }));
    run.dispose = async () => { run.disposed = true; }; run.options = options; runners.push(run); return run;
  } });
  return { service, bus, calls, runners, packages, setContext: (value) => { current = { ...current, ...value }; }, setTime: (value) => { time = value; } };
}

(async () => {
  const { service, bus, calls, runners, setContext, setTime } = fixture();
  const request = { sensorType: 'mat', packageId: 'mattress-vitals', channelId: 'mat:seat', enabled: true };
  assert.equal(service.snapshot().packages.length, 4);
  assert(!JSON.stringify(service.snapshot()).includes('resolvedEntry'));
  assert(!JSON.stringify(service.snapshot()).includes('algorithmSource'));
  await assert.rejects(service.toggle(request), /尚未收到/);
  const incomplete = frame(); incomplete.payload.stages.normalized = [1];
  bus.publish(incomplete.channelId, incomplete);
  await assert.rejects(service.toggle(request), /不完整/);
  const original = frame(); const copy = JSON.stringify(original);
  bus.publish(original.channelId, original);
  await assert.rejects(service.toggle({ ...request, packageId: 'foot-pressure-realtime' }), /需要 4096/);
  await assert.rejects(service.toggle({ ...request, packageId: '../algorithm.py' }), /不存在/);
  await assert.rejects(service.toggle({ ...request, enabled: 'yes' }), /布尔/);
  await Promise.all([service.toggle(request), service.toggle(request)]);
  assert.equal(runners.length, 1, '并发启用幂等');
  bus.publish(original.channelId, original); await settle();
  assert.deepEqual(calls[0].values, Array(1024).fill(3));
  assert.deepEqual(calls[0].context.rawData, Array(1024).fill(4));
  calls[0].values[0] = 999;
  assert.equal(JSON.stringify(original), copy, '算法不能修改源帧');
  calls[0].resolve({ metrics: { respirationRate: -1, copX: 12, onbedFilterHealthy: 0, secret: 12 } }); await settle();
  assert.equal(service.snapshot().instances[0].history[0].metrics.secret, undefined);
  assert.equal(service.snapshot().instances[0].history[0].metrics.copX, 12);
  assert.match(service.snapshot().instances[0].error, /CoP/);
  bus.publish('mat:back', frame(1020, 'mat:back'));
  await assert.rejects(service.toggle({ ...request, channelId: 'mat:back' }), /另一通道/);
  bus.publish('mat:seat', frame(1040)); await settle();
  calls.at(-1).reject(Object.assign(new Error(), { code: 'DISPLAY_ALGORITHM_FRAME_DROPPED' })); await settle();
  assert.equal(service.snapshot().instances[0].dropped, 1);
  bus.publish('mat:seat', frame(1060)); await settle();
  calls.at(-1).reject(new Error('secret absolute path')); await settle();
  assert.match(service.snapshot().instances[0].error, /运行失败/);
  assert(!JSON.stringify(service.snapshot()).includes('secret absolute path'));
  setTime(2000);
  bus.publish('mat:seat', frame(1080)); await settle();
  const late = calls.at(-1);
  await service.toggle({ ...request, enabled: false });
  late.resolve({ metrics: { copX: 999 } }); await settle();
  assert.equal(service.snapshot().instances.length, 0);
  assert(runners[0].disposed);
  await service.toggle(request);
  setContext({ sensorType: 'other' });
  assert.equal(service.snapshot().instances.length, 0);
  assert.equal(service.snapshot().channels.length, 0);
  setContext({ sensorType: 'mat', reservedPackageIds: ['mattress-vitals'] });
  bus.publish('mat:seat', frame(1100));
  await assert.rejects(service.toggle(request), /已内置/);
  setContext({ reservedPackageIds: [], playback: true });
  await assert.rejects(service.toggle(request), /实时/);
  setContext({ playback: false, allowed: false });
  await assert.rejects(service.toggle(request), /不可启用/);
  setContext({ allowed: true });
  bus.publish('mat:seat', { ...frame(1120), source: 'playback' });
  assert.equal(service.snapshot().channels.length, 0);
  bus.publish('mat:seat', frame(1140));
  await service.toggle(request);
  bus.publish('mat:seat', frame(1160)); await settle();
  calls.at(-1).resolve({ metrics: { copX: 1 } }); await settle();
  setTime(5000); bus.publish('mat:seat', frame(5000)); await settle();
  assert.match(service.snapshot().instances[0].error, /中断/);
  await service.dispose();
  assert.equal(service.snapshot().instances.length, 0);
  await assert.rejects(service.toggle(request), /不可启用/);
  const bounded = fixture();
  bounded.bus.publish('mat:seat', frame());
  await bounded.service.toggle(request);
  for (let index = 0; index < 125; index++) {
    const stamp = 1000 + index * 500;
    bounded.setTime(stamp); bounded.bus.publish('mat:seat', frame(stamp)); await settle();
    bounded.calls.at(-1).resolve({ metrics: { copX: index } }); await settle();
  }
  assert.equal(bounded.service.snapshot().instances[0].history.length, 120, '标量历史不能无限增长');
  assert.equal(bounded.service.snapshot().instances[0].history.at(-1).metrics.copX, 124);
  bounded.bus.publish('mat:seat', frame(64000, 'mat:seat', 256)); await settle();
  assert.match(bounded.service.snapshot().instances[0].error, /不匹配/);
  await bounded.service.dispose();
  // 从真实旧处理器和标准网关走到算法超市，不能手填 matrix 掩盖旧帧缺失元数据的问题。
  const legacy = fixture();
  legacy.setContext({ sensorType: 'hand' });
  const processor = createSit1024FrameProcessor({ jqbed, isCar: () => false, isSmallBedMatrixType: () => false, isPetCareSystem: () => false });
  const processed = processor.processFrame(Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 256)), { file: 'hand', colHZ: 49 });
  const gateway = createRealtimeTelemetryGateway({ channelBus: legacy.bus, getSensorType: () => 'hand', wsSubscriptions: { publish: () => 0 } });
  const published = gateway.publishRealtimeFrame('sit', processed.jsonData, { timestamp: 1000 }).frame;
  assert.equal(published.payload.matrix, null, '生产旧手垫帧确实未携带 matrix');
  const wireCopy = JSON.stringify(published);
  const input = legacy.service.snapshot().channels[0];
  assert.equal(input.channelId, 'hand:sit');
  assert.deepEqual(input.matrix, { rows: 32, cols: 32, total: 1024 });
  assert.equal(input.inputError, '');
  const legacyRequest = { sensorType: 'hand', packageId: 'mattress-vitals', channelId: 'hand:sit', enabled: true };
  await legacy.service.toggle(legacyRequest);
  legacy.bus.publish(published.channelId, published); await settle();
  assert.deepEqual(legacy.calls[0].values, JSON.parse(processed.jsonData).sitData, '实际线序后的值直接进入算法，不补零或截断');
  assert.deepEqual(legacy.calls[0].context.matrix, input.matrix);
  legacy.calls[0].resolve({ metrics: { respirationRate: 18, copX: 12, onbedFilterHealthy: 1 } }); await settle();
  assert.equal(legacy.service.snapshot().instances[0].status, 'running');
  assert.equal(JSON.stringify(published), wireCopy, '算法尺寸补全只在旁路，绝不改标准帧');
  await legacy.service.toggle({ ...legacyRequest, enabled: false });
  await assert.rejects(legacy.service.toggle({ ...legacyRequest, packageId: 'foot-pressure-realtime' }), /需要 4096/);
  legacy.bus.publish('hand:sit', { ...published, payload: { ...published.payload, value: Array(256).fill(1) } });
  assert.match(legacy.service.snapshot().channels[0].inputError, /需要 1024 点，收到 256 点/);
  await assert.rejects(legacy.service.toggle(legacyRequest), /数据不完整/);
  legacy.bus.publish('hand:sit', { ...published, payload: { ...published.payload, value: Array(256).fill(1), matrix: { rows: 16, cols: 16, total: 256 } } });
  assert.equal(legacy.service.snapshot().channels[0].matrix.total, 256, '明确尺寸优先，不能被型号默认值覆盖');
  await assert.rejects(legacy.service.toggle(legacyRequest), /需要 1024/);
  for (const invalid of [
    { ...published, displaySystemId: 'custom-hand', channelId: 'custom-hand:sit' },
    { ...published, sensorId: 'temperature', outputChannel: 'temperature', channelId: 'hand:temperature' },
    { ...published, payload: { ...published.payload, matrix: { rows: 32, cols: 32, total: 256 } } },
  ]) {
    legacy.bus.publish(invalid.channelId, invalid);
    const channel = legacy.service.snapshot().channels.find((item) => item.channelId === invalid.channelId);
    assert.equal(channel.matrix, null, '身份或尺寸不明确时不借用默认方阵');
    assert.match(channel.inputError, /矩阵尺寸/);
  }
  legacy.setContext({ sensorType: 'unregistered' });
  legacy.bus.publish('unregistered:sit', { ...published, sensorType: 'unregistered', displaySystemId: 'unregistered', channelId: 'unregistered:sit' });
  assert.equal(legacy.service.snapshot().channels[0].matrix, null, '未知型号不能被 registry 的默认 32×32 兜底放行');
  legacy.setContext({ sensorType: 'copy-hand', nativeSensorType: 'hand' });
  const copiedFrame = { ...published, sensorType: 'copy-hand', displaySystemId: 'copy-hand', channelId: 'copy-hand:sit' };
  legacy.bus.publish(copiedFrame.channelId, copiedFrame);
  assert.deepEqual(legacy.service.snapshot().channels[0].matrix, { rows: 32, cols: 32, total: 1024 }, '副本身份隔离，矩阵定义仍来自已校验的原型号');
  assert.equal(legacy.service.snapshot().channels[0].channelId, 'copy-hand:sit');
  legacy.bus.publish('hand:sit', published);
  assert.equal(legacy.service.snapshot().channels.length, 1, '原系统的帧不能进入副本算法会话');
  await legacy.service.dispose();
  const configured = fixture();
  const binding = { packageId: 'mattress-vitals', sensorId: 'sit', enabled: true };
  const configuration = { algorithms: [binding], charts: [{ id: 'breath', packageId: 'mattress-vitals', metricId: 'respirationRate' }], showPressure: true, showArea: true };
  configured.setContext({ sensorType: 'my-hand', nativeSensorType: 'hand', systemConfiguration: configuration });
  const selectedFrame = { ...published, sensorType: 'my-hand', displaySystemId: 'my-hand', channelId: 'my-hand:sit', timestamp: 1000 };
  assert.equal(configured.service.snapshot().instances.length, 0, '配置保存后等待真实帧，不伪造运行结果');
  configured.bus.publish(selectedFrame.channelId, selectedFrame); await settle();
  assert.equal(configured.runners.length, 1, '首个输入帧自动启动已保存的算法');
  configured.bus.publish(selectedFrame.channelId, { ...selectedFrame, timestamp: 1020 }); await settle();
  assert.deepEqual(configured.calls[0].values, published.payload.value, '线序后的真实数据进入独立算法');
  configured.calls[0].resolve({ metrics: { respirationRate: 16.5, onbedFilterHealthy: 1 } }); await settle();
  assert.equal(configured.service.snapshot().instances[0].history[0].metrics.respirationRate, 16.5);
  assert.equal(configured.service.snapshot().instances[0].managed, true);
  configured.setContext({ systemConfiguration: { ...configuration, charts: [] } });
  assert.equal(configured.service.snapshot().instances.length, 1, '删除图表不删除算法');
  await assert.rejects(configured.service.toggle({ sensorType: 'my-hand', packageId: binding.packageId, channelId: selectedFrame.channelId, enabled: false }), /系统配置/);
  configured.bus.publish(selectedFrame.channelId, { ...selectedFrame, timestamp: 1040 }); await settle();
  const configuredLate = configured.calls.at(-1);
  configured.setContext({ systemConfiguration: { ...configuration, algorithms: [], charts: [] } });
  assert.equal(configured.service.snapshot().instances.length, 0);
  await settle(); assert.equal(configured.runners[0].disposed, true, '删除算法时释放运行器');
  configuredLate.resolve({ metrics: { respirationRate: 999 } }); await settle();
  assert.equal(configured.service.snapshot().instances.length, 0, '迟到结果不能复活已删除算法');
  configured.setContext({ systemConfiguration: configuration });
  configured.bus.publish(selectedFrame.channelId, { ...selectedFrame, timestamp: 1060 }); await settle();
  assert.equal(configured.runners.length, 2, '重新添加后创建新的算法状态');
  configured.setContext({ sensorType: 'another-hand' });
  assert.equal(configured.service.snapshot().instances.length, 0);
  configured.bus.publish(selectedFrame.channelId, { ...selectedFrame, timestamp: 1080 }); await settle();
  assert.equal(configured.service.snapshot().channels.length, 0, '切换后忽略前一个副本的帧');
  await configured.service.dispose();
  console.log('algorithm market lifecycle, isolation, input and failure tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
