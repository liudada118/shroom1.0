const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { HalowFrameParser, HalowReceiver } = require('../../kernel/transport/halowReceiver');

const idPacket = id => Buffer.concat([Buffer.from([0xaa, 0x55, 0, Buffer.byteLength(id)]), Buffer.from(id)]);
const dataPacket = value => Buffer.concat([Buffer.from([0xaa, 0x55, 3, 0x99]), Buffer.alloc(1024, value)]);
const addresses = () => [{ address: '127.0.0.1', name: 'test', internal: true }];

/** 取得测试用临时端口。 */
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
