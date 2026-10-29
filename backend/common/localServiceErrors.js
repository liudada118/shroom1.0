const listeners = new Set();

/** 将本地监听失败交给桌面生命周期处理，不终止或重用其他进程。 */
function subscribeLocalServiceErrors(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 在异步 listen 失败前挂好错误处理，保留日志并通知宿主退出自己的半启动实例。 */
function watchLocalServiceErrors(server, { service, port, logger }) {
  server.on('error', error => {
    logger?.error(`[LocalService:${service}]`, error);
    for (const listener of listeners) listener({ error, service, port });
  });
  return server;
}

module.exports = { subscribeLocalServiceErrors, watchLocalServiceErrors };
