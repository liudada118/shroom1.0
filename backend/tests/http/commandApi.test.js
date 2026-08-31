const assert = require('assert');
const express = require('express');
const http = require('http');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const {
  registerCalibrationZeroCommandHandler,
} = require('../../kernel/platform/commands/registerCalibrationZeroCommandHandler');
const { createZeroCommandService } = require('../../kernel/platform/runtime/zeroCommandService');
const { registerControlRoutes } = require('../../kernel/platform/http/controlRoutes');

/**
 * 端到端跑一遍控制命令的 HTTP 入口：真起 express server、真发 HTTP 请求、真关掉。
 *
 * 不 mock 掉 HTTP 是有意的 —— 这条链路最容易出错的地方就在框架边界上
 * （body 解析、路由匹配、状态码）。整体包成 async 函数是因为 CommonJS 没有顶层
 * await；末尾 `run().then/.catch` 收尾，`run-tests.js` 只看退出码。
 *
 * @returns {Promise<void>} 断言失败时 reject。
 */
async function run() {
  const router = createControlCommandRouter();
  const received = [];
  const dynamicReceived = [];
  const serialStatusRoles = [];
  router.register({
    name: 'serial-open',
    when: (message) => message.sitPort != null,
    handle: (message) => {
      received.push(message);
      return { opened: true };
    },
  });
  router.register({
    name: 'serial-dynamic',
    when: (message) => message.channelPorts != null || message.channelClose != null,
    handle: (message) => {
      dynamicReceived.push(message);
      return { accepted: true };
    },
  });
  const controlCommandService = createControlCommandService({ commandRouter: router });
  const zeroOperations = [];
  const zeroCommandService = createZeroCommandService({
    zeroStateStore: {
      capture: (channelIds) => {
        zeroOperations.push({ operation: 'capture', channelIds });
        return { affectedChannelIds: channelIds, skipped: [] };
      },
      clear: (channelIds) => {
        zeroOperations.push({ operation: 'clear', channelIds });
        return { affectedChannelIds: channelIds, skipped: [] };
      },
    },
    getActiveDisplaySystemId: () => 'display-a',
    resolveTargetChannelIds: ({ displaySystemId, channelIds }) => {
      if (displaySystemId === 'missing') {
        return {
          channelIds: [],
          skipped: [{ displaySystemId, reason: 'unknown-display-system' }],
        };
      }
      return { channelIds: channelIds || ['display-a:seat'], skipped: [] };
    },
  });
  registerCalibrationZeroCommandHandler(controlCommandService, { zeroCommandService });
  const app = express();
  app.use(express.json());
  registerControlRoutes(app, {
    controlCommandService,
    getPort: (ports) => ports,
    getRealtimeChannels: () => [],
    listPorts: async () => [],
    logger: { warn: () => {} },
    serialManager: {
      getStatus: (role) => {
        serialStatusRoles.push(role);
        return { role: role || null };
      },
    },
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

    const zeroResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'calibration.zero',
        payload: {
          enabled: true,
          displaySystemId: 'display-a',
          channelIds: ['display-a:seat'],
        },
        requestId: 'req-http-zero',
      }),
    });
    const zeroBody = await zeroResponse.json();
    assert.strictEqual(zeroResponse.status, 200);
    assert.strictEqual(zeroBody.data.ok, true);
    assert.deepStrictEqual(zeroBody.data.data.results[0].affectedChannelIds, ['display-a:seat']);
    assert.deepStrictEqual(zeroOperations, [{
      operation: 'capture',
      channelIds: ['display-a:seat'],
    }]);

    const invalidZeroResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'calibration.zero',
        payload: { enabled: 'true' },
        requestId: 'req-http-zero-invalid',
      }),
    });
    const invalidZeroBody = await invalidZeroResponse.json();
    assert.strictEqual(invalidZeroResponse.status, 400);
    assert.strictEqual(invalidZeroBody.data.code, 'INVALID_COMMAND');

    const emptyZeroResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'calibration.zero',
        payload: { enabled: false, channelIds: [] },
        requestId: 'req-http-zero-empty',
      }),
    });
    const emptyZeroBody = await emptyZeroResponse.json();
    assert.strictEqual(emptyZeroResponse.status, 400);
    assert.strictEqual(emptyZeroBody.data.code, 'INVALID_COMMAND');

    const unknownZeroResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'calibration.zero',
        payload: { enabled: false, displaySystemId: 'missing' },
        requestId: 'req-http-zero-unknown',
      }),
    });
    const unknownZeroBody = await unknownZeroResponse.json();
    assert.strictEqual(unknownZeroResponse.status, 409);
    assert.strictEqual(unknownZeroBody.data.code, 'COMMAND_EXECUTION_FAILED');

    const seatAliasResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'serial.open',
        payload: { role: 'seat', path: 'COM10' },
        requestId: 'req-http-seat-alias',
      }),
    });
    assert.strictEqual(seatAliasResponse.status, 200);
    assert.strictEqual(received[1].sitPort, 'COM10');

    const seatStatusResponse = await fetch(`${baseUrl}/api/serial/status?role=seat`);
    assert.strictEqual(seatStatusResponse.status, 200);
    assert.strictEqual(serialStatusRoles.at(-1), 'sit');

    const dynamicCommandResponse = await fetch(`${baseUrl}/api/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'serial.open',
        payload: { role: 'armLeft', path: 'COM11' },
        requestId: 'req-http-dynamic-command',
      }),
    });
    assert.strictEqual(dynamicCommandResponse.status, 200);
    assert.deepStrictEqual(dynamicReceived[0], { channelPorts: { armLeft: 'COM11' } });

    const dynamicRouteResponse = await fetch(`${baseUrl}/api/serial/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'armRight', path: 'COM12' }),
    });
    assert.strictEqual(dynamicRouteResponse.status, 200);
    assert.deepStrictEqual(dynamicReceived[1], { channelPorts: { armRight: 'COM12' } });

    const dynamicCloseResponse = await fetch(`${baseUrl}/api/serial/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'armLeft' }),
    });
    assert.strictEqual(dynamicCloseResponse.status, 200);
    assert.deepStrictEqual(dynamicReceived[2], { channelClose: ['armLeft'] });

    const invalidSerialRouteResponse = await fetch(`${baseUrl}/api/serial/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'armLeft' }),
    });
    const invalidSerialRouteBody = await invalidSerialRouteResponse.json();
    assert.strictEqual(invalidSerialRouteResponse.status, 400);
    assert.strictEqual(invalidSerialRouteBody.data.code, 'INVALID_COMMAND');

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
    assert.strictEqual(received.length, 2);
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
