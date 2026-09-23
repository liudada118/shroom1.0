const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  classifyOpenFailure,
  extractPath,
  selectFixableDevices,
  buildUdevRule,
  applyPermissionFix,
  createThrottle,
  createSerialDiagnosticsProtocol,
} = require('../server/serialDiagnostics');

const ch340 = { path: '/dev/ttyUSB0', vendorId: '1a86', productId: '7523' };
const motherboard = { path: '/dev/ttyS0', vendorId: undefined, productId: undefined };
const denied = () => { throw new Error('EACCES'); };
const allowed = () => {};

test('设备路径从本地化错误信息中提取，不受 strerror 语言影响', () => {
  assert.equal(extractPath('权限不够, cannot open /dev/ttyUSB0'), '/dev/ttyUSB0');
  assert.equal(extractPath('Permission denied, cannot open /dev/ttyUSB0'), '/dev/ttyUSB0');
  assert.equal(extractPath('Access denied, cannot open COM3'), 'COM3');
  assert.equal(extractPath('something else entirely'), '');
});

test('设备不在端口列表里判为拔出/驱动未装', () => {
  const result = classifyOpenFailure({
    error: new Error('No such file or directory, cannot open /dev/ttyUSB0'),
    ports: [motherboard],
    platform: 'linux',
  });
  assert.equal(result.kind, 'deviceMissing');
  assert.equal(result.path, '/dev/ttyUSB0');
});

test('Windows 上设备缺失提示安装驱动', () => {
  const result = classifyOpenFailure({ error: new Error('cannot open COM3'), ports: [], platform: 'win32' });
  assert.equal(result.kind, 'deviceMissing');
  assert.match(result.hint, /驱动/);
});

test('设备存在但不可读写判为权限不足', () => {
  const result = classifyOpenFailure({
    error: new Error('权限不够, cannot open /dev/ttyUSB0'),
    ports: [ch340],
    platform: 'linux',
    access: denied,
  });
  assert.equal(result.kind, 'permissionDenied');
  assert.match(result.hint, /修复权限/);
});

test('设备存在且可读写仍失败判为被占用', () => {
  const result = classifyOpenFailure({
    error: new Error('Device or resource busy, cannot open /dev/ttyUSB0'),
    ports: [ch340],
    platform: 'linux',
    access: allowed,
  });
  assert.equal(result.kind, 'portBusy');
});

test('Windows 不走文件权限探测，设备在列表里即判为被占用', () => {
  const result = classifyOpenFailure({
    error: new Error('Access denied, cannot open COM3'),
    ports: [{ path: 'COM3', vendorId: '1a86', productId: '7523' }],
    platform: 'win32',
    access: denied,
  });
  assert.equal(result.kind, 'portBusy');
  assert.match(result.hint, /占用/);
});

test('非法 VID/PID 的设备被排除，不会进入以 root 执行的规则', () => {
  const hostile = { path: '/dev/ttyUSB9', vendorId: '1a86" MODE="0666", RUN+="/bin/sh -c evil', productId: '7523' };
  const devices = selectFixableDevices([ch340, motherboard, hostile, { path: '/dev/ttyUSB8', vendorId: 'zzzz', productId: '7523' }]);
  assert.deepEqual(devices.map(d => d.path), ['/dev/ttyUSB0']);
});

test('udev 规则按 VID:PID 去重且使用 MODE=0666', () => {
  const rule = buildUdevRule([ch340, { ...ch340, path: '/dev/ttyUSB1' }, { path: '/dev/ttyUSB2', vendorId: '10C4', productId: 'EA60' }]);
  const lines = rule.trim().split('\n').filter(line => line.startsWith('SUBSYSTEM'));
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", MODE="0666"');
  assert.match(lines[1], /idVendor}=="10c4".*idProduct}=="ea60"/);
});

test('非 Linux 平台拒绝权限修复', async () => {
  await assert.rejects(
    () => applyPermissionFix([ch340], { platform: 'win32' }),
    /仅 Linux/
  );
});

test('没有可修复设备时不调起提权', async () => {
  let called = false;
  await assert.rejects(
    () => applyPermissionFix([motherboard], { platform: 'linux', runner: () => { called = true; } }),
    /未检测到 USB 转串口设备/
  );
  assert.equal(called, false);
});

test('提权成功后清理临时文件并返回修复的设备', async () => {
  const written = [];
  const removed = [];
  const runner = () => {
    const child = new EventEmitter();
    setImmediate(() => child.emit('exit', 0));
    return child;
  };

  const fixed = await applyPermissionFix([ch340, motherboard], {
    platform: 'linux',
    runner,
    writeFile: (target, content) => written.push({ target, content }),
    removeFile: target => removed.push(target),
  });

  assert.deepEqual(fixed, ['/dev/ttyUSB0']);
  assert.equal(written.length, 1);
  assert.match(written[0].content, /idVendor}=="1a86"/);
  assert.deepEqual(removed, [written[0].target]);
});

test('用户取消授权时报出可读原因，且临时文件仍被清理', async () => {
  const removed = [];
  const runner = () => {
    const child = new EventEmitter();
    setImmediate(() => child.emit('exit', 126));
    return child;
  };

  await assert.rejects(
    () => applyPermissionFix([ch340], { platform: 'linux', runner, writeFile: () => {}, removeFile: t => removed.push(t) }),
    /授权被取消/
  );
  assert.equal(removed.length, 1);
});

test('同一设备同一原因在时间窗内只放行一次', () => {
  let now = 1000;
  const allow = createThrottle(30000, () => now);
  assert.equal(allow('/dev/ttyUSB0|permissionDenied'), true);
  assert.equal(allow('/dev/ttyUSB0|permissionDenied'), false);
  assert.equal(allow('/dev/ttyUSB0|portBusy'), true);
  now += 30001;
  assert.equal(allow('/dev/ttyUSB0|permissionDenied'), true);
});

test('协议层 fixPermission 成功后回执带设备列表', async () => {
  const sent = [];
  const handle = createSerialDiagnosticsProtocol({
    sendJson: (client, payload) => sent.push(payload),
    listPorts: async () => [ch340, motherboard],
    applyFix: async () => ['/dev/ttyUSB0'],
    platform: 'linux',
  });

  await handle({ serialDiag: { action: 'fixPermission', requestId: 'r1' } }, {});
  assert.equal(sent[0].serialDiagResult.ok, true);
  assert.equal(sent[0].serialDiagResult.requestId, 'r1');
  assert.match(sent[0].serialDiagResult.message, /\/dev\/ttyUSB0/);
});

test('协议层把修复失败转成回执而不是抛出', async () => {
  const sent = [];
  const handle = createSerialDiagnosticsProtocol({
    sendJson: (client, payload) => sent.push(payload),
    listPorts: async () => [ch340],
    applyFix: async () => { throw new Error('授权被取消'); },
    platform: 'linux',
  });

  await handle({ serialDiag: { action: 'fixPermission', requestId: 'r2' } }, {});
  assert.equal(sent[0].serialDiagResult.ok, false);
  assert.equal(sent[0].serialDiagResult.message, '授权被取消');
});

test('未知操作被拒绝', async () => {
  const sent = [];
  const handle = createSerialDiagnosticsProtocol({
    sendJson: (client, payload) => sent.push(payload),
    listPorts: async () => [],
  });

  await handle({ serialDiag: { action: 'nope', requestId: 'r3' } }, {});
  assert.equal(sent[0].serialDiagResult.ok, false);
  assert.match(sent[0].serialDiagResult.message, /未知串口诊断操作/);
});
