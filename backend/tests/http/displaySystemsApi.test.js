const assert = require('assert');
const http = require('http');
const os = require('os');
const { createHttpApp } = require('../../server/httpAppFactory');

async function main() {
  const displaySystemStatus = {
    count: 1,
    systems: [{ id: 'demo', name: 'Demo' }],
    runtimeChannelRegistry: {
      count: 1,
      channels: [{ id: 'demo:sit', status: 'registered' }],
    },
    runtimeBindings: {
      count: 1,
      bindings: [{ id: 'demo:sit', status: 'bound' }],
    },
    runtimeDispatcher: {
      started: true,
      bindingCount: 1,
      activeHandlerCount: 1,
      handlers: [{ bindingId: 'demo:sit', parserChannel: 'sit' }],
    },
  };
  const httpApp = createHttpApp({
    controlCommandService: { executeHttp: () => ({ handled: false, stop: false, results: [] }) },
    getChannelBusStatus: () => ({}),
    getDisplaySystemById: (id) => (id === 'demo' ? { id: 'demo', name: 'Demo' } : null),
    getDisplaySystemStatus: () => displaySystemStatus,
    getPort: (ports) => ports,
    getRealtimeChannels: () => [],
    getSerialStatus: () => [],
    getSitDb: () => ({ all: () => {} }),
    getWsSubscriptionStatus: () => ({}),
    imgPath: os.tmpdir(),
    listPorts: async () => [],
    logger: { error: () => {}, warn: () => {} },
    pdfPath: os.tmpdir(),
    serialManager: { getStatus: () => [] },
  });

  const server = http.createServer(httpApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems`);
    const statusBody = await statusResponse.json();
    assert.strictEqual(statusResponse.status, 200);
    assert.strictEqual(statusBody.displaySystems.count, 1);
    assert.strictEqual(statusBody.displaySystems.runtimeChannelRegistry.count, 1);
    assert.strictEqual(statusBody.displaySystems.runtimeBindings.count, 1);
    assert.strictEqual(statusBody.displaySystems.runtimeDispatcher.activeHandlerCount, 1);

    const detailResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems/demo`);
    const detailBody = await detailResponse.json();
    assert.strictEqual(detailResponse.status, 200);
    assert.strictEqual(detailBody.displaySystem.id, 'demo');

    const invalidJsonResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"broken"',
    });
    const invalidJsonBody = await invalidJsonResponse.json();
    assert.strictEqual(invalidJsonResponse.status, 400);
    assert.strictEqual(invalidJsonBody.error, 'invalid json body');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main()
  .then(() => {
    console.log('displaySystemsApi.test.js passed');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
