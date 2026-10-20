const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once, EventEmitter } = require('node:events');
const { HalowFrameParser, HalowReceiver, isHalowDisplaySystem } = require('../../kernel/transport/halowReceiver');


const idPacket = id => Buffer.concat([Buffer.from([0xaa, 0x55, 0, Buffer.byteLength(id)]), Buffer.from(id)]);
const dataPacket = value => Buffer.concat([Buffer.from([0xaa, 0x55, 3, 0x99]), Buffer.alloc(1024, value)]);
const addresses = () => [{ address: '127.0.0.1', name: 'test', internal: true }];

/** 模拟 socket 事件顺序，允许控制 destroy 与 close 之间的重连窗口。 */
function controlledSocket(address = '192.0.2.20', port = 1234) {
  const socket = new EventEmitter();
  Object.assign(socket, { remoteAddress: address, remotePort: port, destroyed: false });
  socket.setNoDelay = () => {};
  socket.setKeepAlive = () => {};
  socket.destroy = () => { socket.destroyed = true; };
  return socket;
}

/** 触发设备连接重置，并按测试需要延迟 close 事件。 */
function resetControlledSocket(socket, close = true) {
  socket.destroy();
  socket.remoteAddress = undefined;
  socket.remotePort = undefined;
  socket.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));
  if (close) socket.emit('close');
}


async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

/** 等待网络事件完成，超时立即失败。 */
async function waitFor(predicate) {
  const limit = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > limit) assert.fail('Timed out waiting for receiver');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** 连接测试设备并发送 ID 与数据。 */
async function connect(port, id, value) {
  const socket = net.connect(port, '127.0.0.1');
  socket.on('error', () => {});
  await once(socket, 'connect');
  socket.write(Buffer.concat([idPacket(id), dataPacket(value)]));
  return socket;
}

test('ID and payload split byte-by-byte; header bytes inside payload remain data', () => {
  const parser = new HalowFrameParser();
  const payload = Buffer.alloc(1024, 21);
  Buffer.from([0xaa, 0x55, 3, 0x99]).copy(payload, 23);
  const wire = Buffer.concat([idPacket('STA_002'), Buffer.from([0xaa, 0x55, 3, 0x99]), payload]);
  const frames = [];
  for (const byte of wire) frames.push(...parser.feed(Buffer.from([byte])));
  assert.equal(parser.deviceId, 'STA_002');
  assert.deepEqual(frames, [payload]);
  assert.equal(parser.skippedBytes, 0);
});

test('coalesced frames are all emitted and unframed garbage is bounded', () => {
  const parser = new HalowFrameParser();
  const frames = parser.feed(Buffer.concat([idPacket('A'), dataPacket(7), dataPacket(8)]));
  assert.equal(frames.length, 2);
  assert.equal(frames[1][0], 8);
  parser.feed(Buffer.alloc(200000, 1));
  assert.ok(parser.buffer.length <= 3);
  assert.equal(parser.feed(dataPacket(9))[0][0], 9);
});

test('invalid ID headers/lengths and non-ASCII IDs fail closed', () => {
  for (const bytes of [[0xaa, 0x55, 0, 0], [0xaa, 0x55, 0, 65], [0xaa, 0x55, 3, 99], [0xaa, 0x55, 0, 1, 255]]) {
    assert.throws(() => new HalowFrameParser().feed(Buffer.from(bytes)));
  }
});

test('real TCP delivers raw 1024 bytes, stop releases port, reconnect reads fresh identity', async t => {
  const frames = [];
  const receiver = new HalowReceiver({ getAddresses: addresses, onFrame: (frame, meta) => frames.push({ frame, meta }) });
  t.after(() => receiver.stop());
  const port = await freePort();
  await receiver.start({ host: '127.0.0.1', port });
  const socket = await connect(port, 'STA_002', 77);
  t.after(() => socket.destroy());
  await waitFor(() => frames.length === 1);
  assert.deepEqual(frames[0].frame, Buffer.alloc(1024, 77));
  assert.equal(frames[0].meta.deviceId, 'STA_002');
  assert.equal(receiver.snapshot().clients[0].frames, 1);
  await receiver.stop();
  await receiver.start({ host: '127.0.0.1', port });
  const second = await connect(port, 'NEW_ID', 88);
  t.after(() => second.destroy());
  await waitFor(() => frames.length === 2);
  assert.equal(frames[1].meta.deviceId, 'NEW_ID');
});

test('multiple devices remain isolated; disconnect does not silently select another device', async t => {
  const seen = [];
  const receiver = new HalowReceiver({ getAddresses: addresses, onFrame: (frame, meta) => seen.push([meta.deviceId, frame[0]]) });
  t.after(() => receiver.stop());
  const port = await freePort();
  await receiver.start({ host: '127.0.0.1', port });
  const first = await connect(port, 'A', 1);
  const second = await connect(port, 'B', 2);
  t.after(() => { first.destroy(); second.destroy(); });
  await waitFor(() => receiver.receivedFrames === 2);
  assert.deepEqual(seen, [['A', 1]]);
  receiver.select('B');
  first.write(dataPacket(3));
  second.write(dataPacket(4));
  await waitFor(() => receiver.receivedFrames === 4);
  assert.deepEqual(seen, [['A', 1], ['B', 4]]);
  second.destroy();
  await waitFor(() => receiver.clients.size === 1);
  first.write(dataPacket(5));
  await waitFor(() => receiver.receivedFrames === 5);
  assert.equal(seen.length, 2);
  assert.equal(receiver.selectedDeviceId, 'B');
});

test('duplicate ID is rejected without replacing the selected device', async t => {
  const receiver = new HalowReceiver({ getAddresses: addresses });
  t.after(() => receiver.stop());
  const port = await freePort();
  await receiver.start({ host: '127.0.0.1', port });
  const first = await connect(port, 'A', 1);
  const second = await connect(port, 'A', 2);
  t.after(() => { first.destroy(); second.destroy(); });
  await waitFor(() => receiver.error.includes('ID 重复'));
  assert.equal(receiver.receivedFrames, 1);
  assert.equal(receiver.selectedDeviceId, 'A');
});

test('real TCP reset keeps listener active and same-device complete frames clear its recovered error', async t => {
  const seen = [];
  const receiver = new HalowReceiver({ getAddresses: addresses, onFrame: frame => seen.push(frame[0]) });
  t.after(() => receiver.stop());
  const port = await freePort();
  await receiver.start({ host: '127.0.0.1', port });
  const listener = receiver.listener;
  const first = await connect(port, 'VEST_01', 21);
  t.after(() => first.destroy());
  await waitFor(() => seen.length === 1);
  first.resetAndDestroy();
  await waitFor(() => receiver.clients.size === 0 && receiver.error.includes('ECONNRESET'));
  assert.equal(receiver.phase, 'listening');
  assert.equal(receiver.listener, listener);
  const second = await connect(port, 'VEST_01', 42);
  t.after(() => second.destroy());
  await waitFor(() => seen.length === 2);
  assert.deepEqual(seen, [21, 42]);
  assert.equal(receiver.error, '');
  assert.equal(receiver.snapshot().selectedDeviceId, 'VEST_01');
  assert.equal(receiver.receivedFrames, 2);
  assert.equal(receiver.listener, listener);
});

test('same ID reconnect is accepted when old socket is destroyed but its close event is pending', async t => {
  const seen = [];
  const receiver = new HalowReceiver({ onFrame: frame => seen.push(frame[0]) });
  receiver.phase = 'listening';
  t.after(() => receiver.stop());
  const old = controlledSocket();
  receiver.accept(old);
  old.emit('data', Buffer.concat([idPacket('VEST_01'), dataPacket(21)]));
  resetControlledSocket(old, false);
  const reconnect = controlledSocket('192.0.2.20', 1235);
  receiver.accept(reconnect);
  reconnect.emit('data', Buffer.concat([idPacket('VEST_01'), dataPacket(42)]));
  assert.equal(reconnect.destroyed, false);
  assert.equal(receiver.error, '');
  assert.deepEqual(seen, [21, 42]);
  let cleared = 0;
  receiver.on('clear', () => { cleared += 1; });
  old.emit('close');
  assert.equal(cleared, 0, 'old socket closing must not clear the newly reconnected device display');
  assert.equal(receiver.clients.size, 1);
});

test('socket error clears only after complete frames from the original ID and IP', async t => {
  const receiver = new HalowReceiver();
  receiver.phase = 'listening';
  t.after(() => receiver.stop());
  const old = controlledSocket();
  receiver.accept(old);
  old.emit('data', Buffer.concat([idPacket('VEST_01'), dataPacket(21)]));
  resetControlledSocket(old);
  const error = receiver.error;
  const otherDevice = controlledSocket('192.0.2.20', 1235);
  receiver.accept(otherDevice);
  assert.equal(receiver.error, error, 'accepting a connection does not prove recovery');
  otherDevice.emit('data', Buffer.concat([idPacket('OTHER_ID'), dataPacket(42)]));
  assert.equal(receiver.error, error, 'other devices cannot clear this device error');
  const otherIp = controlledSocket('192.0.2.21', 1236);
  receiver.accept(otherIp);
  otherIp.emit('data', Buffer.concat([idPacket('VEST_01'), dataPacket(43)]));
  assert.equal(receiver.error, error, 'matching ID from another IP is not the original connection recovering');
  otherIp.destroy();
  otherIp.emit('close');
  const originalDevice = controlledSocket('192.0.2.20', 1237);
  receiver.accept(originalDevice);
  originalDevice.emit('data', idPacket('VEST_01'));
  assert.equal(receiver.error, error, 'ID handshake alone must not clear the error');
  const packet = dataPacket(44);
  originalDevice.emit('data', packet.subarray(0, packet.length - 1));
  assert.equal(receiver.error, error, 'an incomplete frame must not clear the error');
  originalDevice.emit('data', packet.subarray(packet.length - 1));
  assert.equal(receiver.error, '');
});

test('recovered socket frames do not conceal a later independent protocol error', async t => {
  const receiver = new HalowReceiver();
  receiver.phase = 'listening';
  t.after(() => receiver.stop());
  const old = controlledSocket();
  receiver.accept(old);
  old.emit('data', Buffer.concat([idPacket('VEST_01'), dataPacket(21)]));
  resetControlledSocket(old);
  const bad = controlledSocket('192.0.2.30', 1235);
  receiver.accept(bad);
  bad.emit('data', Buffer.from([0, 0, 0, 1, 65]));
  const protocolError = receiver.error;
  assert.match(protocolError, /设备首帧/);
  bad.emit('close');
  const reconnect = controlledSocket('192.0.2.20', 1236);
  receiver.accept(reconnect);
  reconnect.emit('data', Buffer.concat([idPacket('VEST_01'), dataPacket(42)]));
  assert.equal(reconnect.destroyed, false);
  assert.equal(receiver.error, protocolError);
});

test('port conflict, non-local IP, and cancellation report errors without lingering listeners', async t => {
  const first = new HalowReceiver({ getAddresses: addresses });
  const second = new HalowReceiver({ getAddresses: addresses });
  t.after(async () => { await first.stop(); await second.stop(); });
  const port = await freePort();
  await first.start({ host: '127.0.0.1', port });
  await assert.rejects(second.start({ host: '127.0.0.1', port }), /已被占用/);
  await assert.rejects(second.start({ host: '192.0.2.1', port }), /本机/);
  const starting = second.start({ host: '127.0.0.1', port: await freePort() });
  const stopped = second.stop();
  await assert.rejects(starting, /不允许|取消/);
  await stopped;
  assert.equal(second.phase, 'stopped');
});
