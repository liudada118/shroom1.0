const { HalowReceiver } = require('./halowReceiver');

/** 构造可供 HTTP 回执使用的连接错误。 */
function connectionError(message, code = 'HALOW_BUSY', httpStatus = 409) {
  return Object.assign(new Error(message), { code, httpStatus });
}

/** 判断串口是否打开、正在打开或仍有自动重连意图。 */
function hasSerialConnection(statuses = []) {
  return statuses.some((status) => status.isOpen || status.reconnect
    || ['opening', 'stopping'].includes(status.status));
}

/** 将 HaLow 作为内置人体系统的数据源，沿用原有处理、归零与存储链路。 */
function createHalowService({ getContext, onFrame, publish = () => {}, receiverOptions = {} }) {
  let systemId = null;
  let pendingStarts = 0;
  let closing = false;
  /** 每次接收和启动完成时核对系统身份；采集中允许继续接收已有连接。 */
  function isAllowed() {
    const context = getContext();
    return !closing && !context.shutdown && context.licenseValid
      && context.file === 'humanBodyOptimized' && context.systemId === systemId
      && !context.playback && !context.serialBusy
      && (receiver.phase === 'listening' || !context.collecting);
  }
  const receiver = new HalowReceiver({ ...receiverOptions, isAllowed, onFrame });
  receiver.on('status', (status) => publish({ halowStatus: status }));
  receiver.on('clear', () => {
    const context = getContext();
    // ⚠️ 清屏只发送状态事件；假零帧进入数据链会污染采集和算法输入。
    if (context.file === 'humanBodyOptimized' && !context.playback) publish({ halowClear: true });
  });

  /** TCP 绑定和关闭期间也保留互斥，避免串口趁异步操作尚未结束时打开。 */
  function requireSerialAvailable() {
    if (isBusy()) {
      throw connectionError('请先停止 HaLow 接收，再打开串口');
    }
  }

  /** 判断传输是否仍被启动、接收或清理任务占用。 */
  function isBusy() { return pendingStarts > 0 || receiver.phase !== 'stopped'; }

  /** 立即取消旧会话；系统切换调用它时不必等待端口释放才更新身份。 */
  function stop() { return isBusy() ? receiver.stop() : Promise.resolve(); }

  /** 执行 HTTP 控制操作；停止在授权过期后仍可使用。 */
  function execute(request = {}) {
    const { action } = request;
    if (action === 'stop') return stop();
    const context = getContext();
    if (!context.licenseValid) throw connectionError('请先完成软件授权', 'LICENSE_REQUIRED', 403);
    if (action === 'status') return undefined;
    if (context.file !== 'humanBodyOptimized' || context.shutdown || closing) {
      throw connectionError('仅人体全身优化系统可使用 HaLow 接收');
    }
    if (context.playback || context.collecting) throw connectionError('请先退出回放或停止采集，再调整 HaLow 连接');
    if (action === 'select') return receiver.select(request.deviceId);
    if (action !== 'start') throw connectionError('未知 HaLow 操作', 'INVALID_COMMAND', 400);
    if (context.serialBusy) throw connectionError('请先关闭串口，避免串口和 HaLow 数据混用');
    if (pendingStarts || receiver.phase !== 'stopped') throw connectionError('HaLow 接收已开启或正在调整，请先停止');
    systemId = context.systemId;
    pendingStarts += 1;
    return receiver.start(request).finally(() => { pendingStarts -= 1; });
  }

  /** 关闭应用时拒绝后续启动并释放所有连接。 */
  function dispose() { closing = true; return stop(); }
  return { receiver, execute, stop, dispose, isBusy, requireSerialAvailable, snapshot: () => receiver.snapshot() };
}

/** 注册规范 HTTP 命令；异步操作完成后才回执最终状态。 */
function registerHalowControlHandler(router, { getService }) {
  router.register({
    name: 'halow-control',
    when: (message) => message.halow != null,
    handle: (message, context) => {
      if (context.transport !== 'http' || !context.waitFor) {
        throw connectionError('HaLow 控制必须使用 HTTP /api/commands', 'TRANSPORT_NOT_ALLOWED', 400);
      }
      const service = getService();
      const status = {};
      const operation = service.execute(message.halow);
      context.waitFor(Promise.resolve(operation).then(() => Object.assign(status, service.snapshot())));
      return { halowStatus: status, stop: true };
    },
  });
}

module.exports = { createHalowService, hasSerialConnection, registerHalowControlHandler };
