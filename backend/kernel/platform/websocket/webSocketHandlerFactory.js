const { createHistoryAnalysisService } = require('../../playback/historyAnalysisService');

const { createCommandAck } = require('@shroom/backend/contract/commandProtocol.js');

/**
 * WebSocket 杩炴帴澶勭悊鎸傝浇鍣ㄣ€? *
 * 璇ユā鍧楀彧璐熻矗涓夌鍙?WebSocket 杩炴帴銆佽闃呮敞鍐屻€佸績璺冲拰鏃ф秷鎭叆鍙ｅ垎鍙戙€? * 鎺堟潈婵€娲荤敱 server.js 娉ㄥ叆鐨勮涔夊叆鍙ｅ鐞嗭紝鍘嗗彶/妗嗛€?鍥炴斁鍛戒护涓嬫矇鍒?service銆? */

/**
 * 鍚戝綋鍓嶈繛鎺ュ崟鐙彂閫佺郴缁熶簨浠躲€? *
 * 鎺堟潈瀵嗛挜灞炰簬鏁忔劅鏁版嵁锛屽彧鐢ㄤ簬鎺堟潈闂ㄦ埛鍥炲～锛屼笉鑳借窡鏅€氱郴缁熺姸鎬佷竴鏍峰叏灞€骞挎挱銆? *
 * @param {WebSocket} ws 褰撳墠杩炴帴銆? * @param {object} data 瑕佸彂閫佺粰褰撳墠杩炴帴鐨勬暟鎹€? * @param {object} logger 鏃ュ織瀵硅薄銆? */
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
 * **没有 `requestId` 或 `type` 就直接不发。** 这是新旧协议的分界：旧字段命令
 * （`{variety: 1}`、`{sitIndex: [...]}` 这类）本来就没有 requestId，也没有能对上号的
 * 回执概念，老前端不等这条消息。发一条无法关联的回执只会让老前端多收一条不认识的消息。
 *
 * 走 `sendPrivateSystemEvent` 而不是 `publishSystemEvent`：回执属于**某一个请求**，
 * 广播出去会让其他客户端收到别人的命令结果 —— 既是噪音，也可能泄露别人在操作什么。
 *
 * 错误取值分两处，**顺序有意义**：先看整体 `result.error`（归一/校验层面的失败），
 * 再看 `result.results` 里第一个带 error 的条目（某个 handler 自己失败了）。
 * 一条命令可能被多个 handler 接，只要有一个失败就整体回失败 —— 这是保守方向，
 * 前端看到 ok 就当作「全都成功了」。
 *
 * `ok` 要求 **`handled === true`**，所以「没有任何 handler 接这条命令」会回 rejected
 * 而不是 accepted。这一条很重要：否则前端发一个拼错的命令名会得到成功回执，
 * 然后一直等一个永远不会来的状态变化。
 *
 * 成功时才带 `data`（`handlers` 名单 + 各自结果），失败时传 `undefined` ——
 * `createCommandAck` 对 undefined 的 data 是**整个字段省略**而不是发 `data: null`，
 * 所以前端可以用 `'data' in ack` 判断。
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
 * 分两步（工厂 + 返回的函数）而不是一步做完，是因为**挂监听器的时机比构造时机晚**：
 * server.js 构造上下文时数据库、串口、授权都还没就绪，而 `connection` 回调一旦挂上就
 * 可能立刻有客户端连进来。分开之后 server.js 可以先把上下文拼好，等一切 ready 再调。
 *
 * ⚠️ **只有稳定依赖可以解构，运行态字段必须写 `ctx.xxx` 现读。**
 * 下面那一大段解构（`logger`、`server`、各种纯函数……）取的都是不会变的东西。
 * 而 `ctx.serialport`、`ctx.file`、`ctx.endDate`、`ctx.nowDate`、`ctx.selectFlag`
 * 在代码里**一律直接写 `ctx.` 前缀**，不在解构列表里 —— 因为 `ctx` 上这些字段是
 * `legacyWebSocketContext` 用 getter 定义的，解构等于在挂载那一刻拍快照，
 * 之后串口列表变了、型号切了，连进来的客户端会收到过期值。
 * 这是本文件最容易被二开踩坏的一条：把 `ctx.file` 加进解构列表不会报任何错，
 * 只会让「切换传感器型号」从此对新连接失效。
 *
 * `ctx.serverOpened` 是**幂等保护**。重复挂载不会报错，但每条消息会被处理两次
 * （命令执行两遍、回执发两条），这种问题排查起来极其费劲，所以这里直接挡掉并记一条日志。
 *
 * `runtime: ctx` 把整个上下文当运行态交给了 `historyAnalysisService` ——
 * 那个模块会**直接写** `runtime.nowIndex` 这类字段（见它的文件头说明），
 * 写进去的值通过 ctx 的 setter 落到 store 里。这是旧逻辑搬迁时保留的写法。
 *
 * 四个 handler 在这里注册而不是在 server.js：它们都依赖 ctx 上的运行态或
 * 本文件的私有函数（`createSensorStatusPayload`），注册顺序不影响行为 ——
 * `controlCommandRouter` 是按 `when` 谓词匹配的，不是按注册顺序短路。
 *
 * 新连接建立时**主动推三到四条消息**（传感器状态、私发授权密钥、授权期限或未授权提示），
 * 而不是等前端来问。因为前端刚连上时界面是空的，等一个轮询周期会先闪一下空状态。
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
