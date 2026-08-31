const assert = require('assert');
const http = require('http');
const os = require('os');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');

/**
 * 校验 `/api/display-systems` 一族只读接口的响应形状。
 *
 * 断言盯的是**结构**（count / systems / runtimeBindings…）而不是业务值 ——
 * 这些字段名是前端「有哪些显示系统可用」的唯一来源，属于对外契约。
 * 下面那一堆 `getXxx: () => ...` 必须全填：`createHttpApp` 一次性装配所有路由，
 * 缺一个依赖是启动即报错，不是某个接口 404。
 *
 * @returns {Promise<void>} 断言失败时 reject。
 */
async function main() {
  const displaySystemStatus = {
    count: 1,
    systems: [{ id: 'demo', name: 'Demo' }],
    runtimeChannelRegistry: {
      count: 1,
      channels: [{ id: 'demo:sit', status: 'registered' }],
    },
    runtimeBindings: {
      count: 1,
      bindings: [{ id: 'demo:sit', status: 'bound' }],
    },
    runtimeDispatcher: {
      started: true,
      bindingCount: 1,
      activeHandlerCount: 1,
      handlers: [{ bindingId: 'demo:sit', parserChannel: 'sit' }],
    },
  };
  const httpApp = createHttpApp({
    controlCommandService: { executeHttp: () => ({ handled: false, stop: false, results: [] }) },
    getChannelBusStatus: () => ({}),
    getDisplaySystemById: (id) => (id === 'demo' ? { id: 'demo', name: 'Demo' } : null),
    getDisplaySystemBuilderCatalog: () => ({
      renderers: [{ id: 'heatmap' }],
      writableRoot: os.tmpdir(),
    }),
    getDisplaySystemEditorById: (id) => (id === 'demo' ? { manifest: { id: 'demo' } } : null),
    getDisplaySystemStatus: () => displaySystemStatus,
    getPort: (ports) => ports,
    getRealtimeChannels: () => [],
    getSerialStatus: () => [],
    getSitDb: () => ({ all: () => {} }),
    getWsSubscriptionStatus: () => ({}),
    imgPath: os.tmpdir(),
    listPorts: async () => [],
    logger: { error: () => {}, warn: () => {} },
    pdfPath: os.tmpdir(),
    serialManager: { getStatus: () => [] },
    reloadDisplaySystems: () => displaySystemStatus,
    saveDisplaySystem: (input) => ({ id: input.manifest.id }),
    saveDisplaySystemDisplaySection: (id, patch) => {
      if (id === 'built-in') {
        const error = new Error('system display systems are read-only');
        error.code = 'DISPLAY_SYSTEM_READ_ONLY';
        throw error;
      }
      if (id !== 'demo') return null;
      return { id, patch };
    },
    duplicateDisplaySystem: (id, options) => {
      if (id !== 'demo' && id !== 'built-in') return null;
      if (options?.id === 'taken') {
        const error = new Error('display system already exists');
        error.code = 'DISPLAY_SYSTEM_EXISTS';
        throw error;
      }
      return { id: options?.id, sourceId: id };
    },
  });

  const server = http.createServer(httpApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems`);
    const statusBody = await statusResponse.json();
    assert.strictEqual(statusResponse.status, 200);
    assert.strictEqual(statusBody.displaySystems.count, 1);
    assert.strictEqual(statusBody.displaySystems.runtimeChannelRegistry.count, 1);
    assert.strictEqual(statusBody.displaySystems.runtimeBindings.count, 1);
    assert.strictEqual(statusBody.displaySystems.runtimeDispatcher.activeHandlerCount, 1);

    const detailResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems/demo`);
    const detailBody = await detailResponse.json();
    assert.strictEqual(detailResponse.status, 200);
    assert.strictEqual(detailBody.displaySystem.id, 'demo');

    const catalogResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems/catalog`);
    const catalogBody = await catalogResponse.json();
    assert.strictEqual(catalogBody.catalog.renderers[0].id, 'heatmap');
    assert.ok(catalogBody.catalog.writableRoot);

    const editorResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems/demo/editor`);
    const editorBody = await editorResponse.json();
    assert.strictEqual(editorBody.editor.manifest.id, 'demo');

    const saveResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ manifest: { id: 'created' } }),
    });
    const saveBody = await saveResponse.json();
    assert.strictEqual(saveResponse.status, 201);
    assert.strictEqual(saveBody.result.id, 'created');

    const reloadResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems/reload`, {
      method: 'POST',
    });
    assert.strictEqual(reloadResponse.status, 200);

    // ── PATCH /:id/display —— 只写 display 段 ──
    const patchDisplay = (id, body) => fetch(
      `http://127.0.0.1:${port}/api/display-systems/${id}/display`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    const sectionResponse = await patchDisplay('demo', { canvas: { colormap: 'viridis' } });
    const sectionBody = await sectionResponse.json();
    assert.strictEqual(sectionResponse.status, 200);
    assert.strictEqual(sectionBody.result.patch.canvas.colormap, 'viridis');

    // 只读被拒是 403 而不是 400：请求没问题，是目标不许写。前端要靠这个区别
    // 决定提示语（「这是自带展示系统，请用另存为」而不是「参数有误」）。
    const readOnlyResponse = await patchDisplay('built-in', { canvas: {} });
    const readOnlyBody = await readOnlyResponse.json();
    assert.strictEqual(readOnlyResponse.status, 403);
    assert.strictEqual(readOnlyBody.code, 'DISPLAY_SYSTEM_READ_ONLY');

    const missingResponse = await patchDisplay('no-such', {});
    assert.strictEqual(missingResponse.status, 404);

    // ── POST /:id/duplicate —— 另存为 ──
    const duplicateOf = (id, body) => fetch(
      `http://127.0.0.1:${port}/api/display-systems/${id}/duplicate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    // 自带展示系统必须能被另存为 —— 那是它唯一的保存出路，别写成 403。
    const duplicateResponse = await duplicateOf('built-in', { id: 'built-in-copy' });
    const duplicateBody = await duplicateResponse.json();
    assert.strictEqual(duplicateResponse.status, 201);
    assert.strictEqual(duplicateBody.result.id, 'built-in-copy');
    assert.strictEqual(duplicateBody.result.sourceId, 'built-in');

    // 撞名是 409，前端据此提示改名而不是当成参数错误。
    const collisionResponse = await duplicateOf('demo', { id: 'taken' });
    const collisionBody = await collisionResponse.json();
    assert.strictEqual(collisionResponse.status, 409);
    assert.strictEqual(collisionBody.code, 'DISPLAY_SYSTEM_EXISTS');

    const duplicateMissingResponse = await duplicateOf('no-such', { id: 'x' });
    assert.strictEqual(duplicateMissingResponse.status, 404);

    const invalidJsonResponse = await fetch(`http://127.0.0.1:${port}/api/display-systems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"broken"',
    });
    const invalidJsonBody = await invalidJsonResponse.json();
    assert.strictEqual(invalidJsonResponse.status, 400);
    assert.strictEqual(invalidJsonBody.error, 'invalid json body');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main()
  .then(() => {
    console.log('displaySystemsApi.test.js passed');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
