const express = require('express');
const cors = require('cors');
const {
  HTTP_ROUTES,
  buildSdkContractSnapshot,
} = require('../contracts/sdkApiContract');
const { registerControlRoutes } = require('../http/controlRoutes');
const { registerReportRoutes } = require('../http/reportRoutes');

function createJsonBodyErrorHandler(logger) {
  return (error, req, res, next) => {
    if (!error) {
      next();
      return;
    }

    if (error.type === 'entity.parse.failed') {
      res.status(400).json({
        error: 'invalid json body',
      });
      return;
    }

    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: 'request body too large',
      });
      return;
    }

    logger?.error?.('[http] request body parse failed', error);
    next(error);
  };
}

/**
 * 创建 HTTP 应用并挂载控制接口、通道状态接口和报表接口。
 * server.js 只负责传入运行时依赖，HTTP 路由定义集中在这里。
 */
function createHttpApp({
  controlCommandService,
  getChannelBusStatus,
  getDisplaySystemById = () => null,
  getDisplaySystemBuilderCatalog = () => ({}),
  getDisplaySystemEditorById = () => null,
  getDisplaySystemStatus = () => ({ count: 0, systems: [] }),
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
  reloadDisplaySystems = () => ({}),
  saveDisplaySystem = () => null,
}) {
  const httpApp = express();
  httpApp.use(cors());
  httpApp.use(express.json({ limit: '50mb' }));
  httpApp.use(express.urlencoded({ limit: '50mb', extended: true }));
  httpApp.use(createJsonBodyErrorHandler(logger));

  httpApp.get(HTTP_ROUTES.channels, (req, res) => {
    res.json({
      channels: getRealtimeChannels(),
      subscriptions: getWsSubscriptionStatus(),
    });
  });

  httpApp.get(HTTP_ROUTES.wsStatus, (req, res) => {
    res.json({
      channels: getRealtimeChannels(),
      channelBus: getChannelBusStatus(),
      serial: getSerialStatus(),
      subscriptions: getWsSubscriptionStatus(),
    });
  });

  httpApp.get(HTTP_ROUTES.sdkContract, (req, res) => {
    res.json(buildSdkContractSnapshot({
      channels: getRealtimeChannels(),
      displaySystems: getDisplaySystemStatus(),
      serialStatus: getSerialStatus(),
      subscriptions: getWsSubscriptionStatus(),
    }));
  });

  httpApp.get(HTTP_ROUTES.displaySystems, (req, res) => {
    res.json({
      displaySystems: getDisplaySystemStatus(),
    });
  });

  httpApp.get(HTTP_ROUTES.displaySystemCatalog, (req, res) => {
    res.json({ catalog: getDisplaySystemBuilderCatalog() });
  });

  httpApp.post(HTTP_ROUTES.displaySystemReload, (req, res) => {
    res.json({ displaySystems: reloadDisplaySystems() });
  });

  httpApp.get(HTTP_ROUTES.displaySystemEditor, (req, res) => {
    const editor = getDisplaySystemEditorById(req.params.id);
    if (!editor) {
      res.status(404).json({ error: 'display system not found', id: req.params.id });
      return;
    }
    res.json({ editor });
  });

  httpApp.post(HTTP_ROUTES.displaySystems, (req, res) => {
    try {
      const result = saveDisplaySystem(req.body);
      res.status(req.body?.overwrite ? 200 : 201).json({ result });
    } catch (error) {
      res.status(error.code === 'DISPLAY_SYSTEM_EXISTS' ? 409 : 400).json({
        error: error.message,
        code: error.code || 'DISPLAY_SYSTEM_INVALID',
        details: error.details || [],
      });
    }
  });

  httpApp.get(`${HTTP_ROUTES.displaySystems}/:id`, (req, res) => {
    const displaySystem = getDisplaySystemById(req.params.id);
    if (!displaySystem) {
      res.status(404).json({
        error: 'display system not found',
        id: req.params.id,
      });
      return;
    }

    res.json({
      displaySystem,
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
  createJsonBodyErrorHandler,
};
