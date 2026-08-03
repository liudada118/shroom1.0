const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createHttpApp } = require('../../server/httpAppFactory');
const { HTTP_ROUTES } = require('../../contracts/sdkApiContract');
const { USER_PRESET_DIRECTORY_NAME } = require('../../serial/protocols');

/**
 * 造一个临时的用户预设目录，模拟「打包之后用户自己丢 JSON」。
 * @returns {{root: string, presetDir: string}} 临时目录。
 */
function createUserPresetDirectory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'serial-protocols-'));
  const presetDir = path.join(root, USER_PRESET_DIRECTORY_NAME);
  fs.mkdirSync(presetDir, { recursive: true });

  fs.writeFileSync(path.join(presetDir, 'my-sensor.json'), JSON.stringify({
    id: 'my-sensor',
    label: '自研传感器',
    summary: '定长 64 字节',
    doc: 'my-sensor.md',
    matrix: { width: 8, height: 8, total: 64 },
    channels: ['sit'],
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 64 },
      decoding: { valueType: 'uint8', valueCount: 64 },
    },
  }));

  // 一个写坏的预设：它必须只影响自己，不能让整个列表变空。
  fs.writeFileSync(path.join(presetDir, 'oops.json'), '{ not json');

  return { root, presetDir };
}

async function main() {
  const { root, presetDir } = createUserPresetDirectory();

  const httpApp = createHttpApp({
    controlCommandService: { executeHttp: () => ({ handled: true, stop: false, results: [] }) },
    getChannelBusStatus: () => ({}),
    getDisplaySystemById: () => null,
    getDisplaySystemBuilderCatalog: () => ({}),
    getDisplaySystemEditorById: () => null,
    getDisplaySystemStatus: () => ({}),
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
    serialProtocolDirectories: [presetDir],
  });

  const server = http.createServer(httpApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${HTTP_ROUTES.serialProtocols}`);
    const body = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.code, 0);

    const protocols = body.data.protocols;
    assert.ok(Array.isArray(protocols));

    // 内置预设必须在，而且带着能直接写进 manifest 的 protocol 段。
    const standard = protocols.find((preset) => preset.id === 'standard-1024');
    assert.ok(standard, '内置 standard-1024 没有出现在接口里');
    assert.deepStrictEqual(standard.protocol.framing.delimiter, [170, 85, 3, 153]);
    assert.strictEqual(standard.protocol.decoding.valueCount, 1024);
    assert.strictEqual(standard.protocol.baudRate, 1000000);
    assert.strictEqual(standard.source, 'builtin');
    // 前端「新建传感器」要靠这三个字段做下拉，缺一个就没法展示。
    assert.ok(standard.label);
    assert.ok(standard.summary);
    assert.ok(standard.doc.endsWith('.md'));

    // 用户自己丢进去的预设也在，不需要重新构建。
    const mine = protocols.find((preset) => preset.id === 'my-sensor');
    assert.ok(mine, '用户预设没有被加载');
    assert.strictEqual(mine.source, 'user');
    assert.strictEqual(mine.protocol.framing.frameLength, 64);

    // 写坏的那个只影响自己：带着原因进 invalid，其它预设照常返回。
    assert.strictEqual(body.data.invalid.length, 1);
    assert.ok(body.data.invalid[0].filePath.includes('oops.json'));
    assert.ok(body.data.invalid[0].errors[0].includes('invalid JSON'));
    assert.ok(protocols.length > 1, '一个坏文件不应该让列表变空');

    // 扫过哪些目录要透出来，用户排错时得知道系统在哪找预设。
    assert.ok(body.data.directories.includes(presetDir));

    // SDK contract 里要能看到路由和预设摘要，SDK 不用先猜路径。
    const contractResponse = await fetch(`http://127.0.0.1:${port}${HTTP_ROUTES.sdkContract}`);
    const contract = await contractResponse.json();
    assert.strictEqual(contract.http.routes.serialProtocols, '/api/serial/protocols');
    assert.ok(Array.isArray(contract.serial.protocolPresets));
    assert.ok(contract.serial.protocolPresets.some((preset) => preset.id === 'standard-1024'));
    assert.ok(contract.serial.protocolPresets.some((preset) => preset.id === 'my-sensor'));
    // 摘要不带完整 protocol 段 —— contract 是能力快照不是数据源。
    assert.strictEqual(contract.serial.protocolPresets[0].protocol, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    console.log('serialProtocolsApi.test.js passed');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
