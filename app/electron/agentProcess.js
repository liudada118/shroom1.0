const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { createAgentSettings } = require('./agentSettings');
const { agentError, publicError } = require('../../backend/agent-runtime/errors');
const { MAX_FILE_BYTES, IMAGE_EXTENSIONS, imageMime } = require('../../backend/agent-runtime/attachments');
const { readClipboardFiles } = require('./agentClipboard');

const ACTIONS = new Set(['getState', 'listConversations', 'openConversation', 'listAlgorithmRecords', 'setAlgorithmSelection', 'saveSettings', 'startTask', 'cancelTask', 'newConversation', 'importFiles', 'importAttachments', 'importClipboard', 'applyProposal', 'restoreProposal']);
const trustedWindowOrigins = new WeakMap();

/** 由主进程加载已核验的前端地址，并绑定该窗口唯一可信的 Agent 来源。 */
async function loadAgentWindowUrl(window, address) {
  const url = new URL(address);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password) {
    throw agentError('AGENT_WINDOW_URL_INVALID', 'Agent 主页面必须由本机应用服务加载。');
  }
  trustedWindowOrigins.set(window, url.origin);
  try { return await window.loadURL(address); }
  catch (error) {
    if (trustedWindowOrigins.get(window) === url.origin) trustedWindowOrigins.delete(window);
    throw error;
  }
}

/** 只允许 Shroom 主页面调用 Agent，拒绝子 frame 和其他来源。 */
function isTrustedAgentSender(event, window) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return !url.username && !url.password && url.origin === trustedWindowOrigins.get(window);
  } catch { return false; }
}

/** 管理独立 Agent 子进程、有限 IPC、附件选择和操作系统凭据存储。 */
function createAgentProcess({ electron, root, getWindow, timeoutMs = 20000, backendEndpoints = {} }) {
  const { utilityProcess, safeStorage, dialog } = electron;
  const settings = createAgentSettings({ root, safeStorage });
  const requests = new Map();
  let child = null, starting = null, closed = false, lastState = null, actionPending = false;

  /** 向当前主窗口发布事件；窗口关闭后不继续发送。 */
  function emit(event) {
    if (event.type === 'state') lastState = event.state;
    const window = getWindow();
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('agent:event', event);
  }

  /** 完成或拒绝指定进程的全部未决调用。 */
  function rejectPending(processRef, error) {
    for (const [id, request] of requests) if (request.child === processRef) {
      clearTimeout(request.timer); requests.delete(id); request.reject(error);
    }
  }

  /** 给已经启动的子进程发送一个带身份的请求。 */
  function request(processRef, action, payload = {}, limit = timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        requests.delete(id);
        reject(agentError('AGENT_PROCESS_TIMEOUT', 'Agent 进程响应超时，请重新打开面板检查任务状态。'));
      }, limit);
      requests.set(id, { resolve, reject, timer, child: processRef });
      try { processRef.postMessage({ id, action, payload }); }
      catch {
        clearTimeout(timer); requests.delete(id);
        reject(agentError('AGENT_PROCESS_CLOSED', 'Agent 进程已断开，请重新打开面板。'));
      }
    });
  }

  /** 懒启动专用进程，失败不阻止软件原有功能使用。 */
  function ensureStarted() {
    if (closed) return Promise.reject(agentError('AGENT_CLOSED', 'Agent 正在关闭。'));
    if (starting) return starting;
    if (child) return Promise.resolve(child);
    const processRef = utilityProcess.fork(path.resolve(__dirname, '../../backend/agent-runtime/worker.js'), [], {
      serviceName: 'Shroom Agent', stdio: 'ignore',
    });
    child = processRef;
    starting = new Promise((resolve, reject) => {
      let initialized = false;
      const timer = setTimeout(() => { reject(agentError('AGENT_START_TIMEOUT', 'Agent 启动超时。')); processRef.kill(); }, timeoutMs);
      processRef.on('message', (message) => {
        if (child !== processRef) return;
        if (message?.ready && !initialized) {
          initialized = true;
          request(processRef, 'initialize', { root, settings: settings.getPrivate(), httpBaseUrl: backendEndpoints.httpBaseUrl, wsUrl: backendEndpoints.wsUrl }).then(() => {
            clearTimeout(timer); resolve(processRef);
          }, (error) => { clearTimeout(timer); reject(error); processRef.kill(); });
        } else if (message?.event) emit(message.event);
        else if (message?.id) {
          const pending = requests.get(message.id);
          if (!pending || pending.child !== processRef) return;
          clearTimeout(pending.timer); requests.delete(message.id);
          if (message.ok) pending.resolve(message.data);
          else pending.reject(agentError(message.error?.code || 'AGENT_ERROR', message.error?.message || 'Agent 操作失败。'));
        }
      });
      processRef.once('exit', () => {
        clearTimeout(timer);
        const error = agentError('AGENT_PROCESS_EXITED', 'Agent 进程已结束，重新打开面板可恢复任务记录。');
        rejectPending(processRef, error); reject(error);
        if (child === processRef) {
          child = null; starting = null;
          if (!closed) {
            if (lastState?.activeTask) {
              const task = lastState.activeTask;
              task.status = task.status === 'verifying' ? 'uncertain' : 'interrupted';
              task.error = publicError(error);
              lastState.activeTask = null;
              emit({ type: 'state', state: lastState });
            }
            emit({ type: 'runtime.error', error: publicError(error) });
          }
        }
      });
    }).finally(() => { starting = null; });
    return starting;
  }

  /** 有界读取用户选择或从系统剪贴板复制的文件。 */
  async function readFiles(filePaths) {
    if (filePaths.length > 6) throw agentError('AGENT_ATTACHMENT_LIMIT', '每次最多选择 6 个附件。');
    const files = [];
    for (const file of filePaths) {
      const handle = await fs.open(file, 'r');
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES || !stat.size) throw agentError('AGENT_ATTACHMENT_LIMIT', '附件须为非空文件且不超过 8 MB。');
        const buffer = Buffer.alloc(stat.size + 1);
        let received = 0;
        while (received < buffer.length) {
          const { bytesRead } = await handle.read(buffer, received, buffer.length - received, received);
          if (!bytesRead) break;
          received += bytesRead;
        }
        if (received !== stat.size) throw agentError('AGENT_ATTACHMENT_CHANGED', '附件读取期间发生变化，请重新导入。');
        files.push({ name: path.basename(file), base64: buffer.subarray(0, received).toString('base64') });
      } finally { await handle.close(); }
    }
    return files;
  }

  /** 校验跨进程附件字节，并用原生解码器生成小尺寸图片预览。 */
  function prepareFiles(files) {
    if (!Array.isArray(files) || !files.length || files.length > 6) throw agentError('AGENT_ATTACHMENT_LIMIT', '每次可添加 1 到 6 个附件。');
    return files.map((file) => {
      if (!file || Object.keys(file).some((key) => !['name', 'base64'].includes(key)) || typeof file.name !== 'string' || !file.name || file.name.length > 240 || /[\\/]/.test(file.name)
        || typeof file.base64 !== 'string' || !file.base64.length || file.base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) {
        throw agentError('AGENT_INPUT_INVALID', '附件名称或内容无效，单个附件不得超过 8 MB。');
      }
      const bytes = Buffer.from(file.base64, 'base64');
      if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw agentError('AGENT_ATTACHMENT_LIMIT', '单个附件不得超过 8 MB。');
      const result = { name: file.name, base64: file.base64 };
      if (IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase())) {
        const image = electron.nativeImage.createFromBuffer(bytes);
        if (!imageMime(bytes) || image.isEmpty()) throw agentError('AGENT_ATTACHMENT_INVALID', '图片无法解码，请使用完整的 PNG、JPEG、WebP 或 GIF 图片。');
        const { width, height } = image.getSize();
        if (!width || !height || width * height > 25000000) throw agentError('AGENT_ATTACHMENT_LIMIT', '图片分辨率过大，请缩小至 2500 万像素以内。');
        const ratio = Math.min(1, 240 / width, 180 / height);
        result.thumbnail = image.resize({ width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }).toDataURL();
      }
      return result;
    });
  }

  /** 统一文件选择、网页粘贴和 Windows 资源管理器复制的附件入口。 */
  async function importFiles(processRef, action, payload) {
    let files;
    if (action === 'importAttachments') files = payload.files;
    else if (action === 'importClipboard') {
      const paths = await readClipboardFiles(electron.clipboard);
      if (paths.length) files = await readFiles(paths);
      else {
        const image = electron.clipboard.readImage();
        if (image.isEmpty()) return [];
        files = [{ name: `粘贴图片-${Date.now()}.png`, base64: image.toPNG().toString('base64') }];
      }
    } else {
      const result = await dialog.showOpenDialog(getWindow(), {
        title: '添加图片或资料', properties: ['openFile', 'multiSelections'],
        filters: [{ name: '图片、协议与点位资料', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md', 'json', 'csv', 'tsv', 'log', 'xlsx'] }],
      });
      if (result.canceled) return [];
      files = await readFiles(result.filePaths);
    }
    return request(processRef, 'importAttachments', { files: prepareFiles(files) });
  }

  /** 处理主页面白名单动作，凭据与文件路径不由模型提供。 */
  async function invoke(action, payload = {}) {
    if (!ACTIONS.has(action)) throw agentError('AGENT_ACTION_UNKNOWN', '不支持的 Agent 操作。');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || (action === 'importAttachments'
      ? Object.keys(payload).some((key) => key !== 'files') || !Array.isArray(payload.files) || payload.files.length > 6
      : JSON.stringify(payload).length > 24000)) throw agentError('AGENT_INPUT_INVALID', 'Agent 操作参数无效或过大。');
    const processRef = await ensureStarted();
    if (action === 'getState' || action === 'listConversations') return request(processRef, action);
    if (action === 'cancelTask') return request(processRef, action, { taskId: payload.taskId });
    if (actionPending) throw agentError('AGENT_BUSY', '正在处理上一个操作，请稍候。');
    actionPending = true;
    try {
      if (action === 'listAlgorithmRecords') return await request(processRef, action, { offset: payload.offset });
      if (action === 'setAlgorithmSelection') return await request(processRef, action, { selection: payload.selection });
      if (action === 'saveSettings') {
        const state = await request(processRef, 'getState');
        if (state.activeTask) throw agentError('AGENT_BUSY', '请先停止当前任务再修改连接设置。');
        const result = settings.save(payload);
        await request(processRef, 'configure', settings.getPrivate());
        return result;
      }
      if (['importFiles', 'importAttachments', 'importClipboard'].includes(action)) return await importFiles(processRef, action, payload);
      const allowed = action === 'startTask' ? { text: payload.text, attachmentIds: payload.attachmentIds }
        : action === 'newConversation' ? {} : action === 'openConversation' ? { conversationId: payload.conversationId } : { taskId: payload.taskId, proposalId: payload.proposalId };
      return await request(processRef, action, allowed);
    } finally { actionPending = false; }
  }

  /** 优先请求正常退出，超时后结束专用进程。 */
  async function dispose() {
    closed = true;
    const processRef = child;
    if (!processRef) return;
    try { await request(processRef, 'shutdown', {}, 3000); } catch { /* 记录由运行器恢复为中断或不确定。 */ }
    if (child === processRef) processRef.kill();
    rejectPending(processRef, agentError('AGENT_CLOSED', 'Agent 已关闭。'));
    child = null;
  }

  return { invoke, dispose };
}

/** 注册最小 Agent IPC，响应始终使用稳定 envelope。 */
function registerAgentIpc({ ipcMain, getWindow, getProcess }) {
  ipcMain.handle('agent:invoke', async (event, action, payload) => {
    if (!isTrustedAgentSender(event, getWindow())) return { ok: false, error: { code: 'AGENT_FORBIDDEN', message: '该页面无权操作 Agent。' } };
    try { return { ok: true, data: await getProcess().invoke(action, payload) }; }
    catch (error) { return { ok: false, error: publicError(error) }; }
  });
}

module.exports = { createAgentProcess, registerAgentIpc, isTrustedAgentSender, loadAgentWindowUrl };
