import { sensorCommands } from './commands.js';
import { toLegacyCommand } from './legacyCommands.js';
import { normalizeIncomingMessage } from '../store/normalizeFrame.js';

export const DEFAULT_HTTP_ROUTES = Object.freeze({
  channels: '/api/channels',
  wsStatus: '/api/ws/status',
  sdkContract: '/api/sdk/contract',
  serialPorts: '/api/serial/ports',
  serialStatus: '/api/serial/status',
  serialOpen: '/api/serial/open',
  serialClose: '/api/serial/close',
  serialExchange: '/api/serial/exchange',
  serialRefresh: '/api/serial/refresh',
  serialAutoConnectHandGloveDouble: '/api/serial/auto-connect-hand-glove-double',
  sensorCurrent: '/api/sensor/current',
  sensorType: '/api/sensor/type',
  historyLoad: '/api/history/load',
  playbackControl: '/api/playback/control',
  collectionStart: '/api/collection/start',
  collectionStop: '/api/collection/stop',
  exportCsv: '/api/export/csv',
});

/**
 * 根据 WebSocket 地址推导本地 HTTP 控制面地址。
 * 默认后端 HTTP 控制面监听 127.0.0.1:19245。
 */
function createHttpBaseUrl(wsUrl, explicitBaseUrl) {
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, '');
  try {
    const parsed = new URL(wsUrl);
    return `${parsed.protocol === 'wss:' ? 'https:' : 'http:'}//${parsed.hostname}:19245`;
  } catch {
    return 'http://127.0.0.1:19245';
  }
}

export class SensorClient {
  constructor({
    url = 'ws://127.0.0.1:19999',
    httpBaseUrl,
    WebSocketImpl = globalThis.WebSocket,
    fetchImpl = globalThis.fetch,
    legacyProtocol = false,
    channels = [],
    apiContract = null,
    routes = {},
  } = {}) {
    this.url = url;
    this.httpBaseUrl = createHttpBaseUrl(url, httpBaseUrl);
    this.WebSocketImpl = WebSocketImpl;
    this.fetchImpl = fetchImpl;
    this.legacyProtocol = legacyProtocol;
    this.channels = channels;
    this.apiContract = apiContract;
    this.routes = {
      ...DEFAULT_HTTP_ROUTES,
      ...(apiContract?.http?.routes || {}),
      ...routes,
    };
    this.ws = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  getRoute(name) {
    const route = this.routes[name] || DEFAULT_HTTP_ROUTES[name];
    if (!route) throw new Error(`unknown HTTP route "${name}"`);
    return route;
  }

  getWsMessageType(name, fallback) {
    return this.apiContract?.websocket?.messageTypes?.[name] || fallback;
  }

  connect() {
    if (!this.WebSocketImpl) {
      throw new Error('WebSocket implementation is not available');
    }
    if (this.ws && [this.WebSocketImpl.OPEN, this.WebSocketImpl.CONNECTING].includes(this.ws.readyState)) {
      return this.ws;
    }

    this.ws = new this.WebSocketImpl(this.url);
    this.ws.onopen = (event) => {
      this.isConnected = true;
      if (this.channels.length) {
        this.subscribe(this.channels);
      }
      this.emit('open', event);
    };
    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.emit('close', event);
    };
    this.ws.onerror = (event) => {
      this.emit('error', event);
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    return this.ws;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(messageOrType, payload = {}) {
    const message = typeof messageOrType === 'string'
      ? { type: messageOrType, payload }
      : messageOrType;

    if (!this.ws || this.ws.readyState !== this.WebSocketImpl.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(this.legacyProtocol ? toLegacyCommand(message) : message));
  }

  command(name, payload) {
    const commandFactory = sensorCommands[name];
    if (!commandFactory) {
      throw new Error(`unknown command "${name}"`);
    }
    this.send(commandFactory(payload));
  }

  /**
   * 调用后端 HTTP 控制 API。
   *
   * SDK 约定：
   * - 控制命令走 HTTP，例如开关串口、切换传感器、导出 CSV。
   * - 实时数据继续走 WebSocket subscribe/unsubscribe。
   */
  async request(path, { method = 'GET', body } = {}) {
    const payload = await this.requestRaw(path, { method, body });
    if (payload.code !== 0) {
      throw new Error(payload.message || 'request failed');
    }
    return payload.data;
  }

  /**
   * 读取非 HttpResult 包装的后端响应。
   * `/api/sdk/contract` 直接返回契约对象，因此需要使用原始请求。
   */
  async requestRaw(path, { method = 'GET', body } = {}) {
    if (!this.fetchImpl) {
      throw new Error('fetch implementation is not available');
    }

    const response = await this.fetchImpl(`${this.httpBaseUrl}${path}`, {
      method,
      headers: body == null ? undefined : { 'content-type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || `HTTP ${response.status}`);
    }
    return payload;
  }

  /**
   * 从后端读取 SDK/API 契约。
   * 读取后会同步更新客户端路由表，避免 SDK 长期硬编码后端路径。
   */
  async getContract({ refresh = false } = {}) {
    if (this.apiContract && !refresh) return this.apiContract;
    const contract = await this.requestRaw(this.getRoute('sdkContract'));
    this.apiContract = contract;
    this.routes = {
      ...DEFAULT_HTTP_ROUTES,
      ...(contract?.http?.routes || {}),
    };
    return contract;
  }

  /**
   * 串口控制 API。
   * 这些方法不需要 WebSocket 已连接，适合 SDK、测试脚本和第三方系统调用。
   */
  serial = {
    ports: () => this.request(this.getRoute('serialPorts')),
    status: (role) => this.request(role ? `${this.getRoute('serialStatus')}?role=${encodeURIComponent(role)}` : this.getRoute('serialStatus')),
    open: ({ role = 'sit', port, path, portPath } = {}) => this.request(this.getRoute('serialOpen'), {
      method: 'POST',
      body: { role, port: port || path || portPath },
    }),
    close: ({ role = 'sit' } = {}) => this.request(this.getRoute('serialClose'), {
      method: 'POST',
      body: { role },
    }),
    refresh: () => this.request(this.getRoute('serialRefresh'), { method: 'POST', body: {} }),
    exchange: () => this.request(this.getRoute('serialExchange'), { method: 'POST', body: {} }),
    autoConnectHandGloveDouble: () => this.request(this.getRoute('serialAutoConnectHandGloveDouble'), { method: 'POST', body: {} }),
  };

  /**
   * 传感器类型控制和当前状态查询。
   */
  sensor = {
    current: () => this.request(this.getRoute('sensorCurrent')),
    setType: (type) => this.request(this.getRoute('sensorType'), {
      method: 'POST',
      body: { type },
    }),
  };

  /**
   * 历史数据控制。load 会让后端进入对应日期的本地回放状态。
   */
  history = {
    load: (date) => this.request(this.getRoute('historyLoad'), {
      method: 'POST',
      body: { date },
    }),
  };

  /**
   * 回放控制，例如播放/暂停、速度、索引跳转。
   */
  playback = {
    control: (options = {}) => this.request(this.getRoute('playbackControl'), {
      method: 'POST',
      body: options,
    }),
  };

  /**
   * 采集控制。start/stop 通过 HTTP 修改后端采集状态。
   */
  collection = {
    start: (options = {}) => this.request(this.getRoute('collectionStart'), {
      method: 'POST',
      body: options,
    }),
    stop: () => this.request(this.getRoute('collectionStop'), {
      method: 'POST',
      body: {},
    }),
  };

  /**
   * 导出控制。目前支持 CSV 导出。
   */
  export = {
    csv: ({ date, downloadOptions, options } = {}) => this.request(this.getRoute('exportCsv'), {
      method: 'POST',
      body: { date, downloadOptions: downloadOptions || options || {} },
    }),
  };

  /**
   * 实时数据订阅仍然走 WebSocket。
   */
  subscribe(channels) {
    this.send({
      type: this.getWsMessageType('SUBSCRIBE', 'subscribe'),
      channels: Array.isArray(channels) ? channels : [channels],
    });
  }

  unsubscribe(channels) {
    this.send({
      type: this.getWsMessageType('UNSUBSCRIBE', 'unsubscribe'),
      channels: Array.isArray(channels) ? channels : [channels],
    });
  }

  handleMessage(rawMessage) {
    let parsed;
    try {
      parsed = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    } catch (error) {
      this.emit('error', error);
      return;
    }

    const normalized = normalizeIncomingMessage(parsed);
    this.emit('message', normalized);

    normalized.frames.forEach((frame) => {
      this.emit('frame', frame);
      this.emit(`frame:${frame.sensorType}`, frame);
      this.emit(`frame:${frame.sensorType}:${frame.channel}`, frame);
    });

    if (normalized.type) {
      this.emit(normalized.type, normalized.payload);
    }
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, payload) {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
  }
}
