const assert = require('assert');
const { EventEmitter } = require('events');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');
const { normalizeSerialError } = require('@shroom/backend/serial/serialErrors.js');

/** 等待真实事件循环，模拟驱动延迟。 */
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

class FakePort extends EventEmitter {
  /** 记录物理打开和关闭的次数。 */
  constructor(options) { super(); this.options = options; this.isOpen = false; this.opens = 0; this.closes = 0; }
  /** 由测试控制打开回调的时机。 */
  open(callback) { this.opens += 1; this.callback = callback; }
  /** 模拟真正的驱动打开结果。 */
  finish(error) { this.isOpen = !error; if (!error) this.emit('open'); this.callback?.(error); }
  /** 模拟关闭成功或驱动拒绝关闭。 */
  close(callback) {
    this.closes += 1;
    if (!this.closeError) { this.isOpen = false; this.emit('close'); }
    callback?.(this.closeError);
  }
  /** parser 监听由管理器安装，此处不伪造数据。 */
  unpipe() {}
}

/** 用可控硬件替身运行真实管理器。 */
function setup(options = {}) {
  const ports = [];
  const events = [];
  const parser = new EventEmitter();
  const manager = createSerialManager({
    createSerialPort: (config) => { const port = new FakePort(config); ports.push(port); return port; },
    parserManager: { pipe: () => parser }, onStatus: (status) => events.push(status),
    openTimeoutMs: 100, closeTimeoutMs: 30, dataTimeoutMs: 1000, ...options,
  });
  return { manager, ports, events, parser };
}

/** 验证打开失败、取消竞态、资源隔离、重连以及数据告警。 */
async function run() {
  const live = [];
  /** 登记夹具，确保失败时也清理其定时器。 */
  function fixture(options) { const value = setup(options); live.push(value); return value; }
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.strictEqual(normalizeSerialError({ code: 'ENOENT' }).code, 'SERIAL_PORT_NOT_FOUND');
    assert.strictEqual(normalizeSerialError({ code: 'EACCES' }).code, 'SERIAL_PERMISSION_DENIED');
    assert.strictEqual(normalizeSerialError(new Error('Access denied')).code, 'SERIAL_PORT_BUSY');

    const a = fixture();
    a.manager.open('sit', { path: 'COM1', baudRate: 1000000, reconnect: true });
    const opening = a.manager.waitForOpen('sit');
    let settled = false;
    opening.then(() => { settled = true; }, () => { settled = true; });
    await tick();
    assert.strictEqual(settled, false, 'physical callback is required');
    assert.throws(() => a.manager.open('sit', { path: 'COM2' }), (error) => error.code === 'SERIAL_CONNECT_BUSY');
    assert.strictEqual(a.manager.getStatus('sit').path, 'COM1');
    a.ports[0].finish(new Error('resource busy'));
    await assert.rejects(opening, (error) => error.code === 'SERIAL_PORT_BUSY' && error.role === 'sit' && error.path === 'COM1');
    assert.strictEqual(a.manager.getStatus('sit').reconnect, false);
    assert.strictEqual(a.manager.reconnectPort('sit').attempted, false);

    const b = fixture();
    b.manager.open('sit', { path: 'COM3', baudRate: 1000000, reconnect: true, parserChannel: 'sit' });
    await tick(); b.ports[0].finish();
    assert.strictEqual((await b.manager.waitForOpen('sit')).isOpen, true);
    assert.throws(() => b.manager.open('back', { path: 'COM3' }), (error) => error.code === 'SERIAL_PORT_BUSY');
    assert.strictEqual(b.ports[0].closes, 0, 'another channel must not evict the active port');
    await b.manager.close('sit');
    assert.strictEqual(b.parser.listenerCount('data'), 0);
    assert.strictEqual(b.events.filter((event) => event.error?.code === 'SERIAL_DISCONNECTED').length, 0);
    assert.strictEqual(b.manager.reconnectPort('sit').attempted, false);

    const c = fixture({ openTimeoutMs: 20 });
    c.manager.open('armLeft', { path: 'COM4', reconnect: true });
    await tick(40);
    await assert.rejects(c.manager.waitForOpen('armLeft'), (error) => error.code === 'SERIAL_CONNECT_TIMEOUT');
    assert.throws(() => c.manager.open('armLeft', { path: 'COM4' }), (error) => error.code === 'SERIAL_CLOSE_FAILED');
    c.ports[0].finish();
    assert.strictEqual(c.ports[0].isOpen, false, 'late successful open must immediately close');
    assert.strictEqual(c.manager.getStatus('armLeft').status, 'error');
    c.manager.open('armLeft', { path: 'COM4' });
    await tick(); c.ports[1].finish();
    assert.strictEqual((await c.manager.waitForOpen('armLeft')).isOpen, true);

    const late = fixture({ openTimeoutMs: 15, closeTimeoutMs: 15 });
    late.manager.open('sit', { path: 'COM40' });
    await tick(50);
    late.ports[0].finish();
    late.manager.open('sit', { path: 'COM40' });
    await tick(); late.ports[1].finish();
    assert.strictEqual((await late.manager.waitForOpen('sit')).isOpen, true, 'late cleanup after both deadlines must allow a fresh attempt');

    const d = fixture();
    d.manager.open('sit', { path: 'COM5', reconnect: true });
    await tick();
    const cancelled = d.manager.waitForOpen('sit');
    const closing = d.manager.close('sit');
    await assert.rejects(cancelled, (error) => error.code === 'SERIAL_CONNECT_CANCELLED');
    d.ports[0].finish();
    assert.strictEqual((await closing).ok, true);
    assert.strictEqual(d.ports[0].isOpen, false);

    const e = fixture();
    e.manager.open('sit', { path: 'COM6', reconnect: true });
    await tick(); e.ports[0].finish();
    e.ports[0].isOpen = false; e.ports[0].emit('close');
    assert.strictEqual(e.manager.getStatus('sit').error.code, 'SERIAL_DISCONNECTED');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      assert.strictEqual(e.manager.reconnectPort('sit').attempted, true);
      assert.strictEqual(e.manager.reconnectPort('sit').attempted, false, 'do not replace an opening retry');
      await tick(); e.ports[attempt].finish(new Error('not found'));
      await assert.rejects(e.manager.waitForOpen('sit'));
    }
    assert.strictEqual(e.manager.getStatus('sit').reconnect, false);
    assert.strictEqual(e.manager.reconnectPort('sit').attempted, false);

    const f = fixture({ dataTimeoutMs: 20 });
    f.manager.open('sit', { path: 'COM7', parserChannel: 'sit', protocol: { validation: { header: [0xaa] } } });
    await tick(); f.ports[0].finish(); await tick(45);
    assert.strictEqual(f.manager.getStatus('sit').error.code, 'SERIAL_NO_DATA');
    f.ports[0].emit('data', Buffer.from([1])); await tick(5);
    for (let index = 0; index < 10; index += 1) f.parser.emit('data', Buffer.from([1]));
    assert.strictEqual(f.manager.getStatus('sit').error.code, 'SERIAL_BAD_FRAMES');
    f.parser.emit('data', Buffer.from([0xaa]));
    assert.strictEqual(f.manager.getStatus('sit').error, null);
    assert.strictEqual(f.manager.getStatus('sit').health, 'ok');
    await f.manager.close('sit');

    const unframed = fixture({ dataTimeoutMs: 20 });
    unframed.manager.open('sit', { path: 'COM70', parserChannel: 'sit' });
    await tick(); unframed.ports[0].finish();
    const sending = setInterval(() => unframed.ports[0].emit('data', Buffer.from([1])), 5);
    await tick(45); clearInterval(sending);
    assert.strictEqual(unframed.manager.getStatus('sit').error.code, 'SERIAL_NO_FRAME');
    unframed.ports[0].emit('error', new Error('I/O error'));
    assert.strictEqual(unframed.manager.getStatus('sit').error.code, 'SERIAL_RUNTIME_ERROR');
    assert.strictEqual(unframed.ports[0].isOpen, false);

    const g = fixture();
    g.manager.open('sit', { path: 'COM8' }); await tick(); g.ports[0].finish();
    g.ports[0].closeError = new Error('driver refuses close');
    const failedClose = await g.manager.close('sit');
    assert.strictEqual(failedClose.ok, false);
    assert.strictEqual(failedClose.error.code, 'SERIAL_CLOSE_FAILED');
    assert.strictEqual(g.manager.getStatus('sit').isOpen, true, 'status queries must expose a still-open driver handle');
    assert.strictEqual(g.manager.isPathBusy('COM8'), true);
    assert.throws(() => g.manager.open('back', { path: 'COM8' }), (error) => error.code === 'SERIAL_CLOSE_FAILED');
    g.ports[0].closeError = null;
    assert.strictEqual((await g.manager.close('sit')).ok, true, 'manual close can retry a rejected driver close');
  } finally {
    await Promise.all(live.map(({ manager }) => manager.closeAll()));
    clearInterval(keepAlive);
  }
}

run().then(() => console.log('serialManager.test.js passed')).catch((error) => { console.error(error); process.exitCode = 1; });
