const assert = require('assert');
const http = require('http');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');

/** HTTP 测试只挂内存服务，验证来源限制与错误边界，不执行 Python。 */
async function run() {
  let calls = 0;
  const app = createHttpApp({
    algorithmMarketService: {
      snapshot: () => ({ packages: [{ id: 'mattress-vitals' }], channels: [], instances: [] }),
      toggle: async (body) => { calls++; if (body.packageId === 'bad') throw Object.assign(new Error('点数不匹配'), { httpStatus: 409 }); return { enabled: body.enabled }; },
    },
    controlCommandService: { executeHttp: async () => ({}) }, serialManager: { getStatus: () => [] },
    getRealtimeChannels: () => [], listPorts: async () => [], logger: { error: () => {}, warn: () => {} },
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/algorithm-market`;
  try {
    assert.equal((await (await fetch(url)).json()).packages[0].id, 'mattress-vitals');
    for (const origin of ['https://remote.example', 'null']) {
      const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify({ enabled: true }) });
      assert.equal(result.status, 403);
    }
    assert.equal(calls, 0);
    const accepted = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://127.0.0.1:3000' }, body: JSON.stringify({ enabled: true }) });
    assert.deepEqual(await accepted.json(), { enabled: true });
    const rejected = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packageId: 'bad' }) });
    assert.equal(rejected.status, 409); assert.equal((await rejected.json()).error, '点数不匹配');
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  console.log('algorithm market HTTP origin and error tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
