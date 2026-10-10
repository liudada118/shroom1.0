const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readManagedRelease } = require('../../extension-host/runtime/displaySystemRuntimeDiscovery');
const { buildDisplaySystemRuntimeDefinition } = require('../../extension-host/manifest/displaySystemDefinitionBuilder');
const { attachRuntimeChannelPlan } = require('../../extension-host/runtime/displaySystemRuntimeChannelPlanner');
const { createDisplaySystemFrameProcessor } = require('../../extension-host/runtime/displaySystemFrameProcessorFactory');
const { createCollectionFrameStorageService } = require('@shroom/backend/collection/collectionFrameStorageService');
const { createPlaybackFrameService } = require('../../kernel/playback/playbackFrameService');

test('a managed Manifest recording retains the release that mapped its frame', () => {
  const sourceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-release-history-'));
  try {
    const sha256 = 'a'.repeat(64);
    fs.writeFileSync(path.join(sourceDirectory, 'package-info.json'),
      JSON.stringify({ systemId: 'seat-demo', version: 12, sha256 }));
    const managedRelease = readManagedRelease({ id: 'seat-demo', sourceDirectory });
    assert.deepEqual(managedRelease, { version: 12, sha256 });
    assert.equal(readManagedRelease({ id: 'another-system', sourceDirectory }), null);

    const system = {
      id: 'seat-demo', name: 'Seat Demo', version: 3,
      sensor: { id: 'sit', type: 'seat-demo-sit', matrix: { rows: 1, cols: 2 } },
      sensors: [{ id: 'sit', type: 'seat-demo-sit', outputChannel: 'sit',
        matrix: { rows: 1, cols: 2 }, stored: true }],
      display: { views: [{ id: 'heatmap', type: 'heatmap' }] },
      managed: true, managedRelease,
    };
    const [planned] = attachRuntimeChannelPlan(buildDisplaySystemRuntimeDefinition(system)).runtimeChannels;
    assert.deepEqual(planned.managedRelease, managedRelease);

    const frame = createDisplaySystemFrameProcessor({ runtimeChannel: {
      ...planned, protocol: null,
      processing: { lineOrder: { source: null }, pointOrder: { source: null },
        algorithm: { type: 'none', enabled: false } },
    } }).processFrame([4, 7]);
    assert.deepEqual(frame.managedRelease, managedRelease);
    const serialized = createCollectionFrameStorageService().buildDisplaySystemCollectionData(frame, 'sitData');
    assert.deepEqual(JSON.parse(serialized).managedRelease, managedRelease);
    const replayed = createPlaybackFrameService({}).parseDisplaySystemPlaybackFrame({ data: serialized }, 'sitData');
    assert.deepEqual(replayed.managedRelease, managedRelease);
    assert.deepEqual(replayed.sitData, [4, 7]);

    fs.writeFileSync(path.join(sourceDirectory, 'package-info.json'),
      JSON.stringify({ systemId: 'seat-demo', version: 0, sha256 }));
    assert.equal(readManagedRelease({ id: 'seat-demo', sourceDirectory }), null);
  } finally {
    fs.rmSync(sourceDirectory, { recursive: true, force: true });
  }
});
