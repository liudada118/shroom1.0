const test = require('node:test');
const assert = require('node:assert/strict');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { createCollectionSourceMonitor } = require('../../kernel/storage/history/collectionSourceMonitor');
const { createHandPacketRuntime } = require('../../extensions/built-in-sensors/handPacketRuntime');
const { createHandGloveDoublePacketParser } = require('@shroom/backend/sensors/handGloveDouble.js');
const { createRealtimeTelemetryGateway } = require('../../kernel/realtime/realtimeTelemetryGateway');

/** Use the real frame bus with a manually advanced clock and interval callback. */
function fixture(t, options = {}) {
  let at = 1000, tick, clears = 0;
  const bus = createChannelBus(), statuses = [], unavailable = [];
  const state = { systemId: 'hand-copy', connectionKey: 'sit:connection-1', connected: false,
    collecting: false, playback: false, roles: ['sit'] };
  const monitor = createCollectionSourceMonitor({ channelBus: bus, getContext: () => state, now: () => at,
    schedule: callback => { tick = callback; return { unref() {} }; }, unschedule: () => clears++,
    onStatus: value => { statuses.push(value); options.onStatus?.(value, monitor, state); },
    onUnavailable: value => { unavailable.push(value); options.onUnavailable?.(value, monitor, state); } });
  t.after(() => monitor.dispose());
  /** Publish a canonical frame, allowing a test to corrupt individual fields. */
  function frame(patch = {}, channelId) {
    const payload = { type: 'sensor.frame', source: 'realtime', displaySystemId: state.systemId,
      sensorId: 'sit', outputChannel: 'sit', channelId: `${state.systemId}:sit`, payload: { value: [0, 0, 0] }, ...patch };
    return bus.publish(channelId || payload.channelId, payload);
  }
  return { state, monitor, statuses, unavailable, frame, bus, tick: () => tick(),
    advance: milliseconds => { at += milliseconds; }, clears: () => clears };
}

test('registration or an open connection without a valid live frame cannot start collection', t => {
  const f = fixture(t);
  f.frame();
  assert.equal(f.monitor.status().code, 'COLLECTION_DEVICE_NOT_CONNECTED');
  f.state.connected = true;
  assert.equal(f.monitor.status().code, 'COLLECTION_DATA_NOT_READY');
  assert.equal(f.monitor.status().lastFrameAgeMs, null);
  f.frame();
  assert.equal(f.monitor.status().ready, true, 'all-zero sensor values are still valid input');
  assert.equal(f.monitor.status().lastFrameAgeMs, 0);
  assert.equal(f.monitor.status().systemId, 'hand-copy');
});

test('playback, system messages, wrong identities/roles and malformed numeric arrays never arm collection', t => {
  const f = fixture(t); f.state.connected = true;
  const invalid = [
    { type: 'system.event' }, { source: 'playback' }, { source: undefined },
    { displaySystemId: 'another-copy', channelId: 'another-copy:sit' },
    { sensorId: 'back', channelId: 'hand-copy:back', outputChannel: 'back' },
    { sensorId: '' }, { channelId: 'hand-copy:wrong' },
    { payload: null }, { payload: { value: [] } }, { payload: { value: [NaN] } },
    { payload: { value: [Infinity] } }, { payload: { value: [null] } }, { payload: { value: ['0'] } },
    { payload: { value: [0, undefined] } }, { payload: { value: new Array(3) } },
  ];
  for (const frame of invalid) {
    f.frame(frame);
    assert.equal(f.monitor.status().ready, false, JSON.stringify(frame));
    assert.equal(f.monitor.status().lastFrameAgeMs, null);
  }
  f.frame({}, 'another-copy:sit');
  assert.equal(f.monitor.status().ready, false);
  const synthetic = { type: 'sensor.frame', source: 'realtime', displaySystemId: 'hand-copy', sensorId: 'sit',
    outputChannel: 'sit', channelId: 'hand-copy:sit', payload: { value: [0, 0] } };
  f.bus.publish(synthetic.channelId, synthetic, { synthetic: true });
  assert.equal(f.monitor.status().ready, false, 'synthetic clears never establish data readiness');
  f.state.playback = true; f.frame();
  assert.equal(f.monitor.status().code, 'COLLECTION_PLAYBACK_ACTIVE');
  f.state.playback = false;
  assert.equal(f.monitor.status().code, 'COLLECTION_DATA_NOT_READY');
});

test('the exact timeout is checked by status before the periodic callback runs', t => {
  const f = fixture(t); f.state.connected = true; f.frame();
  f.advance(4999); assert.equal(f.monitor.status().ready, true);
  f.advance(1);
  assert.deepEqual(f.monitor.status(), { systemId: 'hand-copy', ready: false, connected: true,
    code: 'COLLECTION_DATA_NOT_READY', timeoutMs: 5000, lastFrameAgeMs: 5000 });
  assert.equal(f.unavailable.length, 0, 'idle freshness loss is not an active collection interruption');
  f.frame();
  assert.equal(f.monitor.status().ready, true);
  assert.equal(f.state.collecting, false, 'a new frame never starts collection');
});

test('one active data gap stops collection once and callbacks can query status without recursion', t => {
  const f = fixture(t, { onStatus(value, monitor) { assert.deepEqual(monitor.status(), value); },
    onUnavailable(value, monitor) { assert.deepEqual(monitor.status(), value); } });
  f.state.connected = true; f.frame(); f.state.collecting = true;
  f.advance(5000); f.tick(); f.tick(); f.monitor.status();
  assert.equal(f.unavailable.length, 1);
  assert.equal(f.unavailable[0].code, 'COLLECTION_DATA_NOT_READY');
  f.state.collecting = false;
  f.monitor.refresh(); f.frame();
  assert.equal(f.monitor.status().ready, true);
  assert.equal(f.state.collecting, false);
  f.state.collecting = true; f.advance(5000); f.tick();
  assert.equal(f.unavailable.length, 2, 'a later collection has its own interruption latch');
});

test('reconnect, changed system/roles and playback forget previous-connection data immediately', t => {
  const f = fixture(t); f.state.connected = true; f.frame();
  f.state.connectionKey = 'sit:connection-2';
  assert.equal(f.monitor.status().ready, false);
  assert.equal(f.monitor.status().lastFrameAgeMs, null);
  f.frame(); assert.equal(f.monitor.status().ready, true);
  f.state.connected = false;
  assert.equal(f.monitor.status().code, 'COLLECTION_DEVICE_NOT_CONNECTED');
  f.state.connected = true;
  assert.equal(f.monitor.status().ready, false, 'same-key disconnected state still forgets input');
  f.frame(); f.state.playback = true;
  assert.equal(f.monitor.status().code, 'COLLECTION_PLAYBACK_ACTIVE');
  f.state.playback = false;
  assert.equal(f.monitor.status().ready, false);
  f.frame(); f.state.systemId = 'next-system';
  assert.equal(f.monitor.status().systemId, 'next-system');
  assert.equal(f.monitor.status().ready, false);
  assert.equal(f.statuses.at(-1).systemId, 'next-system', 'system changes are published even with unchanged availability');
  f.frame(); f.state.roles = ['back'];
  assert.equal(f.monitor.status().ready, false);
  f.frame(); assert.equal(f.monitor.status().ready, false);
  f.frame({ sensorId: 'back', outputChannel: 'back', channelId: 'next-system:back' });
  assert.equal(f.monitor.status().ready, true);
});

test('any declared connected role can keep collection ready without emitting per-frame status', t => {
  const f = fixture(t); f.state.connected = true; f.state.roles = ['sit', 'back'];
  f.monitor.refresh(); f.frame(); f.state.collecting = true;
  const count = f.statuses.length;
  for (let index = 0; index < 20; index++) {
    f.advance(1000);
    f.frame({ sensorId: 'back', outputChannel: 'back', channelId: 'hand-copy:back' });
    f.tick();
  }
  assert.equal(f.monitor.status().ready, true);
  assert.equal(f.statuses.length, count);
  assert.equal(f.unavailable.length, 0);
});

test('another role opening, losing health or reconnecting does not stop a fresh current source', t => {
  const f = fixture(t); f.state.connected = true;
  f.state.roleConnectionKeys = { sit: 'sit-1' };
  f.frame(); f.state.collecting = true;
  const published = f.statuses.length;
  f.advance(1000);
  f.state.roles = ['sit', 'back'];
  f.state.roleConnectionKeys.back = 'back-1';
  f.state.connectionKey = 'global-sit-1-back-1';
  assert.equal(f.monitor.status().ready, true, 'a newly opened role must not reset the first channel');
  assert.equal(f.monitor.status().lastFrameAgeMs, 1000);
  f.frame({ sensorId: 'back', outputChannel: 'back', channelId: 'hand-copy:back' });
  f.state.roles = ['sit'];
  assert.equal(f.monitor.status().ready, true, 'back health loss leaves sit input available');
  assert.equal(f.monitor.status().lastFrameAgeMs, 1000, 'removed back freshness cannot be reused');
  f.state.roles = ['sit', 'back'];
  f.state.roleConnectionKeys.back = 'back-2';
  f.state.connectionKey = 'global-sit-1-back-2';
  assert.equal(f.monitor.status().ready, true);
  assert.equal(f.monitor.status().lastFrameAgeMs, 1000);
  assert.equal(f.unavailable.length, 0);
  assert.equal(f.statuses.length, published, 'unrelated role changes do not broadcast false unavailable transitions');
});

test('reconnecting the only fresh role drops its data even when another open role remains', t => {
  const f = fixture(t); f.state.connected = true; f.state.roles = ['sit', 'back'];
  f.state.roleConnectionKeys = { sit: 'sit-1', back: 'back-1' };
  f.frame(); f.state.collecting = true;
  f.state.roleConnectionKeys.sit = 'sit-2';
  assert.equal(f.monitor.status().ready, false);
  assert.equal(f.monitor.status().lastFrameAgeMs, null);
  assert.equal(f.unavailable.length, 1);
  f.monitor.refresh();
  assert.equal(f.unavailable.length, 1);
  f.state.collecting = false;
  f.frame(); assert.equal(f.monitor.status().ready, true);
  delete f.state.roleConnectionKeys.sit;
  assert.equal(f.monitor.status().ready, false, 'an explicit per-role mapping cannot fall back to the old global generation');
  f.frame(); assert.equal(f.monitor.status().ready, false);
});

test('real glove packets published on the right-hand channel belong to their single physical sit connection', t => {
  const f = fixture(t), published = [];
  f.state.connected = true;
  f.state.roleConnectionKeys = { sit: 'sit-1' };
  const gateway = createRealtimeTelemetryGateway({ channelBus: f.bus, getSensorType: () => f.state.systemId,
    wsSubscriptions: { publish: (_channel, frame) => { published.push(frame); return 1; } } });
  const hand = createHandPacketRuntime({ doublePacketType: 'hand0205Double',
    createDoublePacketParser: createHandGloveDoublePacketParser,
    normalizeFiniteFrame: frame => frame, bytes4ToInt10: () => [],
    handL: frame => frame, handR: frame => frame, handRVideo1470506: frame => frame,
    publishSit: payload => gateway.publishRealtimeFrame('sit', payload),
    publishBack: payload => gateway.publishRealtimeFrame('back', payload),
    getRuntime: () => ({ file: 'hand0205Double', port1: { isOpen: true }, port2: { isOpen: false } }), setRuntime() {} });
  hand.reset({ routeByPacketType: true });
  const first = Buffer.alloc(130), second = Buffer.alloc(146);
  first[1] = 2; second[1] = 2;
  assert.equal(hand.handleDoublePacket(first, 'left', 'sit'), true);
  assert.equal(f.monitor.status().ready, false, 'a half packet cannot prove complete sensor data');
  assert.equal(hand.handleDoublePacket(second, 'left', 'sit'), true);
  assert.equal(published[0].channelId, 'hand-copy:back');
  assert.equal(published[0].serial, null);
  assert.equal(published[0].payload.protocol.packetSourcePort, 'sit');
  assert.ok(published[0].payload.value.every(value => value === 0));
  assert.equal(f.monitor.status().ready, true, 'right-only packets from one sit port are valid input');
  f.state.roleConnectionKeys.sit = 'sit-2';
  assert.equal(f.monitor.status().ready, false, 'the physical connection generation owns freshness');
  hand.handleDoublePacket(first, 'left', 'sit'); hand.handleDoublePacket(second, 'left', 'sit');
  assert.equal(f.monitor.status().ready, true);
  f.state.roles = ['back']; f.state.roleConnectionKeys = { back: 'back-1' };
  assert.equal(f.monitor.status().ready, false, 'an open logical output port cannot inherit the old physical source');
  hand.handleDoublePacket(first, 'left', 'sit'); hand.handleDoublePacket(second, 'left', 'sit');
  assert.equal(f.monitor.status().ready, false);
  f.state.connected = false;
  assert.equal(f.monitor.status().code, 'COLLECTION_DEVICE_NOT_CONNECTED');
});

test('explicit serial source takes precedence and invalid packet source never falls back to a convenient output', t => {
  const f = fixture(t); f.state.connected = true; f.state.roles = ['sit', 'armLeft'];
  for (const packetSourcePort of ['', null, undefined, 42, {}, 'armLeft', 'back']) {
    f.frame({ payload: { value: [0], protocol: { packetSourcePort } } });
    assert.equal(f.monitor.status().ready, false, String(packetSourcePort));
  }
  f.frame({ serial: { role: 'missing' }, payload: { value: [0], protocol: { packetSourcePort: 'sit' } } });
  assert.equal(f.monitor.status().ready, false, 'an explicit wrong serial role is not replaced by packet metadata');
  f.frame({ sensorId: 'back', outputChannel: 'back', channelId: 'hand-copy:back', serial: { role: 'sit' },
    payload: { value: [0], protocol: { packetSourcePort: 'back' } } });
  assert.equal(f.monitor.status().ready, true);
});

test('disposed monitors unsubscribe once, release timers and cannot become ready again', t => {
  const f = fixture(t); f.state.connected = true; f.frame();
  const count = f.statuses.length;
  f.monitor.dispose(); f.monitor.dispose();
  f.frame(); f.advance(10000); f.tick();
  assert.equal(f.monitor.status().ready, false);
  assert.equal(f.monitor.status().lastFrameAgeMs, null);
  assert.equal(f.statuses.length, count);
  assert.equal(f.clears(), 1);
});

test('mutating a returned status or the source array cannot forge readiness or retain pressure values', t => {
  const f = fixture(t); f.state.connected = true;
  const snapshot = f.monitor.status(); snapshot.ready = true; snapshot.code = null;
  assert.equal(f.monitor.status().ready, false);
  const values = [0, 2, 4]; f.frame({ payload: { value: values } });
  values.fill(NaN);
  assert.equal(f.monitor.status().ready, true, 'freshness stores only receive time, not a retained data reference');
  assert.deepEqual(Object.keys(f.monitor.status()).sort(), ['code', 'connected', 'lastFrameAgeMs', 'ready', 'systemId', 'timeoutMs']);
});
