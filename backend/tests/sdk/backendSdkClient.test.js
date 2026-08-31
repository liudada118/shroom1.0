const assert = require('assert');
const { EventEmitter } = require('events');
const {
  BackendSdkClient,
  normalizeHttpResult,
} = require('@shroom/backend/client/BackendSdkClient.js');
const {
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  buildSdkContractSnapshot,
} = require('@shroom/backend/contract/sdkApiContract.js');

/**
 * 造一个最小的假 fetch Response，只有 `ok` / `status` / `json()` 三样。
 *
 * `json` 保持 async，与真实 fetch 一致 —— 写成同步的话客户端漏写 `await` 也能过测试。
 *
 * @param {unknown} payload `json()` 要解析出的内容。
 * @param {{ok?: boolean, status?: number}} [options] 覆盖成功状态，用来测失败分支。
 * @returns {object} 假 Response。
 */
function createResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

const requests = [];
/**
 * 假的 `fetch`：按 URL 后缀路由到各接口的固定响应，并把每次请求记进 `requests`。
 *
 * 三个要点：URL 不在名单里直接 **throw**（多发一个没预期的请求立刻失败）；
 * 记下 url/options 以便断言请求次数（契约快照该被缓存，每次重拉功能正常但白跑网络）；
 * `/api/commands` 分支**回读 body 里的 requestId** 拼回执，回死值就测不出客户端有没有
 * 正确匹配回执。响应体是 `HttpResult` 形状（`code` 0 成功 / 1 失败，不是 HTTP 状态码）。
 *
 * @param {string} url 请求地址。
 * @param {object} [options] fetch 选项（method/body/headers）。
 * @returns {Promise<object>} 假 Response。
 * @throws {Error} URL 不在预期名单内时抛。
 */
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

/**
 * 假的 WebSocket，作为 `WebSocketImpl` 注入给 `BackendSdkClient`。
 *
 * 关键是**异步打开**：`readyState` 先是 0，`setImmediate` 之后才置 1 并回调 `onopen`。
 * 立刻置 1 的话，客户端里「连上之前就 send」的缺陷会被掩盖。
 * `sent` 数组存已解析的消息对象，断言可以直接查发了什么。
 */
class FakeWebSocket extends EventEmitter {
  /**
   * @param {string} url 连接地址，原样存到 `this.url` 供断言。
   */
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

  /**
   * 记下发出的消息。**入参必须是 JSON 字符串** —— 这里直接 `JSON.parse`，
   * 客户端若发了对象而非序列化字符串，会在这里抛而不是静默通过。
   *
   * @param {string} message 序列化后的消息。
   */
  send(message) {
    this.sent.push(JSON.parse(message));
  }

  /** 关闭连接：置 `readyState = 3` 并回调 `onclose`，与浏览器语义一致。 */
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

/**
 * 验 `BackendSdkClient` 与后端契约的对接：契约快照、`normalizeHttpResult`、
 * HTTP 各接口、命令回执匹配、WebSocket 订阅与收帧。
 *
 * 全靠注入的 `fetchImpl` / `WebSocketImpl` 跑，不碰真网络。
 *
 * @returns {Promise<void>} 断言失败时 reject。
 */
async function run() {
  const snapshot = buildSdkContractSnapshot({ channels: [{ id: 'demo:sit' }] });
  assert.strictEqual(snapshot.websocket.messageTypes.SENSOR_FRAME, 'sensor.frame');
  assert.deepStrictEqual(snapshot.websocket.subscribeExample.channels, ['car:sit']);
  assert.strictEqual(snapshot.telemetry.channelIdPattern, '{displaySystemId}:{sensorId}');
  assert.strictEqual(snapshot.telemetry.frameShape.sensorLabel, 'string');
  assert.strictEqual(snapshot.telemetry.frameShape.serial, 'object|null');
  assert.strictEqual(snapshot.telemetry.frameShape.payload.value, 'number[]');
  assert.strictEqual(DISPLAY_SYSTEM_SCHEMA_VERSION, 3);
  assert.strictEqual(snapshot.displaySystems.schemaVersion, 3);
  assert.strictEqual(snapshot.displaySystems.manifestShape.sensors[0].label, 'string (optional; defaults to id)');
  assert.strictEqual(snapshot.displaySystems.manifestShape.sensors[0].stored, 'boolean (optional; defaults to true)');
  assert.strictEqual(snapshot.displaySystems.manifestShape.sensors[0].files.lineOrder, 'string');
  assert.strictEqual(snapshot.displaySystems.manifestShape.sensors[0].protocol.baudRate, 'positive integer');
  assert.strictEqual(snapshot.displaySystems.manifestShape.sensors[0].algorithm.timeoutMs, 'positive integer');
  assert.deepStrictEqual(snapshot.displaySystems.manifestShape.legacyCompatibility.supportedSchemaVersions, [1, 2]);
  assert.strictEqual(snapshot.displaySystems.manifestShape.sensor.ports, 'string[]');

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
  const ws = client.connectRealtime({ channels: ['demo:sit'] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepStrictEqual(ws.sent[0], { type: 'subscribe', channels: ['demo:sit'] });

  client.handleRealtimeMessage(JSON.stringify({
    type: 'sensor.frame',
    schemaVersion: 1,
    channelId: 'demo:sit',
    displaySystemId: 'demo',
    sensorId: 'sit',
    sensorLabel: '座椅',
    outputChannel: 'sit',
    serial: { role: 'seatPort', path: 'COM3', baudRate: 115200 },
    payload: { value: [1, 2, 3] },
  }));
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].sensorLabel, '座椅');
  assert.deepStrictEqual(messages[0].serial, { role: 'seatPort', path: 'COM3', baudRate: 115200 });
  assert.deepStrictEqual(messages[0].payload.value, [1, 2, 3]);
}

run()
  .then(() => console.log('backendSdkClient.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
