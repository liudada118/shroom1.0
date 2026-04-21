const DefaultWebSocket = typeof WebSocket !== "undefined" ? WebSocket : require("ws");
const defaultFetch = typeof fetch === "function" ? fetch.bind(globalThis) : null;

function attachSocketListener(socket, eventName, handler) {
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(eventName, handler);
    return;
  }

  if (typeof socket.on === "function") {
    socket.on(eventName, (...args) => {
      if (eventName === "message") {
        const [data] = args;
        handler({
          data: typeof data === "string" ? data : data.toString("utf8"),
        });
        return;
      }

      handler(...args);
    });
  }
}

class ShroomEvents {
  constructor({ baseUrl, token, websocketFactory } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.websocketFactory = websocketFactory || ((url) => new DefaultWebSocket(url));
    this.listeners = new Map();
    this.socket = null;
  }

  connect() {
    if (this.socket) {
      return this.socket;
    }

    const url = new URL("/api/v1/events", this.baseUrl.replace(/^http/i, "ws"));
    if (this.token) {
      url.searchParams.set("token", this.token);
    }

    this.socket = this.websocketFactory(url.toString());
    attachSocketListener(this.socket, "message", (event) => {
      const payload = JSON.parse(event.data);
      const handlers = this.listeners.get(payload.type) || [];
      for (const handler of handlers) {
        handler(payload.data, payload);
      }
    });

    attachSocketListener(this.socket, "close", () => {
      this.socket = null;
    });

    return this.socket;
  }

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    this.listeners.get(eventType).push(handler);
    this.connect();

    return () => {
      const handlers = this.listeners.get(eventType) || [];
      this.listeners.set(
        eventType,
        handlers.filter((item) => item !== handler)
      );
    };
  }

  onFrame(handler, { channel } = {}) {
    return this.on("collect.frame", (data, payload) => {
      if (channel && data.channel !== channel) {
        return;
      }

      handler(data, payload);
    });
  }
}

class ShroomClient {
  constructor({ baseUrl = "http://127.0.0.1:19245", token = "", fetchImpl = defaultFetch, websocketFactory } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.events = new ShroomEvents({ baseUrl, token, websocketFactory });
  }

  async request(path, { method = "GET", body } = {}) {
    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required in this runtime");
    }

    const headers = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok || payload.code !== 0) {
      throw new Error(payload.message || `Request failed: ${response.status}`);
    }

    return payload.data;
  }

  health() {
    return this.request("/api/v1/health");
  }

  status() {
    return this.request("/api/v1/status");
  }

  listPorts() {
    return this.request("/api/v1/ports");
  }

  refreshPorts() {
    return this.request("/api/v1/ports/refresh", { method: "POST" });
  }

  license() {
    return this.request("/api/v1/license");
  }

  collectStatus() {
    return this.request("/api/v1/collect/status");
  }

  startCollect(options = {}) {
    return this.request("/api/v1/collect/start", {
      method: "POST",
      body: options,
    });
  }

  stopCollect(options = {}) {
    return this.request("/api/v1/collect/stop", {
      method: "POST",
      body: options,
    });
  }

  probeDevice(options = {}) {
    return this.request("/api/v1/device/probe", {
      method: "POST",
      body: options,
    });
  }

  connectDevice(options) {
    return this.request("/api/v1/device/connect", {
      method: "POST",
      body: options,
    });
  }

  disconnectDevice(options = {}) {
    return this.request("/api/v1/device/disconnect", {
      method: "POST",
      body: options,
    });
  }
}

module.exports = {
  ShroomClient,
};
