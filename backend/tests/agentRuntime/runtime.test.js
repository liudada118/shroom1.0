const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAgentRuntime } = require('../../agent-runtime/runtime');
const { agentError } = require('../../agent-runtime/errors');
const { createAgentStorage } = require('../../agent-runtime/storage');

test('history restores attachments and task records across switching and restarting', async (t) => {
  const inputs = [];
  const { root, runtime } = fixture(t, { modelRequest: async ({ input, onText }) => { inputs.push(structuredClone(input)); onText('已阅读图片'); return { output: [] }; } });
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const [file] = runtime.importAttachments([{ name: 'image.png', base64: png, thumbnail: `data:image/png;base64,${png}` }]);
  const firstId = runtime.getState().conversation.id;
  assert.equal(file.base64, undefined);
  runtime.startTask({ text: '阅读这张图', attachmentIds: [file.id] }); await runtime.whenIdle();
  assert.equal(inputs[0].at(-1).content[1].type, 'input_image');
  assert.equal(inputs[0].at(-1).content[1].image_url, `data:image/png;base64,${png}`);
  assert.ok(!fs.readFileSync(path.join(root, 'state.json'), 'utf8').includes('"base64"'));
  runtime.newConversation();
  assert.equal(runtime.listConversations().find((item) => item.id === firstId).title, '阅读这张图');
  runtime.openConversation({ conversationId: firstId });
  assert.equal(runtime.getState().conversation.tasks.length, 1);
  assert.equal(runtime.getState().attachments[0].id, file.id);
  runtime.startTask({ text: '再看看图片', attachmentIds: [file.id] }); await runtime.whenIdle();
  assert.ok(inputs[1].some((item) => item.content === '已阅读图片'));
  const restarted = createAgentRuntime({ root, tools: { definitions: [], execute: async () => ({}) } });
  assert.equal(restarted.getState().conversation.id, firstId);
  assert.equal(restarted.getState().conversation.tasks.length, 2);
  assert.equal(restarted.listConversations().filter((item) => item.id === firstId).length, 1);
  await restarted.dispose();
});

test('corrupt, missing, and traversal history cannot replace the current conversation', (t) => {
  const { root, runtime } = fixture(t);
  const id = runtime.getState().conversation.id;
  const storage = createAgentStorage(root);
  storage.archive({ id: 'broken', messages: [], tasks: [null], attachments: [] });
  assert.throws(() => runtime.openConversation({ conversationId: 'broken' }), { code: 'AGENT_STORAGE_INVALID' });
  assert.throws(() => runtime.openConversation({ conversationId: 'missing' }), { code: 'AGENT_STORAGE_INVALID' });
  assert.throws(() => runtime.openConversation({ conversationId: '../state' }), { code: 'AGENT_INPUT_INVALID' });
  fs.writeFileSync(path.join(root, 'conversations', 'bad-json.json'), '{');
  assert.equal(runtime.listConversations().find((item) => item.id === 'bad-json').unavailable, true);
  assert.equal(runtime.getState().conversation.id, id);
  assert.equal(fs.existsSync(path.join(root, 'state.json')), false);
});

test('opening archived tasks recovers interrupted writes without replaying them', (t) => {
  const { root, runtime } = fixture(t);
  createAgentStorage(root).archive({ id: 'recovered', messages: [], attachments: [], tasks: [{ id: 'old', status: 'verifying', steps: [{ status: 'running' }], proposals: [{ status: 'applying' }] }] });
  const result = runtime.openConversation({ conversationId: 'recovered' });
  assert.equal(result.activeTask, null);
  assert.equal(result.conversation.tasks[0].status, 'uncertain');
  assert.equal(result.conversation.tasks[0].proposals[0].status, 'uncertain');
});

/** 每个案例使用系统临时目录与合成工具，不触及用户配置。 */
function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const events = [];
  const tools = { definitions: [], execute: async () => ({ value: 'actual' }),
    apply: async (proposal) => { proposal.appliedRevision = 'v2'; return { installed: true }; }, restore: async () => ({ restored: true }), ...overrides.tools };
  const execute = tools.execute;
  tools.execute = (name, args, context) => name === 'get_current_system'
    ? (overrides.readCurrentSystem || (() => ({ currentSystem: null, selectionStatus: 'unselected' })))(context)
    : execute(name, args, context);
  const runtime = createAgentRuntime({ root, tools, onEvent: (event) => events.push(event),
    modelRequest: async ({ onText }) => { onText('实际查询结果'); return { output: [] }; }, ...overrides, tools });
  runtime.configure({ baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'private-secret' });
  return { root, runtime, events };
}

test('calls a real tool before reporting and persists history without credentials', async (t) => {
  let count = 0, received;
  const { root, runtime } = fixture(t, { modelRequest: async ({ input, onText }) => {
    if (!count++) return { output: [{ type: 'function_call', name: 'get_current_state', call_id: 'call1', arguments: '{}' }] };
    received = input; onText('已根据实际状态回答'); return { output: [] };
  } });
  const task = runtime.startTask({ text: '查询当前系统' });
  await runtime.whenIdle();
  const state = runtime.getState();
  assert.equal(state.activeTask, null); assert.equal(state.conversation.tasks[0].status, 'succeeded');
  assert.equal(state.conversation.tasks[0].steps[0].status, 'succeeded');
  assert.equal(state.conversation.messages[1].taskId, task.id);
  assert.equal(JSON.parse(received.at(-1).output).value, 'actual');
  assert.ok(!JSON.stringify(state).includes('private-secret'));
  assert.ok(!fs.readFileSync(path.join(root, 'state.json'), 'utf8').includes('private-secret'));
});

test('every task reads current selection before the first model call and keeps each task context separate', async (t) => {
  let current = { id: 'hand', name: '手部检测', kind: 'builtin', sourceType: 'hand' };
  const inputs = []; let reads = 0;
  const { runtime } = fixture(t, {
    readCurrentSystem: () => { reads++; return { currentSystem: { ...current }, selectionStatus: 'selected' }; },
    modelRequest: async ({ input, onText }) => { assert.equal(reads, inputs.length + 1); inputs.push(structuredClone(input)); onText('已读取当前系统'); return { output: [] }; },
  });
  runtime.startTask({ text: '以当前系统为模板创建' }); await runtime.whenIdle();
  current = { id: 'my-hand', name: '我的手部', kind: 'builtin-template', sourceType: 'hand' };
  runtime.startTask({ text: '现在当前是哪个系统' }); await runtime.whenIdle();
  assert.ok(inputs[0].at(-2).content.includes('"id":"hand"'));
  assert.ok(inputs[1].at(-2).content.includes('"id":"my-hand"'));
  assert.equal(inputs[1].filter((message) => message.content.includes('本次任务的当前系统快照')).length, 1);
  assert.equal(inputs[1].at(-1).content, '现在当前是哪个系统');
  const tasks = runtime.getState().conversation.tasks;
  assert.deepEqual(tasks.map((task) => task.systemContext.currentSystem.id), ['hand', 'my-hand']);
  assert.match(tasks[1].steps[0].message, /我的手部（my-hand）/);
  assert.ok(tasks.every((task) => task.proposals.length === 0));
});

test('failed context reads explicitly provide unavailable state without reusing the last system', async (t) => {
  let fail = false; const inputs = [];
  const { runtime } = fixture(t, {
    readCurrentSystem: () => { if (fail) throw agentError('AGENT_HTTP_UNAVAILABLE', '无法读取系统'); return { currentSystem: { id: 'hand', name: '手部检测' } }; },
    modelRequest: async ({ input }) => { inputs.push(structuredClone(input)); return { output: [] }; },
  });
  runtime.startTask({ text: '查询当前系统' }); await runtime.whenIdle();
  fail = true;
  runtime.startTask({ text: '现在呢' }); await runtime.whenIdle();
  assert.ok(inputs[1].at(-2).content.includes('"selectionStatus":"unavailable"'));
  assert.ok(!inputs[1].at(-2).content.includes('手部检测'));
  const task = runtime.getState().conversation.tasks[1];
  assert.equal(task.systemContext.currentSystem, null);
  assert.equal(task.status, 'failed');
  assert.equal(task.steps[0].status, 'failed');
});

test('cancelling the automatic current-system read prevents a model request', async (t) => {
  let modelCalls = 0;
  const { runtime } = fixture(t, {
    readCurrentSystem: ({ signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    modelRequest: async () => { modelCalls++; return { output: [] }; },
  });
  const task = runtime.startTask({ text: '查询当前系统' });
  await new Promise((resolve) => setImmediate(resolve));
  runtime.cancelTask({ taskId: task.id }); await runtime.whenIdle();
  assert.equal(modelCalls, 0);
  assert.equal(runtime.getState().conversation.tasks[0].status, 'cancelled');
});

test('a conversational answer cannot hide an unresolved tool failure', async (t) => {
  let count = 0;
  const { runtime } = fixture(t, { tools: { execute: async () => { throw agentError('AGENT_INVALID_ARGUMENTS', '至少需要一项传感器定义'); } },
    modelRequest: async ({ onText }) => {
      if (!count++) return { output: [{ type: 'function_call', name: 'prepare_create_system', call_id: 'bad', arguments: '{}' }] };
      onText('请补充传感器信息。'); return { output: [] };
    } });
  runtime.startTask({ text: '创建系统' }); await runtime.whenIdle();
  const task = runtime.getState().conversation.tasks[0];
  assert.equal(task.status, 'failed');
  assert.equal(task.error.code, 'AGENT_TOOL_FAILED');
  assert.match(task.error.message, /传感器定义/);
  assert.equal(runtime.getState().conversation.messages.at(-1).text, '请补充传感器信息。');
});

test('a corrected tool call clears the failure for that operation', async (t) => {
  let turn = 0, attempts = 0;
  const { runtime } = fixture(t, { tools: { execute: async () => { if (!attempts++) throw agentError('AGENT_INVALID_ARGUMENTS', '请修正参数'); return { value: 'actual' }; } },
    modelRequest: async () => ({ output: turn++ < 2 ? [{ type: 'function_call', name: 'read_system', call_id: `read-${turn}`, arguments: '{}' }] : [] }) });
  runtime.startTask({ text: '查询系统' }); await runtime.whenIdle();
  const task = runtime.getState().conversation.tasks[0];
  assert.equal(task.status, 'succeeded');
  assert.equal(task.error, undefined);
  assert.deepEqual(task.steps.map((step) => step.status), ['succeeded', 'failed', 'succeeded']);
});

test('proposals require an explicit apply and cannot apply twice', async (t) => {
  let count = 0, applies = 0;
  const { runtime } = fixture(t, { tools: {
    execute: async (_name, _args, context) => context.createProposal({ kind: 'update_display', systemId: 'demo', summary: '修改图表', before: {}, after: { chartCards: [] } }),
    apply: async (proposal) => { applies++; assert.equal(proposal.status, 'applying'); proposal.appliedRevision = 'v2'; return { revision: 'v2' }; },
    restore: async (proposal) => { assert.equal(proposal.appliedRevision, 'v2'); return { revision: 'v3' }; },
  }, modelRequest: async ({ onText }) => {
    if (!count++) return { output: [{ type: 'function_call', name: 'prepare', call_id: 'call1', arguments: '{}' }] };
    onText('草稿待应用'); return { output: [] };
  } });
  runtime.startTask({ text: '修改当前图表' }); await runtime.whenIdle();
  let task = runtime.getState().conversation.tasks[0];
  assert.equal(task.status, 'awaiting_action'); assert.equal(applies, 0);
  const args = { taskId: task.id, proposalId: task.proposals[0].id };
  runtime.applyProposal(args); await runtime.whenIdle();
  runtime.applyProposal(args); assert.equal(applies, 1);
  runtime.restoreProposal(args); await runtime.whenIdle();
  task = runtime.getState().conversation.tasks[0];
  assert.equal(task.proposals[0].status, 'restored');
});

test('cancellation stops dispatch and new conversation cannot steal in-flight results', async (t) => {
  let calls = 0;
  const { runtime } = fixture(t, { modelRequest: ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), tools: { execute: async () => { calls++; } } });
  const task = runtime.startTask({ text: '检查设备' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.throws(() => runtime.newConversation(), { code: 'AGENT_BUSY' });
  assert.throws(() => runtime.startTask({ text: '并行任务' }), { code: 'AGENT_BUSY' });
  runtime.cancelTask({ taskId: task.id }); await runtime.whenIdle();
  assert.equal(runtime.getState().conversation.tasks[0].status, 'cancelled'); assert.equal(calls, 0);
  runtime.newConversation(); assert.equal(runtime.getState().conversation.messages.length, 0);
});

test('device connection requires explicit apply and reports open without claiming valid data', async (t) => {
  let count = 0, applies = 0;
  const { runtime } = fixture(t, { tools: {
    execute: async (_name, _args, context) => context.createProposal({ kind: 'connect_device', systemId: 'demo', after: { sensorId: 'sit', portPath: 'COM8' }, input: { private: 'internal' } }),
    apply: async () => { applies++; return { accepted: true, connected: true, liveVerified: false }; },
  }, modelRequest: async () => ({ output: count++ ? [] : [{ type: 'function_call', name: 'prepare_connect_device', call_id: 'c', arguments: '{}' }] }) });
  runtime.startTask({ text: '连接 demo 的 sit 到 COM8' }); await runtime.whenIdle();
  const task = runtime.getState().conversation.tasks[0];
  assert.equal(applies, 0); assert.equal(task.proposals[0].input, undefined);
  const args = { taskId: task.id, proposalId: task.proposals[0].id };
  runtime.applyProposal(args); await runtime.whenIdle();
  assert.equal(applies, 1);
  assert.ok(runtime.getState().conversation.messages.at(-1).text.includes('尚未验证有效实时数据'));
  assert.throws(() => runtime.restoreProposal(args), { code: 'AGENT_PROPOSAL_STATE' });
});

test('interrupted applying operations reload as uncertain without replaying', async (t) => {
  const { root } = fixture(t);
  const stored = { schemaVersion: 1, attachments: [], conversation: { id: 'old', messages: [], tasks: [
    { id: 't1', status: 'verifying', steps: [{ status: 'running' }], proposals: [{ id: 'p1', kind: 'update_display', status: 'applying' }] },
  ] } };
  fs.writeFileSync(path.join(root, 'state.json'), JSON.stringify(stored));
  const runtime = createAgentRuntime({ root, tools: {} });
  const task = runtime.getState().conversation.tasks[0];
  assert.equal(task.status, 'uncertain'); assert.equal(task.proposals[0].status, 'uncertain');
  assert.throws(() => runtime.applyProposal({ taskId: 't1', proposalId: 'p1' }), { code: 'AGENT_PROPOSAL_STATE' });
});

test('write result uncertainty is preserved and never blindly retried', async (t) => {
  let count = 0;
  const { runtime } = fixture(t, { tools: {
    execute: async (_name, _args, context) => context.createProposal({ kind: 'create_system', systemId: 'demo', after: {} }),
    apply: async () => { throw agentError('AGENT_OPERATION_UNCERTAIN', '请求中断，可能已经保存。'); },
  }, modelRequest: async () => ({ output: count++ ? [] : [{ type: 'function_call', name: 'prepare', call_id: 'c', arguments: '{}' }] }) });
  runtime.startTask({ text: '创建系统' }); await runtime.whenIdle();
  const task = runtime.getState().conversation.tasks[0];
  const args = { taskId: task.id, proposalId: task.proposals[0].id };
  runtime.applyProposal(args); await runtime.whenIdle();
  assert.equal(runtime.getState().conversation.tasks[0].status, 'uncertain');
  assert.throws(() => runtime.applyProposal(args), { code: 'AGENT_PROPOSAL_STATE' });
});

test('attachments are selected by current-session identity and not public full text', async (t) => {
  let received;
  const { runtime } = fixture(t, { modelRequest: async ({ input }) => { received = input; return { output: [] }; } });
  const files = runtime.importAttachments([{ name: 'mapping.csv', base64: Buffer.from('index,value\n1,100').toString('base64') }]);
  assert.equal(files.length, 1); assert.equal(files[0].text, undefined);
  runtime.startTask({ text: '读取线序', attachmentIds: [files[0].id] }); await runtime.whenIdle();
  assert.ok(received.at(-1).content.includes('index,value'));
  runtime.newConversation();
  assert.throws(() => runtime.startTask({ text: '读取附件', attachmentIds: [files[0].id] }), { code: 'AGENT_ATTACHMENT_NOT_FOUND' });
});
