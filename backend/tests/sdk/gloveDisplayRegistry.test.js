const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const frontendCatalog = import(pathToFileURL(path.join(__dirname, '../../../sdk/frontend/src/display/defaultDisplaySystems.js')).href);

test('SDK display registry resolves all five restored single-glove renderer symbols', async () => {
  const { createDefaultDisplayRegistry } = await frontendCatalog;
  const registry = createDefaultDisplayRegistry();
  const single = registry.get('hand0205');
  assert.equal(single.label, '触觉手套');
  assert.deepEqual(single.channels, ['sit', 'back']);
  assert.equal(registry.getDefaultMode('hand0205'), 'normal');
  assert.deepEqual(registry.getModes('hand0205'), ['normal', 'num', 'num3D', 'numoriginal', 'skin']);
  for (const [mode, renderer] of Object.entries({
    normal: 'Hand0205', num: 'LegacyGloveNum2D', num3D: 'Num3D',
    numoriginal: 'LegacyGloveNum2DOriginal', skin: 'HandSkin',
  })) {
    assert.equal(registry.getRendererKey('hand0205', mode), renderer);
    assert.equal(registry.getRendererKey('hand0205Single', mode), renderer);
  }
  assert.equal(registry.has('hand0205Single'), true, 'old SDK key resolves through the canonical system');
  assert.equal(registry.get('hand0205Single'), single);
  assert.equal(registry.list().some((system) => system.key === 'hand0205Single'), false, 'alias must not add a third runtime option');
});

test('SDK display registry names the current glove2 and preserves its control and mode capabilities', async () => {
  const { createDefaultDisplayRegistry } = await frontendCatalog;
  const registry = createDefaultDisplayRegistry();
  const dual = registry.get('hand0205Double');
  const single = registry.get('hand0205');
  assert.equal(dual.label, '触觉手套2');
  assert.equal(registry.getRendererKey('hand0205Double', 'normal'), 'Hand0205Double');
  assert.equal(registry.getRendererKey('hand0205Double', 'num'), 'GloveHandNum2D');
  assert.equal(registry.getRendererKey('hand0205Double', 'numoriginal'), 'Num2DOriginal');
  assert.deepEqual(single.controls, dual.controls);
  assert.equal(dual.controls.serial, true);
  assert.equal(dual.controls.calibrate, true);
  assert.equal(dual.controls.capture, true);
  assert.equal(dual.controls.replay, true);
  assert.equal(dual.controls.download, true);
  assert.deepEqual(registry.getModes('hand0205Double'), ['normal', 'num', 'num3D', 'numoriginal', 'skin']);
  assert.equal(registry.getRendererKey('hand0205Double', 'unknown-mode'), 'Hand0205Double');
  assert.equal(registry.getRendererKey('unknown-system', 'normal'), null);
});

test('SDK display registry still permits host overrides and keeps unrelated glove systems unchanged', async () => {
  const { createDefaultDisplayRegistry } = await frontendCatalog;
  const original = createDefaultDisplayRegistry();
  assert.equal(original.getRendererKey('handGlove115200', 'normal'), 'Hand0205');
  assert.equal(original.getRendererKey('handGlove115200', 'num'), 'Num2D');
  assert.equal(original.getDefaultMode('handGloveFullPacket'), 'num');
  const registry = createDefaultDisplayRegistry([{
    key: 'hand0205', aliases: ['hand0205Single'], label: 'Host renderer', defaultMode: 'custom',
    modes: ['custom'], renderers: { custom: 'HostGlove' },
  }]);
  assert.equal(registry.getRendererKey('hand0205Single', 'custom'), 'HostGlove');
  assert.equal(registry.get('hand0205Single').label, 'Host renderer');
  assert.equal(registry.get('hand0205').label, 'Host renderer');
  assert.equal(registry.get('hand0205Double').label, '触觉手套2');
});
