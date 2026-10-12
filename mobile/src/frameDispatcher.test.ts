import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameDispatcher } from './frameDispatcher.ts';
import { createDemoFrame, isCurrentUsbFrame, isPressureFrame } from './pressureContract.ts';

/** 从注入脚本中还原消息，按真实 WebView 接口检查发送行为。 */
function readMessage(script: string): Record<string, unknown> {
  return JSON.parse(script.split('.receive(')[1].slice(0, -7));
}

test('压力帧必须为32×32 uint8数据，演示不能标成USB', () => {
  const frame = createDemoFrame(0, 1000);
  assert.equal(isPressureFrame(frame), true);
  assert.equal(frame.source, 'demo');
  assert.equal(isPressureFrame({ ...frame, values: frame.values.slice(1) }), false);
  assert.equal(isPressureFrame({ ...frame, values: [...frame.values.slice(1), NaN] }), false);
  assert.equal(isPressureFrame({ ...frame, values: [...frame.values.slice(1), 256] }), false);
  assert.equal(isPressureFrame({ ...frame, timestamp: -1 }), false);
});

test('页面ready前缓冲最近帧，慢页面最多一帧在途', () => {
  const sent: string[] = [];
  const bridge = new FrameDispatcher((script) => sent.push(script));
  bridge.reset('demo');
  for (let sequence = 0; sequence < 20; sequence++) bridge.publish(createDemoFrame(sequence, sequence + 1));
  assert.equal(sent.length, 0);
  bridge.setReady();
  assert.equal(sent.length, 2);
  assert.equal(readMessage(sent[0]).type, 'stream.reset');
  assert.equal(readMessage(sent[1]).timestamp, 20);
  for (let sequence = 20; sequence < 100; sequence++) bridge.publish(createDemoFrame(sequence, sequence + 1));
  assert.equal(sent.length, 2);
  bridge.acknowledge(readMessage(sent[1]).sequence);
  assert.equal(sent.length, 3);
  assert.equal(readMessage(sent[2]).timestamp, 100);
});

test('切换USB后清空演示、拒绝迟到帧和旧回执，停止后不再发送', () => {
  const sent: string[] = [];
  const bridge = new FrameDispatcher((script) => sent.push(script));
  bridge.setReady();
  bridge.reset('demo');
  bridge.publish(createDemoFrame(0, 100));
  const oldSequence = readMessage(sent.at(-1)!).sequence;
  bridge.reset('usb');
  assert.equal(bridge.publish(createDemoFrame(1, 200)), false);
  const usb = { ...createDemoFrame(0, 300), source: 'usb' as const };
  assert.equal(bridge.publish(usb), true);
  assert.equal(bridge.publish(usb), false);
  assert.equal(bridge.acknowledge(oldSequence), false);
  bridge.reset(null);
  assert.equal(bridge.publish({ ...usb, sequence: 1 }), false);
  assert.equal(readMessage(sent.at(-1)!).source, null);
});

test('WebView重载后重新同步来源及最近帧', () => {
  const sent: string[] = [];
  const bridge = new FrameDispatcher((script) => sent.push(script));
  bridge.reset('demo');
  bridge.setReady();
  bridge.publish(createDemoFrame(0, 100));
  bridge.setNotReady();
  bridge.publish(createDemoFrame(1, 200));
  bridge.setReady();
  assert.equal(readMessage(sent.at(-2)!).source, 'demo');
  assert.equal(readMessage(sent.at(-1)!).timestamp, 200);
});

test('USB重连后拒绝旧连接高序号帧，重复ready不清除在途帧', () => {
  const frame = { ...createDemoFrame(100, 1000), source: 'usb' as const, connectionId: 'old' };
  assert.equal(isCurrentUsbFrame(frame, 'new'), false);
  assert.equal(isCurrentUsbFrame(frame, null), false);
  assert.equal(isCurrentUsbFrame({ ...frame, connectionId: 'new' }, 'new'), true);
  const sent: string[] = [];
  const bridge = new FrameDispatcher((script) => sent.push(script));
  bridge.reset('demo'); bridge.setReady(); bridge.publish(createDemoFrame(0, 100));
  const before = sent.length;
  bridge.setReady();
  assert.equal(sent.length, before);
  assert.equal(bridge.acknowledge(readMessage(sent.at(-1)!).sequence), true);
});
