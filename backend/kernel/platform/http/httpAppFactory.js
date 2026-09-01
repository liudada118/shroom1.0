const express = require('express');
const cors = require('cors');
const {
  HTTP_ROUTES,
  buildSdkContractSnapshot,
} = require('@shroom/backend/contract/sdkApiContract.js');
const { registerControlRoutes } = require('./controlRoutes');
const { registerReportRoutes } = require('./reportRoutes');
const HttpResult = require('./HttpResult');
const { loadSerialProtocolPresets } = require('@shroom/backend/protocol/presets/index.js');
const { createSerialProtocolProbeService } = require('../../serial/serialProtocolProbeService');

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

/**
 * 造一个 Express 错误中间件，把 body 解析失败翻译成有意义的状态码。
 *
 * 没有它，一条 JSON 格式错的请求会走 Express 默认错误处理回 500 带 HTML 堆栈页 —— 前端看到「服务器
 * 内部错误」，真实原因是它自己的报文有问题。认两种错：`entity.parse.failed` → 400，`entity.too.large`
 * → 413（`express.json({limit: '50mb'})`，50mb 是为整段历史热力图留的，真触发基本意味着发错了东西）。
 * 不认识的 `error.type` 走 `next(error)` 而不是伪装成 400。
 *
 * ⚠️ **必须保留四个参数，`next` 看着没用也不能删**：Express 按函数 arity 判断错误中间件
 * （`fn.length === 4`），删成三参数它会被当普通中间件注册、**永远不被调用**，且无任何报错或告警。
 *
 * ⚠️ **注册位置必须在两个 body parser 之后**（见 `createHttpApp` 的 `use` 顺序）—— Express 的错误
 * 传播只往注册顺序的后面走，装前面就看不到 parser 抛的错。
 *
 * ⚠️ 这里回的是 `{error: '...'}` 而**不是** `HttpResult`（没有 `code` 字段），与其余 20 个接口不一致。
 * 前端 `res.data?.code !== 0` 恰好也判成失败，所以现象上无问题 —— 但那是巧合。统一属公共 API 响应体
 * 变更，未动。
 *
 * @param {object} logger 日志对象；用可选链调用，缺失也不会炸。
 * @returns {Function} 四参数的 Express 错误中间件。
 */
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

function createUnavailableAgentAppService() {
  const unavailable = () => {
    const error = new Error('agent app service is unavailable');
    error.code = 'AGENT_APP_SERVICE_UNAVAILABLE';
    error.httpStatus = 503;
    throw error;
  };
  return {
    getStatus: () => ({ apps: [], errors: [] }),
    install: unavailable,
    readPolicy: () => {
      const error = new Error('agent app policy is not available');
      error.code = 'AGENT_APP_POLICY_NOT_FOUND';
      error.httpStatus = 404;
      throw error;
    },
    reload: unavailable,
    resolveStaticFile: unavailable,
  };
}

/**
 * Agent App 安装会把用户提供的文件写进 userData。浏览器请求若带 Origin，只接受本机
 * loopback 页面；无 Origin 的本地 CLI/Agent 调用继续允许。这样全局历史 CORS 配置不会让
 * 任意公网网页借用户浏览器向 localhost 静默安装渲染包。
 */
function assertAgentAppWriteOrigin(req) {
  const rawOrigin = String(req.get('origin') || '').trim();
  if (!rawOrigin) return;
  try {
    const origin = new URL(rawOrigin);
    const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(origin.hostname);
    if (['http:', 'https:'].includes(origin.protocol) && loopback) return;
  } catch {
    // 统一走下面的稳定错误；不能把 URL 解析细节暴露成 500。
  }
  const error = new Error('agent app writes are allowed only from a local client');
  error.code = 'AGENT_APP_ORIGIN_FORBIDDEN';
  error.httpStatus = 403;
  throw error;
}

function buildAgentAppContentSecurityPolicy(req, appId) {
  const rawHost = String(req.get('host') || '127.0.0.1');
  const host = /^[A-Za-z0-9.:[\]-]+$/.test(rawHost) ? rawHost : '127.0.0.1';
  const scheme = req.protocol === 'https' ? 'https' : 'http';
  const fileSource = `${scheme}://${host}${HTTP_ROUTES.agentApps}/${encodeURIComponent(appId)}/files/`;
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "navigate-to 'none'",
    // 主前端与 API 使用不同 loopback 端口；只允许本机前端承载 sandbox iframe。
    'frame-ancestors http://127.0.0.1:* http://localhost:*',
    "frame-src 'none'",
    "object-src 'none'",
    `script-src ${fileSource}`,
    `style-src ${fileSource} 'unsafe-inline'`,
    `img-src ${fileSource} data: blob:`,
    `font-src ${fileSource} data:`,
    `media-src ${fileSource} blob:`,
    `connect-src ${fileSource}`,
    `worker-src ${fileSource} blob:`,
  ].join('; ');
}

/**
 * 创建 HTTP 应用并挂载控制接口、通道状态接口和报表接口。
 * server.js 只负责传入运行时依赖，HTTP 路由定义集中在这里。
 */
function createHttpApp({
  agentAppService,
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
  serialProtocolProbeService,
  reloadDisplaySystems = () => ({}),
  saveDisplaySystem = () => null,
  saveDisplaySystemDisplaySection = () => null,
  duplicateDisplaySystem = () => null,
}) {
  const agentApps = agentAppService || createUnavailableAgentAppService();
  const protocolProbeService = serialProtocolProbeService || createSerialProtocolProbeService({
    serialManager,
    serialProtocolDirectories,
    logger,
  });
  const httpApp = express();
  httpApp.use(cors());
  httpApp.use(express.json({ limit: '50mb' }));
  httpApp.use(express.urlencoded({ limit: '50mb', extended: true }));
  httpApp.use(createJsonBodyErrorHandler(logger));

  function respondAgentAppError(res, error) {
    const status = Number(error.httpStatus) || 500;
    const result = new HttpResult(1, {}, error.message || 'agent app request failed');
    result.errorCode = error.code || 'AGENT_APP_REQUEST_FAILED';
    res.status(status).json(result);
  }

  httpApp.get(HTTP_ROUTES.agentApps, (req, res) => {
    try {
      res.json(new HttpResult(0, agentApps.getStatus(), 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] list agent apps failed', error.message || error);
      respondAgentAppError(res, error);
    }
  });

  httpApp.post(HTTP_ROUTES.agentApps, (req, res) => {
    try {
      assertAgentAppWriteOrigin(req);
      const result = agentApps.install(req.body || {});
      res.status(req.body?.overwrite === true ? 200 : 201).json(new HttpResult(0, result, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] install agent app failed', error.message || error);
      respondAgentAppError(res, error);
    }
  });

  httpApp.post(HTTP_ROUTES.agentAppReload, (req, res) => {
    try {
      assertAgentAppWriteOrigin(req);
      res.json(new HttpResult(0, agentApps.reload(), 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] reload agent apps failed', error.message || error);
      respondAgentAppError(res, error);
    }
  });

  httpApp.get(HTTP_ROUTES.agentAppPolicy, (req, res) => {
    try {
      res.json(new HttpResult(0, { policy: agentApps.readPolicy() }, 'success'));
    } catch (error) {
      logger?.warn?.('[HTTP] read agent app policy failed', error.message || error);
      respondAgentAppError(res, error);
    }
  });

  // Express 5 的通配符必须命名；filePath 在多段路径时是数组。
  httpApp.get(`${HTTP_ROUTES.agentApps}/:id/files/*filePath`, (req, res) => {
    try {
      const requestedPath = Array.isArray(req.params.filePath)
        ? req.params.filePath.join('/')
        : req.params.filePath;
      const filePath = agentApps.resolveStaticFile(req.params.id, requestedPath);
      res.set({
        'Content-Security-Policy': buildAgentAppContentSecurityPolicy(req, req.params.id),
        // sandbox iframe 不带 allow-same-origin，document origin 会变成 opaque；
        // 这里必须允许同包外部 JS/CSS/GLB 被取到，访问边界由精确 path CSP 与服务端路径校验承担。
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), serial=(), usb=(), bluetooth=(), payment=()',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      res.type(filePath);
      res.sendFile(filePath);
    } catch (error) {
      logger?.warn?.('[HTTP] read agent app file failed', error.message || error);
      respondAgentAppError(res, error);
    }
  });

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
    serialProtocolProbeService: protocolProbeService,
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
  assertAgentAppWriteOrigin,
  buildAgentAppContentSecurityPolicy,
  createHttpApp,
  createJsonBodyErrorHandler,
};
