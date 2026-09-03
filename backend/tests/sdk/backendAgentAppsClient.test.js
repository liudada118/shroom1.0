const assert = require('assert');
const {
  BackendSdkClient,
} = require('@shroom/backend/client/BackendSdkClient.js');
const {
  buildSdkContractSnapshot,
} = require('@shroom/backend/contract/sdkApiContract.js');

function response(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => payload };
}

async function main() {
  const requests = [];
  const app = {
    id: 'sdk-agent-demo',
    name: 'SDK Agent Demo',
    version: '1.0.0',
    rendererId: 'agent:sdk-agent-demo',
    renderer: { id: 'main', label: 'SDK Agent Demo', entry: 'index.html', height: 480 },
    permissions: ['sensor.read'],
    entryUrl: '/api/agent-apps/sdk-agent-demo/files/index.html',
    editable: true,
  };
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/api/agent-apps/policy')) {
      return response({ code: 0, data: { policy: { schemaVersion: 1 } }, message: 'success' });
    }
    if (url.endsWith('/api/agent-apps/reload')) {
      return response({ code: 0, data: { apps: [app], errors: [] }, message: 'success' });
    }
    if (url.endsWith('/api/agent-apps') && options.method === 'POST') {
      return response({ code: 0, data: { app }, message: 'success' }, { status: 201 });
    }
    if (url.endsWith('/api/agent-apps')) {
      return response({ code: 0, data: { apps: [app], errors: [] }, message: 'success' });
    }
    throw new Error(`unexpected URL: ${url}`);
  };

  const snapshot = buildSdkContractSnapshot();
  assert.strictEqual(snapshot.agentApps.capability, 'sandboxed-renderer-apps');
  assert.strictEqual(snapshot.agentApps.schemaVersion, 1);
  assert.strictEqual(snapshot.agentApps.routes.install, '/api/agent-apps');
  assert.strictEqual(snapshot.agentApps.routes.files, '/api/agent-apps/:id/files/*');
  assert.deepStrictEqual(snapshot.agentApps.permissions, ['sensor.read']);
  assert.deepStrictEqual(snapshot.agentApps.surfaces, ['renderer', 'chart']);
  assert.strictEqual(snapshot.agentApps.chartIdPattern, 'agent-chart:<appId>:<chartId>');
  assert.strictEqual(snapshot.agentApps.limits.maximumCharts, 16);
  assert.strictEqual(snapshot.agentApps.limits.maximumDecodedBytesPerFile, 25165824);
  assert.strictEqual(snapshot.agentApps.limits.maximumDecodedBytesTotal, 33554432);
  assert.strictEqual(snapshot.agentApps.messageProtocol.schemaVersion, 1);
  assert.strictEqual(snapshot.agentApps.messageProtocol.hostToRenderer.init, 'shroom.renderer.init');
  assert.strictEqual(snapshot.agentApps.messageProtocol.hostToRenderer.frame, 'shroom.renderer.frame');
  assert.strictEqual(snapshot.agentApps.messageProtocol.initSurfaceContext.surface, 'renderer|chart');
  assert.match(snapshot.agentApps.messageProtocol.initSurfaceContext.surfaceId, /agent-chart/);
  assert.strictEqual(snapshot.agentApps.messageProtocol.rendererToHost.ready, 'shroom.renderer.ready');
  assert.strictEqual(snapshot.agentApps.messageProtocol.rendererToHost.error, 'shroom.renderer.error');

  const client = new BackendSdkClient({
    fetchImpl,
    WebSocketImpl: null,
    httpBaseUrl: 'http://backend.test/',
  });
  const listed = await client.listAgentApps();
  assert.deepStrictEqual(listed, { apps: [app], errors: [] });
  assert.strictEqual(requests.at(-1).options.method, 'GET');

  const manifest = {
    schemaVersion: 1,
    id: 'sdk-agent-demo',
    name: 'SDK Agent Demo',
    version: '1.0.0',
    renderer: { entry: 'index.html' },
    permissions: ['sensor.read'],
  };
  const files = [{ path: 'index.html', encoding: 'utf8', content: '<!doctype html>' }];
  const installed = await client.installAgentApp({ manifest, files });
  assert.strictEqual(installed.app.rendererId, 'agent:sdk-agent-demo');
  assert.deepStrictEqual(JSON.parse(requests.at(-1).options.body), {
    manifest,
    files,
    overwrite: false,
  });

  const reloaded = await client.reloadAgentApps();
  assert.deepStrictEqual(reloaded.errors, []);
  assert.strictEqual(requests.at(-1).options.method, 'POST');
  assert.deepStrictEqual(JSON.parse(requests.at(-1).options.body), {});

  const policy = await client.getAgentAppPolicy();
  assert.deepStrictEqual(policy, { policy: { schemaVersion: 1 } });

  const collisionClient = new BackendSdkClient({
    WebSocketImpl: null,
    fetchImpl: async () => response({
      code: 1,
      data: {},
      message: 'agent app already exists',
      errorCode: 'AGENT_APP_EXISTS',
    }, { ok: false, status: 409 }),
  });
  await assert.rejects(
    collisionClient.installAgentApp({ manifest, files }),
    (error) => error.code === 'AGENT_APP_EXISTS' && error.status === 409,
  );

  console.log('backendAgentAppsClient.test.js passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
