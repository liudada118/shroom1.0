import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { parseUsbCommand, serializeHostState, type HostState } from './hostControl.ts';

/** 按网页发送形式构造命令，允许每个用例覆盖需要验证的字段。 */
function command(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'usb.command', version: 1, requestId: 'request-1', action: 'refresh', ...overrides });
}

test('USB 命令只接受约定版本、类型与四个动作', () => {
  for (const action of ['refresh', 'disconnect', 'demo']) {
    assert.deepEqual(parseUsbCommand(command({ action })), { type: 'usb.command', version: 1, requestId: 'request-1', action });
  }
  for (const raw of ['null', '[]', 'invalid JSON', command({ version: 2 }), command({ type: 'eval' }), command({ action: 'eval' })]) {
    assert.throws(() => parseUsbCommand(raw));
  }
});

test('连接直接保留合法设备与波特率，并拒绝缺失、非整数和越界波特率', () => {
  for (const baudRate of [115200, 1000000]) {
    assert.deepEqual(parseUsbCommand(command({ action: 'connect', baudRate, deviceId: 'driver:1' })), {
      type: 'usb.command', version: 1, requestId: 'request-1', action: 'connect', baudRate, deviceId: 'driver:1',
    });
  }
  assert.equal(parseUsbCommand(command({ action: 'connect', baudRate: 460800 })).action, 'connect');
  for (const baudRate of [undefined, null, '1000000', 115199, 1000001, 115200.5]) {
    assert.throws(() => parseUsbCommand(command({ action: 'connect', baudRate })));
  }
});

test('命令大小、请求标识和设备标识在进入原生模块前受到约束', () => {
  for (const requestId of ['', '   ', 123, 'x'.repeat(81)]) assert.throws(() => parseUsbCommand(command({ requestId })));
  assert.equal(parseUsbCommand(command({ requestId: 'x'.repeat(80) })).requestId.length, 80);
  for (const deviceId of ['', '   ', 1, null, 'x'.repeat(257)]) {
    assert.throws(() => parseUsbCommand(command({ action: 'connect', baudRate: 1000000, deviceId })));
  }
  assert.equal(parseUsbCommand(command({ action: 'connect', baudRate: 1000000, deviceId: 'x'.repeat(256) })).action, 'connect');
  assert.throws(() => parseUsbCommand(command({ ignored: 'x'.repeat(2048) })));
});

test('状态作为 JSON 数据传递，设备名和错误文本不能执行脚本', () => {
  const hostile = '\");globalThis.injected=true;//</script>\u2028\u2029';
  const state: HostState = {
    status: 'USB 连接失败', error: hostile, devices: [{ id: 'usb:1', name: hostile, vendorId: 6790, productId: 29987 }],
    selectedDevice: 'usb:1', baudRate: 1000000, busy: false, frameCount: 10, source: 'usb',
  };
  let received: unknown;
  const context = { window: { ShroomMobileHost: { receive: (value: unknown) => { received = value; } } }, injected: false };
  const script = serializeHostState(state);
  vm.runInNewContext(script, context);
  assert.equal(context.injected, false);
  assert.deepEqual(JSON.parse(JSON.stringify(received)), { type: 'host.state', version: 1, ...state });
  assert.equal(script.includes('</script>'), false);
  assert.equal(script.includes('\u2028'), false);
  assert.doesNotThrow(() => vm.runInNewContext(script, { window: {} }));
});

test('尚未选择设备的状态明确发送 null，页面不会保留旧设备', () => {
  let received: Record<string, unknown> | undefined;
  vm.runInNewContext(serializeHostState({ status: '等待连接', error: '', devices: [], selectedDevice: undefined, baudRate: 1000000, busy: false, frameCount: 0, source: null }), {
    window: { ShroomMobileHost: { receive: (value: Record<string, unknown>) => { received = value; } } },
  });
  assert.equal(received?.selectedDevice, null);
  assert.equal(received?.source, null);
});

test('页面重新加载、崩溃和失败都取消会话，重新渲染不会改变 WebView source 引用', () => {
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(source, /const suspendWebSession = useCallback\(\(\) => \{\s*webReady\.current = false;\s*dispatcher\.setNotReady\(\);\s*void stop\(\);/);
  assert.match(source, /onLoadStart=\{\(\) => \{ suspendWebSession\(\);/);
  assert.match(source, /onContentProcessDidTerminate=\{\(\) => \{ suspendWebSession\(\); webView\.current\?\.reload\(\);/);
  assert.match(source, /onError=\{\(event\) => \{ suspendWebSession\(\);/);
  assert.match(source, /const displaySource = \{ html: displayHtml, baseUrl: 'https:\/\/shroom\.mobile\.local\/' \};/);
  assert.match(source, /source=\{displaySource\}/);
});
