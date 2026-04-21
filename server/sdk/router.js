const express = require("express");

const { SDK_TOKEN_ENV, configuredSdkToken, sdkAuthMiddleware } = require("./auth");

function ok(data = {}, message = "ok") {
  return {
    code: 0,
    message,
    data,
  };
}

function fail(message, code = 1, data = {}) {
  return {
    code,
    message,
    data,
  };
}

function createSdkRouter(handlers) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json(ok({
      name: "Shroom Runtime API",
      version: "v1",
      tokenRequired: Boolean(configuredSdkToken()),
      tokenEnvVar: SDK_TOKEN_ENV,
      endpoints: {
        health: "GET /api/v1/health",
        status: "GET /api/v1/status",
        ports: "GET /api/v1/ports",
        refreshPorts: "POST /api/v1/ports/refresh",
        license: "GET /api/v1/license",
        collectStatus: "GET /api/v1/collect/status",
        collectStart: "POST /api/v1/collect/start",
        collectStop: "POST /api/v1/collect/stop",
        probeDevice: "POST /api/v1/device/probe",
        connectDevice: "POST /api/v1/device/connect",
        disconnectDevice: "POST /api/v1/device/disconnect",
        events: "WS /api/v1/events",
      },
    }));
  });

  router.use(sdkAuthMiddleware);

  router.get("/health", (_req, res) => {
    res.json(ok(handlers.getHealth()));
  });

  router.get("/status", (_req, res) => {
    res.json(ok(handlers.getStatus()));
  });

  router.get("/ports", (_req, res) => {
    res.json(ok({
      ports: handlers.listPorts(),
    }));
  });

  router.post("/ports/refresh", async (_req, res) => {
    try {
      const ports = await handlers.refreshPorts();
      res.json(ok({ ports }, "ports refreshed"));
    } catch (error) {
      res.status(500).json(fail(error.message, 500));
    }
  });

  router.get("/license", (_req, res) => {
    res.json(ok(handlers.getLicenseStatus()));
  });

  router.get("/collect/status", (_req, res) => {
    res.json(ok(handlers.getCollectStatus()));
  });

  router.post("/collect/start", async (req, res) => {
    try {
      const status = await handlers.startCollect(req.body || {});
      res.json(ok(status, "collection started"));
    } catch (error) {
      res.status(400).json(fail(error.message, 400));
    }
  });

  router.post("/collect/stop", async (req, res) => {
    try {
      const status = await handlers.stopCollect(req.body || {});
      res.json(ok(status, "collection stopped"));
    } catch (error) {
      res.status(400).json(fail(error.message, 400));
    }
  });

  router.post("/device/probe", async (req, res) => {
    try {
      const result = await handlers.probeDevice(req.body || {});
      res.json(ok(result, "device probe completed"));
    } catch (error) {
      res.status(400).json(fail(error.message, 400));
    }
  });

  router.post("/device/connect", async (req, res) => {
    try {
      const status = await handlers.connectDevice(req.body || {});
      res.json(ok(status, "device connect requested"));
    } catch (error) {
      res.status(400).json(fail(error.message, 400));
    }
  });

  router.post("/device/disconnect", async (req, res) => {
    try {
      const status = await handlers.disconnectDevice(req.body || {});
      res.json(ok(status, "device disconnect requested"));
    } catch (error) {
      res.status(400).json(fail(error.message, 400));
    }
  });

  return router;
}

module.exports = {
  createSdkRouter,
};
