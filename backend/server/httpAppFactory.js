const express = require('express');
const cors = require('cors');
const { registerControlRoutes } = require('../http/controlRoutes');
const { registerReportRoutes } = require('../http/reportRoutes');

/**
 * 创建 HTTP 应用并挂载控制接口、通道状态接口和报表接口。
 * server.js 只负责传入运行时依赖，HTTP 路由定义集中在这里。
 */
function createHttpApp({
  controlCommandService,
  getChannelBusStatus,
  getPort,
  getRealtimeChannels,
  getSerialStatus,
  getSitDb,
  getWsSubscriptionStatus,
  imgPath,
  listPorts,
  logger,
  pdfPath,
  serialManager,
}) {
  const httpApp = express();
  httpApp.use(cors());
  httpApp.use(express.json({ limit: '50mb' }));
  httpApp.use(express.urlencoded({ limit: '50mb', extended: true }));

  httpApp.get('/api/channels', (req, res) => {
    res.json({
      channels: getRealtimeChannels(),
      subscriptions: getWsSubscriptionStatus(),
    });
  });

  httpApp.get('/api/ws/status', (req, res) => {
    res.json({
      channels: getRealtimeChannels(),
      channelBus: getChannelBusStatus(),
      serial: getSerialStatus(),
      subscriptions: getWsSubscriptionStatus(),
    });
  });

  registerControlRoutes(httpApp, {
    controlCommandService,
    getPort,
    getRealtimeChannels,
    listPorts,
    logger,
    serialManager,
  });

  registerReportRoutes(httpApp, {
    getSitDb,
    imgPath,
    logger,
    pdfPath,
  });

  return httpApp;
}

module.exports = {
  createHttpApp,
};
