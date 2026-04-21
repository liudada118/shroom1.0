const { URL } = require("url");

const SDK_TOKEN_ENV = "SHROOM_SDK_TOKEN";

function configuredSdkToken() {
  const token = process.env[SDK_TOKEN_ENV];
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function extractTokenFromHeaders(headers = {}) {
  const authHeader = headers.authorization || headers.Authorization;
  if (typeof authHeader === "string") {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return bearerMatch[1].trim();
    }
  }

  const headerToken = headers["x-shroom-token"] || headers["X-Shroom-Token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  return null;
}

function extractTokenFromRequest(req) {
  if (!req) return null;

  const headerToken = extractTokenFromHeaders(req.headers);
  if (headerToken) {
    return headerToken;
  }

  if (req.query && typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
}

function evaluateSdkAuthorization(req) {
  const expectedToken = configuredSdkToken();
  if (!expectedToken) {
    return { ok: true, tokenRequired: false };
  }

  const actualToken = extractTokenFromRequest(req);
  return {
    ok: actualToken === expectedToken,
    tokenRequired: true,
  };
}

function sdkAuthMiddleware(req, res, next) {
  const auth = evaluateSdkAuthorization(req);
  if (auth.ok) {
    next();
    return;
  }

  res.status(401).json({
    code: 401,
    message: "Unauthorized",
    data: {
      tokenRequired: true,
      envVar: SDK_TOKEN_ENV,
    },
  });
}

function getUpgradePath(requestUrl) {
  try {
    return new URL(requestUrl, "http://127.0.0.1").pathname;
  } catch {
    return "";
  }
}

module.exports = {
  SDK_TOKEN_ENV,
  configuredSdkToken,
  evaluateSdkAuthorization,
  getUpgradePath,
  sdkAuthMiddleware,
};
