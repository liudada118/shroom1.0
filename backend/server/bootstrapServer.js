const DEFAULT_REPORT_HTTP_PORT = 19245;
const DEFAULT_REPORT_HTTP_HOST = '127.0.0.1';

/**
 * 启动时扫描一次串口候选列表。
 *
 * 这个函数只负责启动期副作用：扫描、过滤、写入运行时状态和输出日志。
 * 串口生命周期仍由 serialManager 负责。
 */
function scanStartupSerialPorts({
  getPort,
  listPorts,
  logger,
  logSerialPortList,
  setSerialPortState,
}) {
  return listPorts().then((ports) => {
    const serialport = getPort(ports);
    setSerialPortState('serialport', serialport);
    logSerialPortList('startup', serialport);
    return serialport;
  }).catch((err) => {
    logger.error('[SerialList] startup failed', err);
    return [];
  });
}

/**
 * 启动本地 OneStep HTTP 服务。
 *
 * 当前服务只监听 127.0.0.1，供前端上传截图、生成报告和调用控制 API。
 */
function startLocalHttpServer({
  app,
  host = DEFAULT_REPORT_HTTP_HOST,
  logger,
  port = DEFAULT_REPORT_HTTP_PORT,
}) {
  return app.listen(port, host, () => {
    logger.info(`[HTTP] OneStep report server listening on http://${host}:${port}`);
  });
}

module.exports = {
  DEFAULT_REPORT_HTTP_HOST,
  DEFAULT_REPORT_HTTP_PORT,
  scanStartupSerialPorts,
  startLocalHttpServer,
};

