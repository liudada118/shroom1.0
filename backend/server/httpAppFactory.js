const express = require('express');
const cors = require('cors');
const {
  HTTP_ROUTES,
  buildSdkContractSnapshot,
} = require('../contracts/sdkApiContract');
const { registerControlRoutes } = require('../http/controlRoutes');
const { registerReportRoutes } = require('../http/reportRoutes');
const { loadSerialProtocolPresets } = require('../serial/protocols');

/**
 * 取串口协议预设的摘要，塞进 SDK contract。
 *
 * 只给 id/label/summary/doc，不给完整 protocol 段 —— contract 是能力快照不是数据源，
 * 完整字节配置走 `GET /api/serial/protocols`。这里读文件失败也不能让 contract 挂掉，
 * 所以整段兜底成空数组。
 *
 * @param {string[]} extraDirectories 用户自定义预设目录。
 * @returns {Array<{id: string, label: string, summary: string, doc: string}>} 预设摘要。
 */
function listSerialProtocolPresetSummaries(extraDirectories) {
  try {
    return loadSerialProtocolPresets({ extraDirectories }).presets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      summary: preset.summary,
      doc: preset.doc,
    }));
  } catch (error) {
    return [];
  }
}

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
  // 用户自定义串口协议预设目录。打包之后用户往这里丢 JSON 就能加协议，不用重新构建。
  serialProtocolDirectories = [],
  reloadDisplaySystems = () => ({}),
  saveDisplaySystem = () => null,
  saveDisplaySystemDisplaySection = () => null,
  duplicateDisplaySystem = () => null,
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
      protocolPresets: listSerialProtocolPresetSummaries(serialProtocolDirectories),
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

  /**
   * 展示系统写接口的统一错误映射。
   *
   * 只读被拒是 403 而不是 400 —— 请求本身没问题，是目标不许写。前端要靠这个
   * 区别决定提示语（「这是自带展示系统，请用另存为」而不是「参数有误」）。
   */
  function respondDisplaySystemWriteError(res, error) {
    const status = error.code === 'DISPLAY_SYSTEM_EXISTS' ? 409
      : error.code === 'DISPLAY_SYSTEM_READ_ONLY' ? 403
        : 400;
    res.status(status).json({
      error: error.message,
      code: error.code || 'DISPLAY_SYSTEM_INVALID',
      details: error.details || [],
    });
  }

  httpApp.post(HTTP_ROUTES.displaySystems, (req, res) => {
    try {
      const result = saveDisplaySystem(req.body);
      res.status(req.body?.overwrite ? 200 : 201).json({ result });
    } catch (error) {
      respondDisplaySystemWriteError(res, error);
    }
  });

  // 只写 manifest 的 display 段：主界面拖出来的画布 / 图表外观固化到基线。
  // 刻意不走 POST /api/display-systems —— 那条通路会按 Builder 的向导假设重写
  // schemaVersion / files / algorithm，拿一份 v3 多传感器 manifest 过一遍会改坏。
  httpApp.patch(HTTP_ROUTES.displaySystemDisplaySection, (req, res) => {
    try {
      const result = saveDisplaySystemDisplaySection(req.params.id, req.body);
      if (!result) {
        res.status(404).json({ error: 'display system not found', id: req.params.id });
        return;
      }
      res.json({ result });
    } catch (error) {
      respondDisplaySystemWriteError(res, error);
    }
  });

  // 整目录复制成一个新 id 的新模块。自带展示系统唯一的保存出路。
  httpApp.post(HTTP_ROUTES.displaySystemDuplicate, (req, res) => {
    try {
      const result = duplicateDisplaySystem(req.params.id, req.body);
      if (!result) {
        res.status(404).json({ error: 'display system not found', id: req.params.id });
        return;
      }
      res.status(201).json({ result });
    } catch (error) {
      respondDisplaySystemWriteError(res, error);
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
    serialProtocolDirectories,
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
