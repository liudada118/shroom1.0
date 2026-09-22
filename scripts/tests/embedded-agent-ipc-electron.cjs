const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const electron = require('electron');
const { createAgentProcess, registerAgentIpc, loadAgentWindowUrl } = require('../../app/electron/agentProcess');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-ipc-'));
electron.app.setPath('userData', root);
electron.app.disableHardwareAcceleration();
const windows = [], servers = [];
let mainWindow, manager;
const watchdog = setTimeout(() => { console.error('Agent IPC smoke timed out'); electron.app.exit(1); }, 30000);

/** 为真实沙箱窗口提供完全本机的页面和子 frame，不调用模型或设备。 */
async function createFixtureServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(request.url === '/frame' ? '<!doctype html><title>Child frame</title>'
      : '<!doctype html><title>Shroom IPC fixture</title><iframe src="/frame"></iframe>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

/** 默认复用正式窗口的安全选项；子 frame 案例单独授予 preload 以实测 IPC 拒绝。 */
function createWindow(subframeProbe = false) {
  const window = new electron.BrowserWindow({ show: false, webPreferences: {
    contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true,
    preload: path.resolve(__dirname, '../../app/electron/preload.js'),
    ...(subframeProbe ? { nodeIntegrationInSubFrames: true } : {}),
  } });
  windows.push(window);
  return window;
}

/** 从渲染页面通过正式 preload 调用 Agent，检查完整 IPC 往返。 */
function getState(frame) {
  return frame.executeJavaScript("window.electronAPI.agent.invoke('getState')");
}

/** 验证真实动态端口、主 frame 身份、其他窗口及导航后的权限边界。 */
async function main() {
  await electron.app.whenReady();
  const origin = await createFixtureServer();
  const otherOrigin = await createFixtureServer();
  assert.ok(!['3000', '12321'].includes(new URL(origin).port));
  registerAgentIpc({ ipcMain: electron.ipcMain, getWindow: () => mainWindow, getProcess: () => manager });
  manager = createAgentProcess({ electron, root: path.join(root, 'agent'), getWindow: () => mainWindow });
  mainWindow = createWindow();
  await loadAgentWindowUrl(mainWindow, origin);
  const result = await getState(mainWindow.webContents);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.settings.hasApiKey, false);
  assert.ok(result.data.conversation.id);

  const image = electron.nativeImage.createFromBitmap(Buffer.from([100, 150, 200, 255]), { width: 1, height: 1 });
  const files = [{ name: '截图.png', base64: image.toPNG().toString('base64') }, { name: '协议.txt', base64: Buffer.from('test protocol').toString('base64') }];
  const imported = await mainWindow.webContents.executeJavaScript(`window.electronAPI.agent.invoke('importAttachments', ${JSON.stringify({ files })})`);
  assert.equal(imported.ok, true, JSON.stringify(imported));
  assert.equal(imported.data[0].kind, 'image');
  assert.ok(imported.data[0].thumbnail.startsWith('data:image/png;base64,'));
  assert.equal(imported.data[0].base64, undefined);
  await mainWindow.webContents.executeJavaScript("window.electronAPI.agent.invoke('newConversation')");
  const history = await mainWindow.webContents.executeJavaScript("window.electronAPI.agent.invoke('listConversations')");
  assert.equal(history.data.length, 2);
  const reopened = await mainWindow.webContents.executeJavaScript(`window.electronAPI.agent.invoke('openConversation', ${JSON.stringify({ conversationId: result.data.conversation.id })})`);
  assert.equal(reopened.data.attachments.length, 2);
  const forbiddenPath = await mainWindow.webContents.executeJavaScript("window.electronAPI.agent.invoke('importAttachments', {files:[{name:'test.txt',base64:'YQ==',path:'C:/private.txt'}]})");
  assert.equal(forbiddenPath.error.code, 'AGENT_INPUT_INVALID');
  const invalidImage = await mainWindow.webContents.executeJavaScript("window.electronAPI.agent.invoke('importAttachments', {files:[{name:'bad.png',base64:'YQ=='}]})");
  assert.equal(invalidImage.error.code, 'AGENT_ATTACHMENT_INVALID');

  const foreign = createWindow();
  await loadAgentWindowUrl(foreign, origin);
  assert.equal((await getState(foreign.webContents)).error.code, 'AGENT_FORBIDDEN');

  await mainWindow.loadURL(otherOrigin);
  assert.equal((await getState(mainWindow.webContents)).error.code, 'AGENT_FORBIDDEN');
  await loadAgentWindowUrl(mainWindow, origin);
  assert.equal((await getState(mainWindow.webContents)).ok, true);

  mainWindow = createWindow(true);
  await loadAgentWindowUrl(mainWindow, origin);
  assert.equal((await getState(mainWindow.webContents)).ok, true);
  const child = mainWindow.webContents.mainFrame.frames.find((frame) => frame.url === `${origin}/frame`);
  assert.ok(child, 'same-origin child frame must exist');
  assert.equal(await child.executeJavaScript('typeof window.electronAPI?.agent?.invoke'), 'function');
  assert.equal((await getState(child)).error.code, 'AGENT_FORBIDDEN');
  console.log('PASS: real sandboxed BrowserWindow/preload IPC on a dynamic port; utility-process state; foreign window, changed origin and child frame rejected. No model or device access.');
}

/** 关闭测试窗口、进程和本机服务；仅清理明确创建的临时目录。 */
async function cleanup() {
  clearTimeout(watchdog);
  await manager?.dispose();
  for (const window of windows) if (!window.isDestroyed()) window.destroy();
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'shroom-agent-ipc-'));
  try { fs.rmSync(root, { recursive: true, force: true }); }
  catch (error) {
    if (!['EPERM', 'EBUSY'].includes(error.code)) throw error;
    // Chromium 在 Windows 退出前可能持有缓存句柄，保留唯一测试目录供退出后清理。
    console.log(`Temporary browser fixture (remove after exit): ${root}`);
  }
}

main().then(async () => { await cleanup(); electron.app.exit(0); }).catch(async (error) => {
  console.error(error);
  try { await cleanup(); } catch (cleanupError) { console.error(cleanupError); }
  electron.app.exit(1);
});
