const assert = require('assert');
const { EventEmitter } = require('events');
const {
  BackendSdkClient,
  normalizeHttpResult,
} = require('@shroom/backend/client/BackendSdkClient.js');

function createResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

const requests = [];
const fetchImpl = async (url, options = {}) => {
  requests.push({ url, options });
  if (url.endsWith('/api/sdk/contract')) {
    return createResponse({
      apiVersion: 'v1',
      contractVersion: 'demo',
      http: {
        routes: {
          sdkContract: '/api/sdk/contract',
          serialPorts: '/api/serial/ports',
          serialOpen: '/api/serial/open',
          displaySystemById: '/api/display-systems/:id',
        },
      },
      websocket: {
        messageTypes: {
          SUBSCRIBE: 'subscribe',
          UNSUBSCRIBE: 'unsubscribe',
        },
      },
    });
  }
  if (url.endsWith('/api/serial/ports')) {
    return createResponse({ code: 0, data: { ports: [{ path: 'COM3' }] }, message: 'success' });
  }
  if (url.endsWith('/api/serial/open')) {
    return createResponse({ code: 0, data: { handled: true }, message: 'success' });
  }
  if (url.endsWith('/api/commands')) {
    const command = JSON.parse(options.body);
    return createResponse({
      code: 0,
      data: {
        type: 'command.ack',
        requestId: command.requestId,
        commandType: command.type,
        ok: true,
        code: 'OK',
      },
      message: 'success',
    });
  }
  if (url.endsWith('/api/display-systems/demo')) {
    return createResponse({ displaySystem: { id: 'demo' } });
  }
  throw new Error(`unexpected URL: ${url}`);
};

class FakeWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    setImmediate(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }

  send(message) {
    this.sent.push(JSON.parse(message));
  }

  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

async function run() {
  assert.deepStrictEqual(normalizeHttpResult({ code: 0, data: { ok: true } }), { ok: true });
  assert.throws(() => normalizeHttpResult({ code: 1, message: 'bad' }), /bad/);

  const client = new BackendSdkClient({
    fetchImpl,
    WebSocketImpl: FakeWebSocket,
    httpBaseUrl: 'http://backend.test/',
    wsUrl: 'ws://backend.test',
  });

  const contract = await client.getContract();
  assert.strictEqual(contract.contractVersion, 'demo');

  const ports = await client.listSerialPorts();
  assert.deepStrictEqual(ports, { ports: [{ path: 'COM3' }] });

  const openResult = await client.openSerial({ role: 'sit', port: 'COM3' });
  assert.deepStrictEqual(openResult, { handled: true });
  assert.deepStrictEqual(JSON.parse(requests.at(-1).options.body), { role: 'sit', port: 'COM3' });

  const displaySystem = await client.getDisplaySystem('demo');
  assert.deepStrictEqual(displaySystem, { displaySystem: { id: 'demo' } });

  const commandAck = await client.executeCommand('serial.close', { roles: ['sit'] }, { requestId: 'req-sdk-1' });
  assert.strictEqual(commandAck.type, 'command.ack');
  assert.strictEqual(commandAck.requestId, 'req-sdk-1');
  assert.deepStrictEqual(JSON.parse(requests.at(-1).options.body), {
    type: 'serial.close',
    payload: { roles: ['sit'] },
    requestId: 'req-sdk-1',
  });

  const messages = [];
  client.on('frame', (frame) => messages.push(frame));
  const ws = client.connectRealtime({ channels: ['sit'] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepStrictEqual(ws.sent[0], { type: 'subscribe', channels: ['sit'] });

  client.handleRealtimeMessage(JSON.stringify({
    frames: [{ channelId: 'demo.sit', value: [1, 2, 3] }],
  }));
  assert.strictEqual(messages.length, 1);
  assert.deepStrictEqual(messages[0].value, [1, 2, 3]);
}

run()
  .then(() => console.log('backendSdkClient.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
