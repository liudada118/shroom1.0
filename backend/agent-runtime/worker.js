const { createAgentRuntime } = require('./runtime');
const { createAgentTools } = require('./tools');
const { publicError, agentError } = require('./errors');
const { requestModelResponse } = require('./provider');
const { net } = require('electron');

let runtime = null;
let secrets = [];
const parent = process.parentPort;
if (!parent) throw new Error('Agent worker must run in an Electron utility process');

/** 将受控事件发送给主进程，不写入 stdout 或日志。 */
function post(message) { parent.postMessage(message); }

/** 模型请求使用 Chromium 网络栈，继承系统代理；本机业务工具继续使用自己的直连请求。 */
function requestDesktopModel(options) {
  return requestModelResponse({ ...options, fetchImpl: (url, init) => net.fetch(url, init) });
}

/** 分派主进程消息；初始化和设置之外不接受凭据或任意工具调用。 */
async function dispatch(message) {
  const { id, action, payload = {} } = message || {};
  if (typeof id !== 'string' || typeof action !== 'string') return;
  try {
    let data;
    if (action === 'initialize') {
      if (runtime) throw agentError('AGENT_ALREADY_INITIALIZED', 'Agent 已初始化。');
      secrets = [payload.settings?.apiKey];
      runtime = createAgentRuntime({ root: payload.root, tools: createAgentTools({ root: payload.root, httpBaseUrl: payload.httpBaseUrl, wsUrl: payload.wsUrl }), modelRequest: requestDesktopModel, onEvent: (event) => post({ event }) });
      data = runtime.configure(payload.settings);
    } else {
      if (!runtime) throw agentError('AGENT_NOT_READY', 'Agent 尚未就绪。');
      const handlers = {
        getState: () => runtime.getState(), configure: () => { const result = runtime.configure(payload); secrets = [payload.apiKey]; return result; },
        startTask: () => runtime.startTask(payload), cancelTask: () => runtime.cancelTask(payload),
        importAttachments: () => runtime.importAttachments(payload.files), newConversation: () => runtime.newConversation(),
        listConversations: () => runtime.listConversations(), openConversation: () => runtime.openConversation(payload),
        listAlgorithmRecords: () => runtime.listAlgorithmRecords(payload), setAlgorithmSelection: () => runtime.setAlgorithmSelection(payload.selection),
        applyProposal: () => runtime.applyProposal(payload), restoreProposal: () => runtime.restoreProposal(payload),
        shutdown: () => runtime.dispose(),
      };
      if (!Object.hasOwn(handlers, action)) throw agentError('AGENT_ACTION_UNKNOWN', '不支持的 Agent 操作。');
      data = await handlers[action]();
    }
    post({ id, ok: true, data });
  } catch (error) { post({ id, ok: false, error: publicError(error, secrets) }); }
}

parent.on('message', (event) => { void dispatch(event.data); });
post({ ready: true });
