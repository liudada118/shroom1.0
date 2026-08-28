const assert = require('assert');
const express = require('express');
const http = require('http');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { createWebSocketCommandRouter } = require('../../kernel/platform/websocket/webSocketCommandRouter');
const { registerControlRoutes } = require('../../kernel/platform/http/controlRoutes');

async function run() {
  const router = createWebSocketCommandRouter();
  const received = [];
  router.register({
    name: 'serial-open',
    when: (message) => message.sitPort != null,
    handle: (message) => {
      received.push(message);
      return { opened: true };
    },
  });
  const controlCommandService = createControlCommandService({ commandRouter: router });
  const app = express();
  app.use(express.json());
  registerControlRoutes(app, {
    controlCommandService,
    getPort: (ports) => ports,
    getRealtimeChannels: () => [],
    listPorts: async () => [],
    logger: { warn: () => {} },
    serialManager: { getStatus: () => ({}) },
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const successResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'serial.open',
        payload: { role: 'sit', path: 'COM9' },
        requestId: 'req-http-1',
      }),
    });
    const successBody = await successResponse.json();
    assert.strictEqual(successResponse.status, 200);
    assert.strictEqual(successBody.code, 0);
    assert.strictEqual(successBody.data.type, 'command.ack');
    assert.strictEqual(successBody.data.requestId, 'req-http-1');
    assert.strictEqual(successBody.data.code, 'OK');
    assert.strictEqual(successBody.data.ok, true);
    assert.strictEqual(received[0].sitPort, 'COM9');

    const invalidResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'serial.open', payload: { role: 'sit', path: 'COM9' } }),
    });
    const invalidBody = await invalidResponse.json();
    assert.strictEqual(invalidResponse.status, 400);
    assert.strictEqual(invalidBody.data.code, 'INVALID_COMMAND');
    assert.strictEqual(invalidBody.data.ok, false);

    const unsupportedResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'unknown.command', payload: {}, requestId: 'req-http-2' }),
    });
    const unsupportedBody = await unsupportedResponse.json();
    assert.strictEqual(unsupportedResponse.status, 404);
    assert.strictEqual(unsupportedBody.data.code, 'COMMAND_NOT_SUPPORTED');

    const wsResult = controlCommandService.executeWs({
      type: 'serial.open',
      payload: { role: 'sit', path: 'COM10' },
      requestId: 'req-ws-1',
    });
    assert.strictEqual(wsResult.stop, true);
    assert.strictEqual(wsResult.error.code, 'TRANSPORT_NOT_ALLOWED');
    assert.strictEqual(received.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .then(() => console.log('commandApi.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
