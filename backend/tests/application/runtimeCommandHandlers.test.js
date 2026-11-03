const assert = require('assert');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { registerRuntimeCommandHandlers } = require('../../kernel/platform/commands/registerRuntimeCommandHandlers');

const router = createControlCommandRouter();
const patches = [];
registerRuntimeCommandHandlers(router, { runtimeControlService: {
  updateRuntimeOptions: (message) => patches.push(message),
} });

router.handle({ type: 'serial.open', payload: { role: 'sit', path: 'COM1', baudRate: 921600 }, requestId: 'isolated-sit' });
router.handle({ type: 'serial.open', payload: { role: 'armLeft', path: 'COM2', baudRate: 6000000 }, requestId: 'isolated-manifest' });
assert.deepStrictEqual(patches, [], 'opening a device must not change the default baud rate for other devices');
router.handle({ sitPort: 'COM1', baudRate: 921600, gauss: 2 });
assert.deepStrictEqual(patches.pop(), { gauss: 2 }, 'unrelated display settings still apply');
router.handle({ type: 'runtime.configure', payload: { baudRate: 1500000 }, requestId: 'legacy-runtime-option' });
assert.deepStrictEqual(patches.pop(), { baudRate: 1500000 }, 'explicit legacy runtime configuration remains supported');

console.log('runtimeCommandHandlers.test.js passed');
