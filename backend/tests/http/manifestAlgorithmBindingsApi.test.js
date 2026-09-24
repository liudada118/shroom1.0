const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');

test('Manifest algorithm binding route checks local origin and revision before notifying the UI', async () => {
  const updates = [];
  let current = { systemId: 'seatpad2', revision: 'first', configuration: { algorithms: [], charts: [] } };
  const app = createHttpApp({ readManifestAlgorithmBindings: (id) => id === 'seatpad2' ? current : null,
    updateManifestAlgorithmBindings: (id, body) => {
      if (id !== 'seatpad2') return null;
      if (body.expectedRevision !== current.revision) throw Object.assign(new Error('配置已变化'), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
      current = { systemId: id, revision: 'second', configuration: body.configuration }; return current;
    }, publishDisplaySystemsUpdated: (event) => updates.push(event), logger: { warn() {} } });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/display-systems/seatpad2/algorithm-bindings`;
  const body = { expectedRevision: 'first', configuration: { algorithms: [{ packageId: 'user-gesture', sensorId: 'sit', enabled: true }], charts: [] } };
  /** 发送隔离的本机 HTTP 请求，不接触实际运行实例。 */
  const patch = (origin) => fetch(base, { method: 'PATCH', headers: { 'content-type': 'application/json', ...(origin && { origin }) }, body: JSON.stringify(body) });
  try {
    assert.deepEqual((await (await fetch(base)).json()).result.configuration, { algorithms: [], charts: [] });
    assert.equal((await patch('https://untrusted.example')).status, 403);
    assert.equal(current.revision, 'first');
    assert.equal((await patch()).status, 200);
    assert.deepEqual((await (await fetch(base)).json()).result.configuration, body.configuration);
    assert.equal((await patch()).status, 409);
    assert.equal((await fetch(base.replace('seatpad2', 'missing'))).status, 404);
    assert.deepEqual(updates, [{ reason: 'algorithm-bindings', id: 'seatpad2' }]);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
