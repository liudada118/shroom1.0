const assert = require('assert');
const {
  buildMockFrame,
  parseArgs,
  runMock,
} = require('@shroom/backend/examples/serial-chain-demo.js');
const { ShroomSensorSDK } = require('@shroom/backend/session');

async function run() {
  const args = parseArgs([
    '--sensor', 'hand0205',
    '--channel', 'back',
    '--port', 'COM7',
    '--duration', '123',
    '--max-frames', '4',
    '--capture', 'none',
  ]);
  assert.strictEqual(args.sensorType, 'hand0205');
  assert.strictEqual(args.channel, 'back');
  assert.strictEqual(args.port, 'COM7');
  assert.strictEqual(args.durationMs, 123);
  assert.strictEqual(args.maxFrames, 4);
  assert.strictEqual(args.capture, 'none');

  const sdk = new ShroomSensorSDK({ store: null });
  const profile = sdk.registry.getProfile('hand0205');
  const mockFrame = buildMockFrame(profile);
  assert.strictEqual(mockFrame.length, 260);
  const parsed = sdk.registry.parse('hand0205', mockFrame, { channel: 'sit', profile });
  assert.strictEqual(parsed.pressureData.length, 256);
  assert.strictEqual(parsed.rotate.length, 4);
  sdk.close();

  await runMock({
    capture: 'memory',
    channel: 'sit',
    sensorType: 'hand0205',
  });
}

run()
  .then(() => console.log('serialChainDemo.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
