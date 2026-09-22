const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');
const { createBuiltinSystemTemplates } = require('../../extension-host/workspace/builtinSystemTemplates');

test('native system HTTP edit/delete enforce origin, revision and active-system guards before broadcasting', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-native-http-'));
  const native = createBuiltinSystemTemplates({ root });
  native.create({ id: 'my-hand', name: '我的手部', sourceType: 'hand' });
  const updates = [];
  const app = createHttpApp({ updateNativeSystem: native.update, deleteNativeSystem: native.remove,
    getDisplaySystemEditorById: native.editor, getDisplaySystemStatus: () => ({ systems: native.list() }),
    publishDisplaySystemsUpdated: (event) => updates.push(event), logger: { warn() {} } });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/display-systems/my-hand`;
  /** 仅向隔离本机服务发送本案例的配置请求。 */
  const send = (method, body, origin) => fetch(`${base}/native`, { method, headers: { 'content-type': 'application/json', ...(origin && { origin }) }, body: JSON.stringify(body) });
  try {
    const editor = (await (await fetch(`${base}/editor`)).json()).editor;
    const body = { name: '重命名系统', configuration: { ...editor.configuration, showArea: false }, expectedRevision: editor.revision };
    assert.equal((await send('PATCH', body, 'https://untrusted.example')).status, 403);
    assert.equal(native.get('my-hand').name, '我的手部');
    const response = await send('PATCH', body);
    assert.equal(response.status, 200);
    const saved = (await response.json()).result.editor;
    assert.equal(saved.configuration.showArea, false);
    assert.equal((await send('PATCH', body)).status, 409);
    native.activate(native.resolve('my-hand', 'all'));
    assert.equal((await send('DELETE', { expectedRevision: saved.revision })).status, 409);
    native.activate({ template: false });
    assert.equal((await send('DELETE', { expectedRevision: editor.revision })).status, 409);
    const removed = await send('DELETE', { expectedRevision: saved.revision });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).result.dataRetained, true);
    assert.equal((await fetch(`${base}/editor`)).status, 404);
    assert.deepEqual(updates.map((event) => event.reason), ['update', 'delete']);
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
