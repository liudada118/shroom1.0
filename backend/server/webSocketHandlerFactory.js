const { createWebSocketHistoryCommandService } = require('../services/websocket/webSocketHistoryCommandService');

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
      server1,
      server2,
      totalToN,
      wsSubscriptions,
      zeroCommandService,
    } = ctx;

    if (ctx.serverOpened) {
      logger.info('[Server] openServer skipped: listeners already attached');
      return;
    }

    const historyCommandService = createWebSocketHistoryCommandService({
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
      zeroCommandService,
    });

    ctx.serverOpened = true;
    ctx.serverShutdownRequested = false;

    server1.on('open', function open() {
      logger.info('connected');
    });

    server1.on('close', function close() {
      logger.info('disconnected');
    });

    // 头枕端口只负责 head 实时数据订阅，控制命令统一走主端口或 HTTP。
    server2.on('connection', function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = `${ip}${port}`;
      logger.info('%s is connected to head channel', clientName);
      wsSubscriptions.registerClient(ws, {
        channels: ['head'],
        clientId: clientName,
        scope: 'head',
      });
    });

    // 靠背端口保留少量旧命令兼容，同时默认订阅 back 通道。
    server1.on('connection', function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = `${ip}${port}`;
      wsSubscriptions.registerClient(ws, {
        channels: ['back'],
        clientId: clientName,
        scope: 'back',
      });
      ws.on('message', function incoming(message) {
        logger.debug('received: %s from %s', message, clientName, ctx.localFlag);

        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;
        controlCommandService.executeWs(getMessage, { clientName, scope: 'back' });
      });
    });

    server.on('open', function open() {
      logger.info('connected');
    });

    server.on('close', function close() {
      logger.info('disconnected');
    });

    // 涓荤鍙ｈ礋璐ｆ棫鍓嶇杩炴帴銆佹巿鏉冪姸鎬佷笅鍙戙€佸巻鍙插洖鏀炬帶鍒跺拰瀹炴椂鍧愰潰璁㈤槄銆?
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

      publishSystemEvent({
        port: ctx.serialport,
        file: ctx.licenseFile || ctx.file,
        selectFlag: ctx.selectFlag,
      });

      const storedLicenseKey = typeof getStoredLicenseKey === 'function'
        ? getStoredLicenseKey()
        : '';
      if (storedLicenseKey) {
        sendPrivateSystemEvent(ws, { licenseKey: storedLicenseKey }, logger);
      }

      if (ctx.endDate && ctx.endDate > 0) {
        publishSystemEvent({
          date: ctx.endDate,
          nowDate: ctx.nowDate,
          file: ctx.licenseFile || ctx.file,
          selectFlag: ctx.selectFlag,
        });
      } else {
        publishSystemEvent({ licenseError: '未检测到有效密钥，请输入密钥后使用', noLicense: true });
      }

      ws.on('message', function incoming(message) {
        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;

        const commandResult = controlCommandService.executeWs(getMessage, { clientName, scope: 'main' });
        if (commandResult.stop) return;

        if (getMessage.date != null) {
          const content = getMessage.date.date;
          const activation = activateSubmittedLicenseKey(content);
          if (!activation.ok) {
            logger.warn('[License] License activation failed:', activation.code);
            publishSystemEvent({ licenseError: activation.message });
            return;
          }

          publishSystemEvent(activation.payload);
        }

        historyCommandService.handle(getMessage, { clientName });
      });
    });
  };
}

module.exports = {
  createWebSocketHandlerAttacher,
};
