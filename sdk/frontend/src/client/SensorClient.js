import { sensorCommands } from './commands.js';
import { toLegacyCommand } from './legacyCommands.js';
import {
  SENSOR_FRAME_TYPE,
  isDeclaredSensorFrame,
  isSensorFrameEnvelope,
  normalizeIncomingMessage,
} from '../store/normalizeFrame.js';

export const DEFAULT_HTTP_ROUTES = Object.freeze({
  channels: '/api/channels',
  wsStatus: '/api/ws/status',
  sdkContract: '/api/sdk/contract',
  displaySystems: '/api/display-systems',
  displaySystemById: '/api/display-systems/:id',
  displaySystemCatalog: '/api/display-systems/catalog',
  displaySystemEditor: '/api/display-systems/:id/editor',
  displaySystemReload: '/api/display-systems/reload',
  commands: '/api/commands',
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

function normalizeIdentityPart(value) {
  return String(value ?? '').trim();
}

/**
 * 将订阅描述解析成 WebSocket 使用的 canonical channelId。
 *
 * - 已给出 channelId（字符串或对象）时原样保留；
 * - displaySystemId + sensorId/channel 组合为 `displaySystemId:sensorId`；
 * - 没有 displaySystemId 的 `sit/back/head` 继续原样发送，兼容旧服务端。
 */
export function resolveChannelId(channel, { displaySystemId } = {}) {
  if (channel == null) return null;

  if (typeof channel === 'object') {
    const explicitChannelId = normalizeIdentityPart(channel.channelId);
    if (explicitChannelId) return explicitChannelId;

    const resolvedDisplaySystemId = normalizeIdentityPart(
      channel.displaySystemId ?? displaySystemId,
    );
    const sensorId = normalizeIdentityPart(
      channel.sensorId ?? channel.channel ?? channel.portId,
    );
    if (!sensorId) return null;
    if (sensorId === '*' || sensorId.includes(':') || !resolvedDisplaySystemId) {
      return sensorId;
    }
    return `${resolvedDisplaySystemId}:${sensorId}`;
  }

  const channelId = normalizeIdentityPart(channel);
  const resolvedDisplaySystemId = normalizeIdentityPart(displaySystemId);
  if (!channelId) return null;
  if (channelId === '*' || channelId.includes(':') || !resolvedDisplaySystemId) {
    return channelId;
  }
  return `${resolvedDisplaySystemId}:${channelId}`;
}

export function normalizeSubscriptionChannels(channels, options = {}) {
  const candidates = Array.isArray(channels) ? channels : [channels];
  return [...new Set(
    candidates
      .map((channel) => resolveChannelId(channel, options))
      .filter(Boolean),
  )];
}

export class SensorClient {
  constructor({
    url = 'ws://127.0.0.1:19999',
    httpBaseUrl,
    WebSocketImpl = globalThis.WebSocket,
    fetchImpl = globalThis.fetch,
    legacyProtocol = false,
    displaySystemId,
    channels = [],
    apiContract = null,
    routes = {},
  } = {}) {
    this.url = url;
    this.httpBaseUrl = createHttpBaseUrl(url, httpBaseUrl);
    this.WebSocketImpl = WebSocketImpl;
    this.fetchImpl = fetchImpl;
    this.legacyProtocol = legacyProtocol;
    this.displaySystemId = normalizeIdentityPart(displaySystemId);
    this.channels = normalizeSubscriptionChannels(channels, {
      displaySystemId: this.displaySystemId,
    });
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

    if (message?.requestId && message?.payload) {
      throw new Error('control commands must use command() over HTTP');
    }

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
    return this.request(this.getRoute('commands'), {
      method: 'POST',
      body: commandFactory(payload),
    });
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

    const response = await Reflect.apply(this.fetchImpl, globalThis, [`${this.httpBaseUrl}${path}`, {
      method,
      headers: body == null ? undefined : { 'content-type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    }]);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
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

  displaySystems = {
    list: async () => {
      const payload = await this.requestRaw(this.getRoute('displaySystems'));
      return payload.displaySystems || payload;
    },
    detail: async (id) => {
      const route = this.getRoute('displaySystemById').replace(':id', encodeURIComponent(id));
      const payload = await this.requestRaw(route);
      return payload.displaySystem || payload;
    },
    catalog: async () => {
      const payload = await this.requestRaw(this.getRoute('displaySystemCatalog'));
      return payload.catalog || payload;
    },
    editor: async (id) => {
      const route = this.getRoute('displaySystemEditor').replace(':id', encodeURIComponent(id));
      const payload = await this.requestRaw(route);
      return payload.editor || payload;
    },
    save: async (input) => {
      const payload = await this.requestRaw(this.getRoute('displaySystems'), {
        method: 'POST',
        body: input,
      });
      return payload.result || payload;
    },
    reload: async () => {
      const payload = await this.requestRaw(this.getRoute('displaySystemReload'), {
        method: 'POST',
      });
      return payload.displaySystems || payload;
    },
    register: async (registry) => {
      if (!registry?.registerManifest) {
        throw new Error('display registry with registerManifest() is required');
      }
      const status = await this.displaySystems.list();
      const definitions = Array.isArray(status.runtimeDefinitions) ? status.runtimeDefinitions : [];
      return definitions.map((runtimeDefinition) => registry.registerManifest({
        id: runtimeDefinition.displayMetadata?.id,
        name: runtimeDefinition.displayMetadata?.name,
        sensor: {
          type: runtimeDefinition.sensorDefinition?.type,
          matrix: runtimeDefinition.sensorDefinition?.matrix,
          ports: runtimeDefinition.sensorDefinition?.ports,
        },
        protocol: runtimeDefinition.sensorDefinition?.protocol,
        algorithm: runtimeDefinition.sensorDefinition?.algorithm,
        displayMetadata: runtimeDefinition.displayMetadata,
        display: runtimeDefinition.displayMetadata,
      }));
    },
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
  subscribe(channels, { displaySystemId = this.displaySystemId } = {}) {
    const channelIds = normalizeSubscriptionChannels(channels, { displaySystemId });
    if (!channelIds.length) return channelIds;
    this.send({
      type: this.getWsMessageType('SUBSCRIBE', 'subscribe'),
      channels: channelIds,
    });
    return channelIds;
  }

  unsubscribe(channels, { displaySystemId = this.displaySystemId } = {}) {
    const channelIds = normalizeSubscriptionChannels(channels, { displaySystemId });
    if (!channelIds.length) return channelIds;
    this.send({
      type: this.getWsMessageType('UNSUBSCRIBE', 'unsubscribe'),
      channels: channelIds,
    });
    return channelIds;
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

    if (isDeclaredSensorFrame(parsed) && !isSensorFrameEnvelope(parsed)) {
      this.emit('invalidFrame', parsed);
      return;
    }

    normalized.frames.forEach((frame) => {
      this.emit('frame', frame);
      const frameEvents = new Set([
        `frame:${frame.sensorType}`,
        `frame:${frame.sensorType}:${frame.channel}`,
        frame.channelId ? `frame:${frame.channelId}` : '',
      ]);
      frameEvents.forEach((eventName) => {
        if (eventName) this.emit(eventName, frame);
      });
    });

    if (normalized.type) {
      this.emit(
        normalized.type,
        normalized.type === SENSOR_FRAME_TYPE ? normalized.raw : normalized.payload,
      );
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
