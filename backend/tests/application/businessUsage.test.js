const test = require('node:test');
const assert = require('node:assert/strict');
const { subscribeBusinessEvents, observeUsageOperation } = require('../../common/businessEvents');
const { createFrameUsageObserver } = require('../../common/frameUsageObserver');
const { createCollectionInsertQueueService } = require('@shroom/backend/collection/collectionInsertQueueService.js');
const { createAlgorithmMarketService } = require('../../extension-host/runtime/algorithmMarketService');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const Database = require('better-sqlite3');

/** Observe metadata and remove the listener before another test starts. */
function events(t) { const items = []; const off = subscribeBusinessEvents(event => items.push(event)); t.after(off); return items; }
/** Build a synthetic realtime frame; no device, recording or customer data is used. */
function frame(system = 'fixture', role = 'sit', source = 'realtime') {
  return { type: 'sensor.frame', source, displaySystemId: system, sensorId: role, outputChannel: role,
    channelId: `${system}:${role}`, timestamp: 1000, payload: { matrix: { rows: 1, cols: 2, total: 2 }, value: [1, 2] } };
}
/** Control observer time without waiting or creating a real periodic service. */
function observerFixture(t) {
  const bus = createChannelBus(), items = [];
  let at = 0, context = { systemType: 'fixture', systemOrigin: 'custom', allowed: true, playback: false };
  const observer = createFrameUsageObserver({ channelBus: bus, getContext: () => context, now: () => at,
    emit: (eventName, properties) => items.push({ eventName, properties }), schedule: () => null, unschedule: () => {} });
  t.after(() => observer.dispose());
  return { bus, items, observer, time: value => { at = value; }, context: value => { context = { ...context, ...value }; } };
}

test('business observation preserves sync values, awaited failures and the original error', async t => {
  const items = events(t), original = { ok: true, secret: 'not-an-event' };
  assert.equal(observeUsageOperation('custom_system_saved', { featureId: 'workspace' }, () => original), original);
  assert.equal(items[0].properties.operationId, items[1].properties.operationId);
  const error = Object.assign(new Error('raw-secret'), { code: 'FIXTURE_FAILED' });
  await assert.rejects(observeUsageOperation('algorithm_result', { featureId: 'algorithms' }, async () => { throw error; }), e => e === error);
  assert.equal(items.at(-1).properties.result, 'failure');
  assert.equal(items.at(-1).properties.errorCode, 'FIXTURE_FAILED');
  observeUsageOperation('custom_system_saved', {}, () => ({ ok: false, code: 'DEVICE_LIMIT_REACHED' }));
  assert.equal(items.at(-1).properties.result, 'failure');
  assert.equal(items.at(-1).properties.errorCode, 'DEVICE_LIMIT_REACHED');
  assert(!JSON.stringify(items).includes('secret'));
  const broken = subscribeBusinessEvents(() => { throw new Error('observer-only failure'); });
  try { assert.equal(observeUsageOperation('custom_system_saved', {}, () => 42), 42); } finally { broken(); }
});

test('only the opened role in the active live system can satisfy the first-frame timer', t => {
  const f = observerFixture(t);
  f.observer.connection({ role: 'sit', status: 'open' });
  for (const input of [frame('other'), frame('fixture', 'back'), frame('fixture', 'sit', 'playback')]) f.bus.publish(input.channelId, input);
  f.time(10000); f.observer.tick(); f.observer.tick();
  assert.equal(f.items.length, 1);
  assert.equal(f.items[0].properties.action, 'first_frame_timeout');
  const input = frame(), before = JSON.stringify(input);
  f.time(10100); f.bus.publish(input.channelId, input);
  assert.equal(f.items.at(-1).properties.action, 'first_frame_recovered');
  assert.equal(JSON.stringify(input), before);
  assert(!JSON.stringify(f.items).includes('payload'));
  f.time(12101); f.observer.tick(); f.observer.tick();
  assert.equal(f.items.at(-1).properties.action, 'stream_paused');
  f.time(13000); f.bus.publish(input.channelId, input);
  assert.equal(f.items.at(-1).properties.action, 'stream_recovered');
  f.observer.connection({ role: 'sit', status: 'closed' });
  f.time(90000); f.observer.tick();
  assert.equal(f.items.filter(item => item.properties.action === 'stream_paused').length, 1);
});

test('high frame rates produce summaries, while intentional playback does not produce stream errors', t => {
  const f = observerFixture(t), input = frame();
  f.observer.connection({ role: 'sit', status: 'open' });
  for (let i = 0; i < 50000; i++) { f.time(i * 0.6); f.bus.publish(input.channelId, input); }
  f.time(30000); f.observer.tick();
  assert.equal(f.items.length, 2, 'one first-frame event and one summary, not 50,000 events');
  assert.equal(f.items[1].properties.count, 50000);
  f.context({ playback: true }); f.time(60000); f.observer.tick();
  f.context({ playback: false }); f.observer.tick();
  assert.equal(f.items.length, 2);
  f.bus.publish(input.channelId, input); f.context({ systemType: 'next' }); f.observer.tick();
  assert.equal(f.items.at(-1).properties.count, 1, 'switching systems flushes the old system count');
  assert.equal(f.items.at(-1).properties.systemType, 'fixture');
});

test('collection summaries count committed rows and never count rolled-back transactions', t => {
  const db = new Database(':memory:'); t.after(() => db.close());
  db.exec('CREATE TABLE frames(id INTEGER PRIMARY KEY, value TEXT)');
  const errors = [], writer = createCollectionInsertQueueService({ sql: 'INSERT INTO frames VALUES (?,?)', onError: error => errors.push(error) });
  const handle = { _db: db };
  writer.enqueue(handle, [1, 'private']); writer.enqueue(handle, [2, 'private']); writer.flushAll();
  assert.deepEqual(writer.getStats(), { queued: 2, written: 2, failed: 0, pending: 0, exact: true });
  writer.enqueue(handle, [3, 'private']); writer.enqueue(handle, [1, 'private']); writer.flushAll();
  assert.equal(writer.getStats().written, 2);
  assert.equal(writer.getStats().failed, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM frames').get().count, 2);
  assert.equal(errors.length, 1);
  assert(!JSON.stringify(writer.getStats()).includes('private'));
});

test('asynchronous legacy storage remains unconfirmed until callbacks and marks counts as inexact', () => {
  const callbacks = [], writer = createCollectionInsertQueueService({ sql: 'fixture' });
  const db = { run: (_sql, _params, callback) => callbacks.push(callback) };
  writer.enqueue(db, [1]); writer.enqueue(db, [2]); writer.flushAll();
  assert.equal(writer.getStats().pending, 2); assert.equal(writer.getStats().exact, false);
  callbacks[0].call({ changes: 1 }, null); callbacks[1](new Error('fixture'));
  assert.deepEqual(writer.getStats(), { queued: 2, written: 1, failed: 1, pending: 0, exact: false });
});

test('algorithm state events follow transitions and do not repeat every maintenance tick', async t => {
  const items = events(t), bus = createChannelBus(); let tick, at = 1000;
  const run = async () => ({ metrics: { value: 3 } }); run.dispose = async () => {};
  const service = createAlgorithmMarketService({ channelBus: bus, getContext: () => ({ sensorType: 'fixture', allowed: true }),
    packages: [{ id: 'fixture-algorithm', compatibility: { matrixTotals: [2] }, metricDefinitions: [{ id: 'value' }], resolvedPackage: { resolvedEntry: 'fixture' } }],
    createRunner: () => run, now: () => at, schedule: callback => { tick = callback; }, unschedule: () => {} });
  t.after(() => service.dispose());
  const input = frame(); bus.publish(input.channelId, input);
  await service.toggle({ sensorType: 'fixture', packageId: 'fixture-algorithm', channelId: input.channelId, enabled: true });
  tick(); tick();
  assert.equal(items.filter(item => item.properties.action === 'runtime_waiting').length, 1);
  bus.publish(input.channelId, input); await new Promise(resolve => setImmediate(resolve)); tick(); tick();
  assert.equal(items.filter(item => item.properties.action === 'runtime_running').length, 1);
  at = 4001; tick(); tick();
  assert.equal(items.filter(item => item.properties.action === 'runtime_paused').length, 1);
  await service.toggle({ sensorType: 'fixture', packageId: 'fixture-algorithm', enabled: false });
  assert.equal(items.filter(item => item.properties.action === 'runtime_stopped').length, 1);
  assert(!JSON.stringify(items).includes('resolvedEntry'));
});
