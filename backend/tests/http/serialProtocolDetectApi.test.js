const assert = require('assert');
const http = require('http');
const os = require('os');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');
const { HTTP_ROUTES } = require('@shroom/backend/contract/sdkApiContract.js');

async function main() {
  const calls = [];
  const serialProtocolProbeService = {
    detect: async (input) => {
      calls.push(input);
      if (input.path === 'COM-BUSY') {
        const error = new Error('serial port is busy: COM-BUSY');
        error.code = 'SERIAL_PORT_BUSY';
        error.httpStatus = 409;
        error.details = { path: input.path };
        throw error;
      }
      return {
        status: 'matched',
        reason: 'unique-match',
        path: input.path,
        match: {
          id: 'standard-1024',
          label: '标准 1024 压力帧 (32x32)',
          matrix: { width: 32, height: 32, total: 1024 },
          protocol: {
            validation: null,
            baudRate: 1000000,
            framing: {
              type: 'delimiter',
              delimiter: [170, 85, 3, 153],
              frameLength: null,
              includeDelimiter: false,
            },
            decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 1024 },
          },
        },
        candidates: [],
      };
    },
  };
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
    serialProtocolProbeService,
  });

  const server = http.createServer(httpApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${baseUrl}${HTTP_ROUTES.serialProtocolDetect}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'COM7', candidateIds: ['standard-1024'] }),
    });
    const body = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.code, 0);
    assert.strictEqual(body.data.status, 'matched');
    assert.strictEqual(body.data.match.id, 'standard-1024');
    assert.strictEqual(body.data.match.protocol.validation, null);
    assert.deepStrictEqual(calls[0], { path: 'COM7', candidateIds: ['standard-1024'] });

    const busyResponse = await fetch(`${baseUrl}${HTTP_ROUTES.serialProtocolDetect}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'COM-BUSY' }),
    });
    const busyBody = await busyResponse.json();
    assert.strictEqual(busyResponse.status, 409);
    assert.strictEqual(busyBody.code, 1);
    assert.deepStrictEqual(busyBody.data, {});
    assert.match(busyBody.message, /busy/);
    assert.strictEqual(busyBody.errorCode, 'SERIAL_PORT_BUSY');

    const contractResponse = await fetch(`${baseUrl}${HTTP_ROUTES.sdkContract}`);
    const contract = await contractResponse.json();
    assert.strictEqual(contract.http.routes.serialProtocolDetect, '/api/serial/protocol-detect');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main()
  .then(() => console.log('serialProtocolDetectApi.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
