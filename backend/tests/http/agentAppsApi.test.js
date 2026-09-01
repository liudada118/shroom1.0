const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createAgentAppService } = require('../../extension-host/agent-apps/agentAppService');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');
const { HTTP_ROUTES } = require('@shroom/backend/contract/sdkApiContract.js');

function createManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'http-agent-demo',
    name: 'HTTP Agent Demo',
    version: '1.0.0',
    renderer: {
      id: 'main',
      label: 'Agent Demo',
      entry: 'frontend/index.html',
      height: 520,
    },
    permissions: ['sensor.read'],
    ...overrides,
  };
}

async function main() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-app-http-'));
  const writableRoot = path.join(temporaryRoot, 'writable');
  const resourceRoot = path.join(temporaryRoot, 'resources');
  fs.mkdirSync(path.join(resourceRoot, 'agent'), { recursive: true });
  fs.writeFileSync(
    path.join(resourceRoot, 'agent', 'policy.json'),
    JSON.stringify({ schemaVersion: 1, policyVersion: '1.0.0', status: 'stable' }),
  );

  const agentAppService = createAgentAppService({
    runtimeWritableRoot: writableRoot,
    runtimeResourceRoot: resourceRoot,
    logger: { error: () => {}, warn: () => {} },
  });
  const httpApp = createHttpApp({
    agentAppService,
    controlCommandService: { executeHttp: () => ({ handled: false, stop: false, results: [] }) },
    getChannelBusStatus: () => ({}),
    getDisplaySystemStatus: () => ({ count: 0, systems: [] }),
    getPort: (ports) => ports,
    getRealtimeChannels: () => [],
    getSerialStatus: () => [],
    getSitDb: () => ({ all: () => {} }),
    getWsSubscriptionStatus: () => ({}),
    imgPath: temporaryRoot,
    listPorts: async () => [],
    logger: { error: () => {}, warn: () => {} },
    pdfPath: temporaryRoot,
    serialManager: { getStatus: () => [] },
  });
  const server = http.createServer(httpApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const emptyResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentApps}`);
    const emptyBody = await emptyResponse.json();
    assert.strictEqual(emptyResponse.status, 200);
    assert.deepStrictEqual(emptyBody, {
      code: 0,
      data: { apps: [], errors: [] },
      message: 'success',
    });

    const policyResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentAppPolicy}`);
    const policyBody = await policyResponse.json();
    assert.strictEqual(policyResponse.status, 200);
    assert.strictEqual(policyBody.data.policy.policyVersion, '1.0.0');

    const rejectedOriginResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentApps}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://remote.example',
      },
      body: JSON.stringify({}),
    });
    const rejectedOriginBody = await rejectedOriginResponse.json();
    assert.strictEqual(rejectedOriginResponse.status, 403);
    assert.strictEqual(rejectedOriginBody.errorCode, 'AGENT_APP_ORIGIN_FORBIDDEN');

    const installRequest = {
      manifest: createManifest(),
      files: [
        {
          path: 'frontend/index.html',
          encoding: 'utf8',
          content: '<!doctype html><script src="./app.js"></script><main>Agent</main>',
        },
        {
          path: 'frontend/app.js',
          encoding: 'utf8',
          content: 'window.parent.postMessage({type:"shroom.renderer.ready",schemaVersion:1,payload:{}}, "*");',
        },
        {
          path: 'frontend/model.glb',
          encoding: 'base64',
          content: 'Z2xURg==',
        },
      ],
      overwrite: false,
    };
    const installResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentApps}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:12321' },
      body: JSON.stringify(installRequest),
    });
    const installBody = await installResponse.json();
    assert.strictEqual(installResponse.status, 201);
    assert.strictEqual(installBody.code, 0);
    assert.strictEqual(installBody.data.app.rendererId, 'agent:http-agent-demo');
    assert.strictEqual(
      installBody.data.app.entryUrl,
      '/api/agent-apps/http-agent-demo/files/frontend/index.html',
    );

    const listResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentApps}`);
    const listBody = await listResponse.json();
    assert.deepStrictEqual(listBody.data.apps.map((app) => app.id), ['http-agent-demo']);
    assert.deepStrictEqual(listBody.data.apps[0].permissions, ['sensor.read']);
    assert.deepStrictEqual(listBody.data.errors, []);

    const entryResponse = await fetch(`${baseUrl}${installBody.data.app.entryUrl}`);
    assert.strictEqual(entryResponse.status, 200);
    assert.match(await entryResponse.text(), /<main>Agent<\/main>/);
    assert.strictEqual(entryResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(entryResponse.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.match(entryResponse.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(
      entryResponse.headers.get('content-security-policy'),
      /frame-ancestors http:\/\/127\.0\.0\.1:\* http:\/\/localhost:\*/,
    );
    assert.doesNotMatch(entryResponse.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.match(
      entryResponse.headers.get('content-security-policy'),
      new RegExp(`connect-src http://127\\.0\\.0\\.1:${server.address().port}/api/agent-apps/http-agent-demo/files/`),
    );
    assert.doesNotMatch(entryResponse.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.match(entryResponse.headers.get('permissions-policy'), /serial=\(\)/);

    const scriptResponse = await fetch(
      `${baseUrl}/api/agent-apps/http-agent-demo/files/frontend/app.js`,
    );
    assert.strictEqual(scriptResponse.status, 200);
    assert.match(await scriptResponse.text(), /shroom\.renderer\.ready/);
    assert.strictEqual(scriptResponse.headers.get('cross-origin-resource-policy'), 'cross-origin');

    const assetResponse = await fetch(
      `${baseUrl}/api/agent-apps/http-agent-demo/files/frontend/model.glb`,
    );
    assert.strictEqual(assetResponse.status, 200);
    assert.deepStrictEqual([...Buffer.from(await assetResponse.arrayBuffer())], [103, 108, 84, 70]);

    const duplicateResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentApps}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(installRequest),
    });
    const duplicateBody = await duplicateResponse.json();
    assert.strictEqual(duplicateResponse.status, 409);
    assert.strictEqual(duplicateBody.code, 1);
    assert.strictEqual(duplicateBody.errorCode, 'AGENT_APP_EXISTS');
    assert.deepStrictEqual(duplicateBody.data, {});

    const invalidResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentApps}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...installRequest,
        manifest: createManifest({ permissions: ['sensor.read', 'node.execute'] }),
      }),
    });
    const invalidBody = await invalidResponse.json();
    assert.strictEqual(invalidResponse.status, 400);
    assert.strictEqual(invalidBody.errorCode, 'AGENT_APP_INVALID');
    assert.deepStrictEqual(invalidBody.data, {});

    const missingFileResponse = await fetch(
      `${baseUrl}/api/agent-apps/http-agent-demo/files/frontend/missing.js`,
    );
    const missingFileBody = await missingFileResponse.json();
    assert.strictEqual(missingFileResponse.status, 404);
    assert.strictEqual(missingFileBody.errorCode, 'AGENT_APP_FILE_NOT_FOUND');
    assert.deepStrictEqual(missingFileBody.data, {});

    const reloadResponse = await fetch(`${baseUrl}${HTTP_ROUTES.agentAppReload}`, {
      method: 'POST',
    });
    const reloadBody = await reloadResponse.json();
    assert.strictEqual(reloadResponse.status, 200);
    assert.deepStrictEqual(reloadBody.data.apps.map((app) => app.id), ['http-agent-demo']);

    const contractResponse = await fetch(`${baseUrl}${HTTP_ROUTES.sdkContract}`);
    const contractBody = await contractResponse.json();
    assert.strictEqual(contractBody.agentApps.schemaVersion, 1);
    assert.strictEqual(contractBody.agentApps.routes.policy, '/api/agent-apps/policy');
    assert.strictEqual(contractBody.agentApps.messageProtocol.hostToRenderer.frame, 'shroom.renderer.frame');
    assert.strictEqual(contractBody.agentApps.messageProtocol.rendererToHost.ready, 'shroom.renderer.ready');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const resolved = path.resolve(temporaryRoot);
    if (resolved.startsWith(path.resolve(os.tmpdir()))) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

main()
  .then(() => console.log('agentAppsApi.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
