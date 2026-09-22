const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { requestModelResponse, normalizeModelSettings } = require('../../agent-runtime/provider');

/** 为每个测试创建独立本机模型服务，避免使用真实凭据或外网。 */
async function withModel(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}/v1`); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

test('rejects insecure model endpoints and credentials in URLs', () => {
  assert.throws(() => normalizeModelSettings({ baseUrl: 'http://example.com/v1' }), /HTTPS/);
  assert.throws(() => normalizeModelSettings({ baseUrl: 'https://user:key@example.com/v1' }), /凭据/);
  assert.throws(() => normalizeModelSettings({ baseUrl: 'file:///etc/passwd' }), /HTTPS/);
  assert.equal(normalizeModelSettings({ baseUrl: 'http://127.0.0.1:8123/v1/' }).baseUrl, 'http://127.0.0.1:8123/v1');
});

test('streams fragmented UTF-8 SSE and retains complete function/reasoning output', async () => {
  let body, authorization;
  const output = [{ type: 'reasoning', id: 'rs1', summary: [], encrypted_content: 'opaque' },
    { type: 'function_call', name: 'get_current_state', call_id: 'call1', arguments: '{}' }];
  await withModel(async (req, res) => {
    authorization = req.headers.authorization;
    let raw = ''; for await (const chunk of req) raw += chunk;
    body = JSON.parse(raw);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const payload = Buffer.from(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '查询设备' })}\r\n\r\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output } })}\r\n\r\n`);
    for (let i = 0; i < payload.length; i += 3) res.write(payload.subarray(i, i + 3));
    res.end();
  }, async (baseUrl) => {
    let text = '';
    const result = await requestModelResponse({ settings: { baseUrl, model: 'test-model', apiKey: 'test-secret' },
      instructions: 'test', input: [], tools: [], onText: (delta) => { text += delta; } });
    assert.equal(text, '查询设备'); assert.deepEqual(result.output, output);
    assert.equal(authorization, 'Bearer test-secret');
    assert.equal(body.store, false); assert.equal(body.parallel_tool_calls, false);
    assert.deepEqual(body.include, ['reasoning.encrypted_content']);
  });
});

test('a truncated stream never returns a callable tool response', async () => {
  await withModel((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '尚未完成' })}\n\n`);
  }, (baseUrl) => assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'test' }, input: [], tools: [] }), { code: 'AGENT_MODEL_INTERRUPTED' }));
});

test('model timeout cancels a hanging connection', async () => {
  await withModel((_req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders(); },
    (baseUrl) => assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'test' }, input: [], tools: [], timeoutMs: 40 }), { code: 'AGENT_MODEL_TIMEOUT' }));
});

test('upstream error bodies cannot echo model secrets', async () => {
  await withModel((_req, res) => { res.writeHead(401); res.end('leaked test-secret'); },
    async (baseUrl) => {
      await assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'test-secret' }, input: [], tools: [] }),
        (error) => error.code === 'AGENT_MODEL_HTTP' && !error.message.includes('test-secret'));
    });
});

test('HTTP diagnostics distinguish organization verification, model access and endpoint errors', async () => {
  const verification = { error: { code: 'model_not_found', message: 'Your organization must be verified to use the model. secret-value https://untrusted.example' } };
  const cases = [
    [404, verification, 'AGENT_MODEL_VERIFICATION', /组织验证/],
    [403, verification, 'AGENT_MODEL_VERIFICATION', /组织验证/],
    [404, { error: { code: 'model_not_found', message: 'No model. secret-value' } }, 'AGENT_MODEL_NOT_FOUND', /项目权限/],
    [404, { error: { code: 'unknown', message: 'secret-value' } }, 'AGENT_MODEL_ENDPOINT', /Responses API/],
    [404, '<html>secret-value</html>', 'AGENT_MODEL_ENDPOINT', /HTTP 404/],
    [404, 'secret-value'.repeat(2000), 'AGENT_MODEL_ENDPOINT', /HTTP 404/],
    [403, { error: { type: 'permission_error', message: '当前分组未授权使用该模型 secret-value' } }, 'AGENT_MODEL_GROUP_PERMISSION', /分组支持的模型/],
    [403, { error: { message: 'Forbidden secret-value' } }, 'AGENT_MODEL_FORBIDDEN', /调用权限/],
    [403, '<html>secret-value</html>', 'AGENT_MODEL_FORBIDDEN', /HTTP 403/],
    [403, 'secret-value'.repeat(2000), 'AGENT_MODEL_FORBIDDEN', /HTTP 403/],
    [401, { error: { message: 'secret-value' } }, 'AGENT_MODEL_HTTP', /密钥/],
    [429, { error: { message: 'secret-value' } }, 'AGENT_MODEL_HTTP', /额度/],
  ];
  for (const [status, body, code, message] of cases) {
    await withModel((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    }, (baseUrl) => assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'secret-value' }, input: [], tools: [] }),
    (error) => error.code === code && message.test(error.message) && !/secret-value|untrusted\.example/.test(error.message)));
  }
});

test('HTTP 403 SSE errors preserve group permission diagnostics across fragmented UTF-8', async () => {
  const detail = { type: 'permission_error', message: '当前分组未授权使用该模型 secret-value https://untrusted.example' };
  const events = [
    { type: 'error', error: detail },
    { type: 'error', message: detail.message, code: 'permission_error' },
    { type: 'response.failed', response: { error: detail } },
  ];
  for (const event of events) {
    await withModel((_req, res) => {
      res.writeHead(403, { 'content-type': 'text/event-stream;charset=UTF-8' });
      const payload = Buffer.from(`: keepalive\r\n\r\nevent: error\r\ndata: ${JSON.stringify(event)}\r\n\r\ndata: [DONE]\r\n\r\n`);
      for (let offset = 0; offset < payload.length; offset += 3) res.write(payload.subarray(offset, offset + 3));
      res.end();
    }, (baseUrl) => assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'secret-value' }, input: [], tools: [] }),
    (error) => error.code === 'AGENT_MODEL_GROUP_PERMISSION' && /服务商控制台/.test(error.message)
      && !/secret-value|untrusted\.example/.test(error.message)));
  }
});

test('SSE HTTP errors retain organization checks and safe fallback for malformed events', async () => {
  for (const [body, code] of [
    ['data: {"error":{"message":"Your organization must be verified. secret-value"}}\n\ndata: [DONE]\n\n', 'AGENT_MODEL_VERIFICATION'],
    ['data: {invalid secret-value}\n\ndata: [DONE]\n\n', 'AGENT_MODEL_FORBIDDEN'],
  ]) {
    await assert.rejects(requestModelResponse({ settings: { baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'secret-value' }, input: [], tools: [],
      fetchImpl: async () => new Response(body, { status: 403, headers: { 'content-type': 'text/event-stream' } }),
    }), (error) => error.code === code && !error.message.includes('secret-value'));
  }
});

test('official organization verification points to OpenAI settings without echoing upstream text', async () => {
  await assert.rejects(requestModelResponse({ settings: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', apiKey: 'secret-value' }, input: [], tools: [],
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'model_not_found', message: 'Your organization must be verified. secret-value' } }), { status: 404 }),
  }), (error) => error.code === 'AGENT_MODEL_VERIFICATION' && /Verify Organization/.test(error.message) && /15 分钟/.test(error.message) && !error.message.includes('secret-value'));
});

test('a hanging HTTP error body still respects the request timeout', async () => {
  await withModel((_req, res) => { res.writeHead(404, { 'content-type': 'application/json' }); res.flushHeaders(); },
    (baseUrl) => assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'test' }, input: [], tools: [], timeoutMs: 40 }), { code: 'AGENT_MODEL_TIMEOUT' }));
});

test('legitimate refusal and empty responses are not reported as successful work', async () => {
  for (const [output, code] of [
    [[{ type: 'message', content: [{ type: 'refusal', refusal: '无法处理此请求。' }] }], 'AGENT_MODEL_REFUSAL'],
    [[], 'AGENT_MODEL_EMPTY'],
  ]) {
    await withModel((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'completed', output }));
    }, (baseUrl) => assert.rejects(requestModelResponse({ settings: { baseUrl, model: 'test', apiKey: 'test' }, input: [], tools: [] }), { code }));
  }
});

test('network diagnostics distinguish proxy, DNS, TLS and timeout without leaking request secrets', async () => {
  const cases = [
    [new Error('net::ERR_PROXY_CONNECTION_FAILED secret-value'), 'AGENT_MODEL_PROXY'],
    [new Error('net::ERR_NAME_NOT_RESOLVED secret-value'), 'AGENT_MODEL_DNS'],
    [new Error('net::ERR_CERT_AUTHORITY_INVALID secret-value'), 'AGENT_MODEL_TLS'],
    [new Error('net::ERR_CONNECTION_TIMED_OUT secret-value'), 'AGENT_MODEL_TIMEOUT'],
    [new TypeError('fetch failed secret-value', { cause: { code: 'ENOTFOUND', message: 'secret-value' } }), 'AGENT_MODEL_DNS'],
    [new TypeError('fetch failed secret-value', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }), 'AGENT_MODEL_TIMEOUT'],
    [new Error('unknown upstream error secret-value'), 'AGENT_MODEL_NETWORK'],
  ];
  for (const [failure, code] of cases) {
    await assert.rejects(requestModelResponse({ settings: { baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'secret-value' },
      input: [], tools: [], fetchImpl: async () => { throw failure; } }),
    (error) => error.code === code && !error.message.includes('secret-value'));
  }
});
