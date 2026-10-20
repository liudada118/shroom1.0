const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createUsageAnalytics } = require('../../../app/electron/usageAnalytics');

const KEY = 'ab'.repeat(64);

/** Allocate an isolated usage queue and remove only its verified temporary root. */
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-usage-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** Drive the real uploader with captured immutable requests and a replaceable response. */
function uploader(t, response) {
  const requests = [], root = temporary(t);
  let reply = response;
  const service = createUsageAnalytics({ root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => KEY,
    getRuntimeVersions: () => ({ frontendBuildId: 42, hostContract: 1 }),
    fetchImpl: async (_url, request) => {
      requests.push(JSON.parse(request.body));
      return reply(requests.at(-1));
    } });
  t.after(() => service.dispose());
  return { service, requests, root, respond: next => { reply = next; } };
}

/** Acknowledge the exact batch without altering event IDs or version snapshots. */
function acknowledge(batch) {
  return new Response(JSON.stringify({ accepted: true, eventIds: batch.events.map(event => event.eventId) }));
}

test('real HTTP 400 schema rejection retains versioned events until an explicit unchanged retry succeeds', async t => {
  const root = temporary(t), received = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    response.writeHead(received.length === 1 ? 400 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(received.length === 1 ? { error: 'INVALID_PAYLOAD', detail: 'secret server schema /Users/private' }
      : { accepted: true, eventIds: received.at(-1).events.map(event => event.eventId) }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const service = createUsageAnalytics({ root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => KEY,
    getRuntimeVersions: () => ({ frontendBuildId: 42, hostContract: 1 }), endpoint: `http://127.0.0.1:${server.address().port}/api/usage/events/batch` });
  t.after(() => service.dispose());
  const rejected = await service.flush(true);
  assert.equal(rejected.lastErrorCode, 'INVALID_PAYLOAD'); assert.equal(rejected.httpStatus, 400);
  assert.match(rejected.lastError, /格式.*不兼容/); assert.doesNotMatch(rejected.lastError, /密钥|secret|private/);
  assert.equal(rejected.queued, received[0].events.length); assert.equal(rejected.nextRetryAt, 0);
  await service.flush(true); assert.equal(received.length, 1, '4xx must stop automatic retries even for a forced background flush');
  const result = await service.retry();
  assert.deepEqual(received[1], received[0], 'a server compatibility failure cannot rewrite transmitted IDs or remove version fields');
  assert.deepEqual(received[1].events[0].runtimeVersions, { frontendBuildId: 42, hostContract: 1 });
  assert.equal(result.queued, 0); assert.equal(result.lastErrorCode, null); assert.equal(result.httpStatus, null);
});

test('HTML and unrecognized JSON errors on HTTP 400 remain schema failures without reflected server content', async t => {
  const app = uploader(t, () => new Response('<!doctype html><p>secret https://private.invalid token=hidden</p>', { status: 400 }));
  let state = await app.service.flush(true);
  assert.equal(state.lastErrorCode, 'USAGE_HTTP_400'); assert.equal(state.httpStatus, 400);
  assert.match(state.lastError, /格式/); assert.doesNotMatch(JSON.stringify(state), /secret|private|https?:|hidden|密钥/);
  app.respond(() => new Response(JSON.stringify({ error: 'https://private.invalid?token=secret', message: 'raw secret exception' }), { status: 400 }));
  state = await app.service.retry();
  assert.equal(state.lastErrorCode, 'USAGE_HTTP_400'); assert.equal(state.queued, 1);
  assert.deepEqual(app.requests[1], app.requests[0]); assert.doesNotMatch(JSON.stringify(state), /secret|private|https?:/);
  app.respond(() => new Response(JSON.stringify({ error: 'INVALID_LICENSE' }), { status: 400 }));
  state = await app.service.retry();
  assert.equal(state.lastErrorCode, 'USAGE_HTTP_400'); assert.doesNotMatch(state.lastError, /密钥|身份验证/);
});

test('failed response bodies are bounded and oversized streams are cancelled', async t => {
  let cancelled = false;
  const app = uploader(t, () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(17000).fill(97)); },
    cancel() { cancelled = true; },
  }), { status: 400 }));
  const result = await app.service.flush(true);
  assert.equal(cancelled, true); assert.equal(result.lastErrorCode, 'USAGE_HTTP_400');
  assert.equal(result.queued, 1); assert.equal(result.httpStatus, 400);
});

for (const [status, code, message] of [
  [401, 'INVALID_LICENSE', /身份验证/], [403, 'LICENSE_CUSTOMER_REQUIRED', /授权.*客户关联/],
  [409, 'EVENT_CONTENT_CONFLICT', /内容冲突/], [413, 'BATCH_TOO_LARGE', /接收上限/],
]) test(`HTTP ${status} has a specific non-retrying diagnostic and keeps the exact pending batch`, async t => {
  const app = uploader(t, () => new Response(JSON.stringify({ error: code, message: 'secret https://private.invalid/stack' }), { status }));
  const result = await app.service.flush(true);
  assert.equal(result.lastErrorCode, code); assert.equal(result.httpStatus, status);
  assert.match(result.lastError, message); assert.equal(result.queued, 1); assert.equal(result.nextRetryAt, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret|private|https?:/);
  await app.service.flush(); assert.equal(app.requests.length, 1);
  app.respond(acknowledge); const retried = await app.service.retry();
  assert.equal(retried.queued, 0); assert.deepEqual(app.requests[1], app.requests[0]);
});

for (const [status, code] of [[429, 'RATE_LIMITED'], [503, 'STORAGE_UNAVAILABLE']])
  test(`HTTP ${status} retains events and resumes automatically after bounded backoff`, async t => {
    const app = uploader(t, () => new Response(JSON.stringify({ error: code }), { status }));
    const rejected = await app.service.flush(true);
    assert.equal(rejected.lastErrorCode, code); assert.equal(rejected.httpStatus, status);
    assert.ok(rejected.nextRetryAt > Date.now()); assert.equal(rejected.queued, 1);
    await app.service.flush(); assert.equal(app.requests.length, 1);
    app.respond(acknowledge);
    const now = t.mock.method(Date, 'now', () => rejected.nextRetryAt + 1);
    try {
      const result = await app.service.flush();
      assert.equal(result.queued, 0); assert.equal(result.lastErrorCode, null); assert.equal(result.httpStatus, null);
      assert.deepEqual(app.requests[1], app.requests[0]);
    } finally { now.mock.restore(); }
  });

test('an HTML success response is an invalid acknowledgement, never a successful upload', async t => {
  const app = uploader(t, () => new Response('<!doctype html><p>secret /Users/private</p>'));
  const result = await app.service.flush(true);
  assert.equal(result.lastErrorCode, 'USAGE_RESPONSE_INVALID'); assert.equal(result.httpStatus, 200);
  assert.match(result.lastError, /上传确认无效/); assert.doesNotMatch(JSON.stringify(result), /secret|private/);
  assert.equal(result.queued, 1); assert.ok(result.nextRetryAt > Date.now());
});

test('network exceptions cannot inject raw text through a trusted message prefix', async t => {
  const app = uploader(t, () => { throw new Error('使用统计 secret https://private.invalid?token=hidden /Users/private'); });
  const result = await app.service.flush(true);
  assert.equal(result.lastErrorCode, 'USAGE_UPLOAD_FAILED'); assert.equal(result.httpStatus, null);
  assert.doesNotMatch(JSON.stringify(result), /secret|private|hidden|https?:/); assert.equal(result.queued, 1);
});

test('rejected queues survive restart and switching credentials never uploads another customer batch', async t => {
  const root = temporary(t), requests = []; let key = KEY;
  const options = { root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => key,
    fetchImpl: async (_url, request) => {
      requests.push({ credential: request.headers.Authorization, batch: JSON.parse(request.body) });
      return new Response(JSON.stringify({ error: 'INVALID_PAYLOAD' }), { status: 400 });
    } };
  const first = createUsageAnalytics(options); await first.flush(true); await first.dispose();
  const original = requests[0].batch.events[0];
  const second = createUsageAnalytics(options); t.after(() => second.dispose());
  await second.flush(true);
  assert.deepEqual(requests[1].batch.events.find(event => event.eventId === original.eventId), original);
  key = 'cd'.repeat(64); second.record({ eventName: 'collection_started', properties: {} });
  assert.equal(second.status().lastErrorCode, null); assert.equal(second.status().httpStatus, null);
  await second.flush(true);
  assert.equal(requests[2].credential, `License ${key}`);
  assert.equal(requests[2].batch.events.length, 1); assert.equal(requests[2].batch.events[0].eventName, 'collection_started');
  assert.ok(!requests[2].batch.events.some(event => event.eventId === original.eventId));
});
