const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
} = require('../../kernel/algorithm-channel/jqbedAlgorithmConfig');
const {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmCommandHandler,
  createJqbedAlgorithmProtocol,
} = require('../../kernel/algorithm-channel/jqbedAlgorithmProtocol');

/**
 * 装一套 jqbed 算法配置协议 + 内存假仓库，返回可观测的三个收集器。
 *
 * 用法：`const { protocol, sent, broadcasts, store } = createProtocol()`。
 * `sent` 是点对点回给某个客户端的、`broadcasts` 是全局广播的 —— 分开收集是关键，
 * 配置回读只能回给发请求的那个客户端，广播出去等于把别人的配置也刷了。
 *
 * 快照进出都 `structuredClone`，防止测试拿到内部引用后改动串味。
 * `save` / `reset` 可传入覆盖，用来测「仓库抛错时协议怎么回」这类分支。
 *
 * @param {{save?: Function, reset?: Function}} [overrides] 覆盖仓库的写入行为。
 * @returns {{broadcasts: object[], protocol: object, sent: object[], store: object}}
 */
function createProtocol({ save, reset, sendJson } = {}) {
  const sent = [];
  const deliveries = [];
  const broadcasts = [];
  const snapshot = {
    version: 2,
    values: structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
    savedAt: null,
  };
  const store = {
    getSnapshot: () => structuredClone(snapshot),
    save: save || ((values) => {
      snapshot.values = structuredClone(values);
      return structuredClone(snapshot);
    }),
    reset: reset || (() => {
      snapshot.values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
      return structuredClone(snapshot);
    }),
  };
  const protocol = createJqbedAlgorithmProtocol({
    store,
    sendJson: sendJson || ((client, payload) => {
      sent.push(payload);
      deliveries.push({ client, payload });
    }),
    broadcastJson: (payload) => broadcasts.push(payload),
    getAlgorithmStatus: () => ({ state: 'ready', error: null }),
  });
  return { broadcasts, protocol, sent, store, deliveries };
}

const authorizedContext = {
  client: {},
  licenseValid: true,
  activeFile: 'jqbed',
  realtime: true,
};

test('returns the authoritative snapshot only to an authorized realtime jqbed client', () => {
  const { broadcasts, protocol, sent, store } = createProtocol();

  assert.equal(protocol.handle({
    getJqbedAlgorithmConfig: true,
    requestId: 'load-1',
  }, authorizedContext), true);

  assert.deepEqual(sent[0].jqbedAlgorithmConfig, store.getSnapshot());
  assert.equal(sent[0].jqbedAlgorithmStatus.state, 'ready');
  assert.equal(sent[0].jqbedAlgorithmConfigResult.requestId, 'load-1');
  assert.deepEqual(broadcasts, []);
});

test('rejects unlicensed, non-jqbed and playback requests without mutation', () => {
  for (const context of [
    { ...authorizedContext, licenseValid: false },
    { ...authorizedContext, activeFile: 'smallBed' },
    { ...authorizedContext, realtime: false },
  ]) {
    let saveCalls = 0;
    const { broadcasts, protocol, sent } = createProtocol({
      save: () => { saveCalls += 1; },
    });

    assert.equal(protocol.handle({
      setJqbedAlgorithmConfig: DEFAULT_JQBED_ALGORITHM_VALUES,
      requestId: 'save-1',
    }, context), true);
    assert.equal(sent[0].jqbedAlgorithmConfigResult.ok, false);
    assert.equal(sent[0].jqbedAlgorithmConfigResult.requestId, 'save-1');
    assert.equal(saveCalls, 0);
    assert.deepEqual(broadcasts, []);
  }
});

test('broadcasts snapshots after save and reset but keeps validation errors private', () => {
  const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  values.threshold_factor = 2.5;
  const success = createProtocol();

  success.protocol.handle({ setJqbedAlgorithmConfig: values }, authorizedContext);
  success.protocol.handle({ resetJqbedAlgorithmConfig: true }, authorizedContext);
  assert.deepEqual(success.broadcasts[0].jqbedAlgorithmConfig.values, values);
  assert.deepEqual(success.broadcasts[1].jqbedAlgorithmConfig.values, DEFAULT_JQBED_ALGORITHM_VALUES);

  const rejected = createProtocol({
    save: () => {
      throw new JqbedAlgorithmConfigValidationError({ threshold_factor: 'nonnegative' });
    },
  });
  rejected.protocol.handle({ setJqbedAlgorithmConfig: values }, authorizedContext);
  assert.deepEqual(rejected.sent[0].jqbedAlgorithmConfigResult.errors, {
    threshold_factor: 'nonnegative',
  });
  assert.deepEqual(rejected.broadcasts, []);
});

test('isolates dynamic Python arguments to jqbed', () => {
  const envelope = {
    version: 2,
    values: structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
    savedAt: null,
  };
  const data = [1, 2, 3];

  assert.deepEqual(buildJqbedGetDataArgs(data, 'jqbed', envelope), {
    data,
    config: envelope.values,
  });
  assert.deepEqual(buildJqbedGetDataArgs(data, 'smallBed', envelope), { data });
  assert.deepEqual(buildJqbedGetDataArgs(data, 'jqbed', null), { data });
});

test('command handler mounts the protocol only on the primary websocket scope', () => {
  const calls = [];
  const client = { readyState: 1 };
  const handler = createJqbedAlgorithmCommandHandler({
    protocol: {
      handle: (message, context) => {
        calls.push({ message, context });
        return true;
      },
    },
    getRuntimeContext: () => ({
      activeFile: 'jqbed',
      licenseValid: true,
      realtime: true,
    }),
  });
  const message = { getJqbedAlgorithmConfig: true };

  assert.equal(handler.when(message, { scope: 'back' }), false);
  assert.equal(handler.when(message, { scope: 'main' }), true);
  assert.deepEqual(handler.handle(message, { client, scope: 'main' }), { stop: true });
  assert.equal(calls[0].context.client, client);
  assert.equal(calls[0].context.activeFile, 'jqbed');
});

test('ignores unrelated websocket messages', () => {
  const { broadcasts, protocol, sent } = createProtocol();
  assert.equal(protocol.handle({ play: true }, authorizedContext), false);
  assert.deepEqual(sent, []);
  assert.deepEqual(broadcasts, []);
});

/** 创建打开的日志测试连接。 */
const logClient = () => ({ readyState: 1 });
/** 创建每次日志请求的授权上下文。 */
const logContext = (client, overrides = {}) => ({ ...authorizedContext, client, ...overrides });
/** 通过真实协议发起订阅或取消请求。 */
const subscribe = (protocol, client, enabled = true, overrides = {}) => protocol.handle({
  subscribeJqbedAlgorithmLog: enabled,
  requestId: 'log-subscription-request',
}, logContext(client, overrides));

test('acknowledges algorithm log subscriptions independently of configuration results', () => {
  const { protocol, sent, broadcasts } = createProtocol();
  const client = logClient();
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(subscribe(protocol, client), true);
  assert.deepEqual(sent, [{
    jqbedAlgorithmLogSubscription: {
      ok: true, subscribed: true, requestId: 'log-subscription-request',
    },
  }]);
  assert.equal(protocol.hasLogSubscribers(), true);
  assert.deepEqual(broadcasts, []);
});

for (const [name, context] of [
  ['unlicensed', { licenseValid: false }],
  ['another system', { activeFile: 'smallBed' }],
  ['playback', { realtime: false }],
]) {
  test(`rejects log subscription in ${name} context`, () => {
    const { protocol, sent } = createProtocol();
    subscribe(protocol, logClient(), true, context);
    assert.equal(sent[0].jqbedAlgorithmLogSubscription.ok, false);
    assert.equal(sent[0].jqbedAlgorithmLogSubscription.subscribed, false);
    assert.equal(protocol.hasLogSubscribers(), false);
  });
}

test('allows unsubscribe after license, system, and realtime eligibility have changed', () => {
  const { protocol, sent } = createProtocol();
  const client = logClient();
  subscribe(protocol, client);
  const recipients = protocol.captureLogSubscribers();
  subscribe(protocol, client, false, { licenseValid: false, activeFile: 'petCare', realtime: false });
  assert.deepEqual(sent.at(-1), {
    jqbedAlgorithmLogSubscription: {
      ok: true, subscribed: false, requestId: 'log-subscription-request',
    },
  });
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext, recipients), 0);
});

test('rejects nonboolean subscription values without treating them as configuration mutations', () => {
  for (const value of ['true', 'false', 1, 0, null, {}, []]) {
    const { protocol, sent, broadcasts } = createProtocol();
    assert.equal(subscribe(protocol, logClient(), value), true);
    assert.equal(sent[0].jqbedAlgorithmLogSubscription.ok, false);
    assert.equal(protocol.hasLogSubscribers(), false);
    assert.deepEqual(broadcasts, []);
  }
});

test('sends complete named native output only to subscribed clients, including initialization frames', () => {
  const { protocol, sent, deliveries, broadcasts } = createProtocol();
  const first = logClient();
  const second = logClient();
  const stranger = logClient();
  subscribe(protocol, first);
  subscribe(protocol, second);
  const recipients = protocol.captureLogSubscribers();
  const outputs = {
    rate: -1,
    state_in_bed: -1,
    matrix_origin: new Array(1024).fill(1.25),
    matrix_filter: new Array(1024).fill(0),
    reserved_bytes: new Array(10).fill(-1),
    future_key: { nested: [1, null, 0] },
  };
  assert.equal(protocol.publishLog(outputs, authorizedContext, recipients), 2);
  const logs = sent.filter((payload) => payload.jqbedAlgorithmLog);
  assert.equal(logs.length, 2);
  assert.deepEqual(logs[0].jqbedAlgorithmLog.outputs, outputs);
  assert.equal(logs[0].jqbedAlgorithmLog.sensorType, 'jqbed');
  assert.equal(logs[0].jqbedAlgorithmLog.sequence, 1);
  assert.match(logs[0].jqbedAlgorithmLog.receivedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(logs[1].jqbedAlgorithmLog.sequence, 1);
  assert.equal(deliveries.some(({ client }) => client === stranger), false);
  assert.deepEqual(broadcasts, []);
  protocol.publishLog({ rate: 15 }, authorizedContext, recipients);
  assert.equal(sent.at(-1).jqbedAlgorithmLog.sequence, 2);
});

test('does not publish diagnostics without an explicit request-time recipient snapshot', () => {
  const { protocol, sent } = createProtocol();
  subscribe(protocol, logClient());
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext), 0);
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
});

test('new or renewed subscriptions do not receive outputs requested by an earlier session', () => {
  const { protocol, sent } = createProtocol();
  const client = logClient();
  const laterClient = logClient();
  subscribe(protocol, client);
  const oldRecipients = protocol.captureLogSubscribers();
  subscribe(protocol, laterClient);
  subscribe(protocol, client, false);
  subscribe(protocol, client);
  assert.equal(protocol.publishLog({ rate: 15 }, authorizedContext, oldRecipients), 0);
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
  assert.equal(protocol.publishLog({ rate: 16 }, authorizedContext, protocol.captureLogSubscribers()), 2);
});

test('removes disconnected subscribers explicitly and prunes closed sockets before requesting raw outputs', () => {
  const { protocol, sent } = createProtocol();
  const client = logClient();
  subscribe(protocol, client);
  const recipients = protocol.captureLogSubscribers();
  protocol.removeClient(client);
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(protocol.publishLog({ rate: 15 }, authorizedContext, recipients), 0);
  subscribe(protocol, client);
  client.readyState = 3;
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
});

test('checks current authorization, system, and playback context again before publication', () => {
  const { protocol, sent } = createProtocol();
  subscribe(protocol, logClient());
  const recipients = protocol.captureLogSubscribers();
  for (const context of [
    { ...authorizedContext, licenseValid: false },
    { ...authorizedContext, activeFile: 'smallBed' },
    { ...authorizedContext, realtime: false },
  ]) {
    assert.equal(protocol.publishLog({ rate: 15 }, context, recipients), 0);
  }
  for (const invalidOutputs of [undefined, null, 1, 'raw', []]) {
    assert.equal(protocol.publishLog(invalidOutputs, authorizedContext, recipients), 0);
  }
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
});

test('failed socket writes remove only the affected log subscriber', () => {
  const broken = logClient();
  const healthy = logClient();
  const logs = [];
  const { protocol } = createProtocol({ sendJson: (client, payload) => {
    if (!payload.jqbedAlgorithmLog) return;
    if (client === broken) throw new Error('socket closed during send');
    logs.push(payload);
  } });
  subscribe(protocol, broken);
  subscribe(protocol, healthy);
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext, protocol.captureLogSubscribers()), 1);
  assert.equal(logs.length, 1);
  assert.deepEqual(protocol.captureLogSubscribers().map(({ client }) => client), [healthy]);
});



test('routes log subscriptions only through the primary websocket scope', () => {
  const client = logClient();
  const { protocol, sent } = createProtocol();
  const handler = createJqbedAlgorithmCommandHandler({ protocol,
    getRuntimeContext: () => ({ licenseValid: true, activeFile: 'jqbed', realtime: true }) });
  const message = { subscribeJqbedAlgorithmLog: true };
  assert.equal(handler.when(message, { scope: 'main' }), true);
  assert.equal(handler.when(message, { scope: 'back' }), false);
  assert.deepEqual(handler.handle(message, { client }), { stop: true });
  assert.equal(sent[0].jqbedAlgorithmLogSubscription.subscribed, true);
});

test('a failed nonthrowing send removes only the affected log subscriber', () => {
  const { protocol } = createProtocol({ sendJson: (_client, payload) => !payload.jqbedAlgorithmLog });
  subscribe(protocol, logClient());
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext, protocol.captureLogSubscribers()), 0);
  assert.equal(protocol.hasLogSubscribers(), false);
});
