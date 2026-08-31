const { createHistoryAnalysisService } = require('../../playback/historyAnalysisService');

const { createCommandAck } = require('@shroom/backend/contract/commandProtocol.js');

/**
 * WebSocket 连接处理挂载器。
 *
 * 该模块只负责三端口 WebSocket 连接、订阅注册、心跳和旧消息入口分发。
 * 授权激活由 server.js 注入的语义入口处理，历史/框选回放命令下沉到 service。
 *
 * ⚠️ 上面「三端口」是过期说法，这次只是把乱码还原，没有改写原文。实际上
 * **全后端只有一个 WebSocket 端口（19999）**，通道隔离靠订阅
 * （`displaySystemId:sensorId`）而不是靠端口 —— 见
 * `websocketRuntimeFactory.createWebSocketServer` 的说明。sit/back/head 三端口是
 * manifest 之前的模型，不要据此推断还存在固定通道表。
 */

/**
 * 向当前连接单独发送系统事件。
 *
 * 授权密钥属于敏感数据，只用于授权门户回填，不能跟普通系统状态一样全局广播。
 *
 * @param {WebSocket} ws 当前连接。
 * @param {object} data 要发送给当前连接的数据。
 * @param {object} logger 日志对象。
 */
function sendPrivateSystemEvent(ws, data, logger) {
  try {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  } catch (err) {
    logger.warn('[WebSocket] Failed to send private system event:', err.message);
  }
}

/**
 * 给一条命令回执（`command.ack`），点对点发回下命令的那个连接。
 *
 * **没 `requestId` 或 `type` 就不发**：旧字段命令（`{variety: 1}` 这类）没有 requestId、也没有能对
 * 上号的回执概念，发一条无法关联的回执只会让老前端多收一条不认识的消息。走
 * `sendPrivateSystemEvent` 而非广播 —— 回执属于某一个请求，广播既是噪音也泄露别人在操作什么。
 * 错误先看整体 `result.error`（归一/校验失败）再看第一个带 error 的 handler 条目，一个失败就整体
 * 回失败。成功才带 `data`，失败传 `undefined`（`createCommandAck` 会整字段省略，前端可用
 * `'data' in ack` 判断）。
 *
 * ⚠️ `ok` 要求 **`handled === true`**，所以「没有任何 handler 接」会回 rejected 而非 accepted ——
 * 否则前端发一个拼错的命令名会拿到成功回执，然后一直等一个永远不来的状态变化。
 *
 * @param {WebSocket} ws 下命令的连接。
 * @param {object} message 原始命令消息，提供 requestId/type。
 * @param {object} result `controlCommandService.executeWs` 的执行摘要。
 * @param {object} logger 日志对象。
 * @returns {void}
 */
function sendCommandResultAck(ws, message, result, logger) {
  if (!message?.requestId || !message?.type) return;
  const error = result?.error || result?.results?.find((item) => item.error);
  sendPrivateSystemEvent(ws, createCommandAck({
    requestId: message.requestId,
    commandType: message.type,
    ok: !error && result?.handled === true,
    code: error?.code,
    message: error?.message || error?.error,
    data: error ? undefined : {
      handlers: result?.results?.map((item) => item.name) || [],
      results: result?.results || [],
    },
  }), logger);
}

/**
 * 构造同时包含授权范围和当前运行类型的系统状态。
 *
 * file/selectFlag 保留旧授权协议，currentSensorType 只描述当前 runtime 选择。
 */
function createSensorStatusPayload(ctx, extra = {}) {
  return {
    file: ctx.licenseFile ?? null,
    currentSensorType: ctx.file,
    selectFlag: ctx.selectFlag,
    ...extra,
  };
}

/**
 * 单端口接入后，根据客户端当前的精确订阅恢复旧靠背端口的命令语义。
 * 只有仅订阅 back 的连接使用 back scope；默认 * 和多通道连接仍走 main。
 */
function resolveCommandScope(wsSubscriptions, client) {
  const channels = typeof wsSubscriptions?.getSubscriptions === 'function'
    ? wsSubscriptions.getSubscriptions(client)
    : [];
  return channels.length === 1 && channels[0] === 'back' ? 'back' : 'main';
}

/**
 * 造一个「把 WebSocket 监听器挂上去」的函数。
 *
 * 分两步（工厂 + 返回的函数）是因为**挂监听器的时机比构造时机晚**：构造上下文时数据库、串口、授权
 * 都还没就绪，而 `connection` 回调一旦挂上就可能立刻有客户端连进来。`ctx.serverOpened` 是幂等保护
 * （重复挂载不报错，但每条消息会被处理两次）。四个 handler 在这里注册而不是 server.js，因为它们都
 * 依赖 ctx 上的运行态；注册顺序不影响行为（`controlCommandRouter` 按 `when` 谓词匹配）。新连接会
 * **主动推三到四条消息**而不等前端来问 —— 否则界面会先闪一下空状态。
 *
 * ⚠️ **只有稳定依赖可以解构，运行态字段必须写 `ctx.xxx` 现读**（`ctx.serialport`/`ctx.file`/
 * `ctx.endDate`/`ctx.nowDate`/`ctx.selectFlag`）：这些在 `legacyWebSocketContext` 上是 getter，解构
 * 等于在挂载那一刻拍快照。这是本文件最容易被二开踩坏的一条 —— 把 `ctx.file` 加进解构列表不报任何
 * 错，只会让「切换传感器型号」从此对新连接失效。
 *
 * ⚠️ `runtime: ctx` 把整个上下文当运行态交给了 `historyAnalysisService`，那个模块会**直接写**
 * `runtime.nowIndex` 这类字段（经 ctx 的 setter 落到 store）。旧逻辑搬迁时保留的写法。
 *
 * @param {object} ctx 由 `createWebSocketHandlerContext` 造出的运行时上下文。
 * @returns {Function} 调用一次即挂载全部监听器；重复调用无副作用。
 * @throws {Error} ctx 缺失时立刻抛 —— 这类装配错误必须在启动阶段暴露，
 *   而不是等到第一个客户端连上才炸。
 */
function createWebSocketHandlerAttacher(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('webSocket handler context is required');
  }

  return function attachWebSocketHandlers() {
    const {
      SMALL_BED_12B_TYPE,
      TEMP_FULL_BED_TYPE,
      WILDCARD_CHANNEL,
      activateSubmittedLicenseKey,
      attachHeartbeat,
      buildTempFullBedPlaybackPayload,
      controlCommandService,
      formatMatrixTotalForFile,
      getHistorySeries,
      getStoredLicenseKey,
      getStoredSitData,
      isSmallBedMatrixType,
      logger,
      normalizeHistoryPressureData,
      parseJsonMessage,
      parseStoredFrameData,
      publishPlaybackFrame,
      publishSystemEvent,
      server,
      totalToN,
      wsSubscriptions,
    } = ctx;

    if (ctx.serverOpened) {
      logger.info('[Server] openServer skipped: listeners already attached');
      return;
    }

    const historyCommandService = createHistoryAnalysisService({
      SMALL_BED_12B_TYPE,
      TEMP_FULL_BED_TYPE,
      buildTempFullBedPlaybackPayload,
      formatMatrixTotalForFile,
      getHistorySeries,
      getStoredSitData,
      isSmallBedMatrixType,
      logger,
      normalizeHistoryPressureData,
      parseStoredFrameData,
      publishPlaybackFrame,
      publishSystemEvent,
      runtime: ctx,
      totalToN,
    });

    controlCommandService.registerHandler({
      name: 'history-compatibility',
      when: (message) => (
        message.variety != null ||
        message.value != null ||
        message.backIndex != null ||
        message.sitIndex != null ||
        message.indexArr != null
      ),
      handle: (message, context) => {
        historyCommandService.handle(message, { clientName: context.clientName });
      },
    });

    controlCommandService.registerHandler({
      name: 'license-activation',
      when: (message) => message.date?.date != null,
      handle: (message) => {
        if (typeof activateSubmittedLicenseKey !== 'function') {
          const error = new Error('license activation service is not available');
          error.code = 'COMMAND_EXECUTION_FAILED';
          throw error;
        }
        const activation = activateSubmittedLicenseKey(message.date.date);
        if (!activation.ok) {
          const error = new Error(activation.message);
          error.code = activation.code || 'COMMAND_EXECUTION_FAILED';
          throw error;
        }
        publishSystemEvent(activation.payload);
        return { activationCode: activation.code || 'OK' };
      },
    });

    controlCommandService.registerHandler({
      name: 'license-status-refresh',
      when: (message) => message.refreshLicense === true,
      handle: () => {
        const payload = createSensorStatusPayload(ctx, {
          date: ctx.endDate,
          nowDate: ctx.nowDate,
        });
        publishSystemEvent(payload);
        return { payload };
      },
    });

    controlCommandService.registerHandler({
      name: 'sensor-types-status',
      when: (message) => message.getSensorTypes === true,
      handle: () => ({
        currentSensorType: ctx.file,
        selectFlag: ctx.selectFlag,
      }),
    });

    ctx.serverOpened = true;
    ctx.serverShutdownRequested = false;

    server.on('open', function open() {
      logger.info('connected');
    });

    server.on('close', function close() {
      logger.info('disconnected');
    });

    // 所有客户端都从共享端口接入，默认订阅 *，仍可通过订阅消息切换逻辑通道。
    server.on('connection', function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = ip + port;
      logger.info('%s is connected', clientName);
      wsSubscriptions.registerClient(ws, {
        channels: [WILDCARD_CHANNEL],
        clientId: clientName,
        scope: 'main',
      });

      attachHeartbeat(ws, { clientName, logger, intervalMs: 30000 });

      publishSystemEvent(createSensorStatusPayload(ctx, {
        port: ctx.serialport,
      }));

      const storedLicenseKey = typeof getStoredLicenseKey === 'function'
        ? getStoredLicenseKey()
        : '';
      if (storedLicenseKey) {
        sendPrivateSystemEvent(ws, { licenseKey: storedLicenseKey }, logger);
      }

      if (ctx.endDate && ctx.endDate > 0) {
        publishSystemEvent(createSensorStatusPayload(ctx, {
          date: ctx.endDate,
          nowDate: ctx.nowDate,
        }));
      } else {
        publishSystemEvent({ licenseError: '未检测到有效密钥，请输入密钥后使用', noLicense: true });
      }

      ws.on('message', function incoming(message) {
        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;

        const commandResult = controlCommandService.executeWs(getMessage, {
          client: ws,
          clientName,
          scope: resolveCommandScope(wsSubscriptions, ws),
        });
        sendCommandResultAck(ws, getMessage, commandResult, logger);
        // 这一行目前是空操作 —— 后面没有别的处理了，return 与自然结束等价。
        // 留着是因为它标出了 `stop` 的语义（「到此为止，别再往下发」）：
        // 以后在这里追加处理逻辑时，必须写在这一行**之后**，否则被拒的命令
        // （例如新协议走了 WebSocket，见 controlCommandService.executeWs）会继续被处理。
        if (commandResult.stop) return;
      });
    });
  };
}

module.exports = {
  createSensorStatusPayload,
  createWebSocketHandlerAttacher,
  resolveCommandScope,
};
