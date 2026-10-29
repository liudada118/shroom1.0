const net = require('node:net');

/** 在加载后台前取得单实例锁，重复启动只唤起已有窗口。 */
function claimApplicationInstance(app, activate) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on('second-instance', activate);
  return true;
}

/** 用短暂独占监听检查本机端口，检查结束必须释放自己的 socket。 */
function checkLocalPort({ port, host, timeoutMs = 1500 }) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    let finished = false;
    const timer = setTimeout(() => finish(Object.assign(new Error('Local port check timed out'), {
      code: 'LOCAL_SERVICE_CHECK_TIMEOUT', port,
    })), timeoutMs);
    /** 只结算一次；发生超时后迟到的监听也由 listening 回调关闭。 */
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) {
        server.close(() => {});
        error.port = port;
        reject(error);
      } else resolve();
    }
    server.once('error', finish);
    server.once('listening', () => server.close(error => finish(error)));
    try { server.listen({ port, ...(host ? { host } : {}), exclusive: true }); }
    catch (error) { finish(error); }
  });
}

/** 确认固定端口可用后才初始化后台，避免与旧版本或开发进程共用接口。 */
async function checkApplicationPorts(ports = [
  // Windows 全接口 IPv6 监听可能与 IPv4 共存，必须另查前端实际连接的回环地址。
  { port: 19999, host: '127.0.0.1' },
  { port: 19999 },
  { port: 19245, host: '127.0.0.1' },
  { port: 12321, host: '127.0.0.1' },
]) {
  for (const entry of ports) await checkLocalPort(entry);
}

/** 返回不包含路径或任意异常正文的启动提示，覆盖应用支持的三种语言。 */
function startupFailureText(error, locale = 'zh') {
  const language = /^ja/i.test(locale) ? 'ja' : /^zh/i.test(locale) ? 'zh' : 'en';
  const port = Number.isInteger(error?.port) && error.port > 0 && error.port < 65536 ? String(error.port) : '';
  const occupied = error?.code === 'EADDRINUSE';
  const text = {
    zh: { title: 'Shroom 无法启动', occupied: `本机端口 ${port} 已被占用。请完全退出其他 Shroom 窗口和旧版本进程后重试；若仍失败，请检查是否有开发服务占用该端口。`,
      other: `无法启动本地服务${port ? `（端口 ${port}）` : ''}，请检查系统权限后重新打开 Shroom。` },
    en: { title: 'Shroom could not start', occupied: `Local port ${port} is already in use. Fully quit other Shroom windows and older processes, then try again. If it persists, check for a development server using this port.`,
      other: `The local service${port ? ` (port ${port})` : ''} could not start. Check system permissions and reopen Shroom.` },
    ja: { title: 'Shroom を起動できません', occupied: `ローカルポート ${port} は使用中です。他の Shroom ウィンドウと旧バージョンのプロセスを完全に終了して再試行してください。解決しない場合は、開発サーバーがこのポートを使用していないか確認してください。`,
      other: `ローカルサービス${port ? `（ポート ${port}）` : ''}を起動できません。システムの権限を確認して Shroom を再起動してください。` },
  }[language];
  return { title: text.title, message: occupied ? text.occupied : text.other };
}

module.exports = { claimApplicationInstance, checkLocalPort, checkApplicationPorts, startupFailureText };
