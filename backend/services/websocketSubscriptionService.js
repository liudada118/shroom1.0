const WebSocket = require('ws');
const { toPayload } = require('./websocketBroadcastService');

const WILDCARD_CHANNEL = '*';

/**
 * 将前端传入的单个通道或通道数组统一成干净的字符串数组。
 * @param {string | string[]} channels 通道名或通道名数组。
 * @returns {string[]} 可订阅的通道列表。
 */
function normalizeChannels(channels) {
  const list = Array.isArray(channels) ? channels : [channels];
  return list
    .map((channel) => String(channel || '').trim())
    .filter(Boolean);
}

/**
 * 解析 WebSocket 控制消息；非 JSON 消息直接忽略，避免影响旧业务命令。
 * @param {Buffer | string} message WebSocket 原始消息。
 * @returns {object | null} 解析后的消息对象。
 */
function parseMessage(message) {
  try {
    const text = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 创建 WebSocket 订阅管理器。
 * 只负责连接和 channel 订阅关系，不处理传感器解析、入库、算法等业务逻辑。
 * @param {{logger?: object}} options 日志对象。
 * @returns {object} 订阅管理器实例。
 */
function createWebSocketSubscriptionManager({ logger } = {}) {
  const channelClients = new Map();
  const scopeClients = new Map();
  const clientChannels = new WeakMap();
  const clientIds = new WeakMap();
  const clientScopes = new WeakMap();

  function getClientId(client) {
    if (!clientIds.has(client)) {
      clientIds.set(client, `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    }
    return clientIds.get(client);
  }

  function ensureClientChannels(client) {
    let channels = clientChannels.get(client);
    if (!channels) {
      channels = new Set();
      clientChannels.set(client, channels);
    }
    return channels;
  }

  function addChannelClient(channel, client) {
    if (!channelClients.has(channel)) {
      channelClients.set(channel, new Set());
    }
    channelClients.get(channel).add(client);
  }

  function removeChannelClient(channel, client) {
    const clients = channelClients.get(channel);
    if (!clients) return;
    clients.delete(client);
    if (!clients.size) {
      channelClients.delete(channel);
    }
  }

  function addScopeClient(scope, client) {
    const normalizedScope = String(scope || 'default');
    if (!scopeClients.has(normalizedScope)) {
      scopeClients.set(normalizedScope, new Set());
    }
    scopeClients.get(normalizedScope).add(client);
    clientScopes.set(client, normalizedScope);
  }

  function removeScopeClient(client) {
    const scope = clientScopes.get(client);
    if (!scope) return;
    const clients = scopeClients.get(scope);
    clients?.delete(client);
    if (clients && !clients.size) {
      scopeClients.delete(scope);
    }
  }

  function subscribe(client, channels, { replace = false } = {}) {
    const normalizedChannels = normalizeChannels(channels);
    const subscriptions = ensureClientChannels(client);
    if (!normalizedChannels.length) {
      return [...subscriptions];
    }

    if (replace) {
      for (const channel of subscriptions) {
        removeChannelClient(channel, client);
      }
      subscriptions.clear();
    }

    for (const channel of normalizedChannels) {
      subscriptions.add(channel);
      addChannelClient(channel, client);
    }

    return [...subscriptions];
  }

  function unsubscribe(client, channels) {
    const normalizedChannels = normalizeChannels(channels);
    const subscriptions = ensureClientChannels(client);

    for (const channel of normalizedChannels) {
      subscriptions.delete(channel);
      removeChannelClient(channel, client);
    }

    return [...subscriptions];
  }

  function unregisterClient(client) {
    const subscriptions = clientChannels.get(client);
    if (!subscriptions) return;

    for (const channel of subscriptions) {
      removeChannelClient(channel, client);
    }
    subscriptions.clear();
    removeScopeClient(client);
  }

  function send(client, payload) {
    if (client?.readyState !== WebSocket.OPEN) return false;
    client.send(payload);
    return true;
  }

  /**
   * 按通道发布实时帧；订阅通配符 `*` 的旧客户端会继续收到所有通道数据。
   * @param {string} channel 业务通道，例如 sit/back/head。
   * @param {string | object} data 要发送的数据。
   * @returns {number} 实际发送成功的客户端数量。
   */
  function publish(channel, data) {
    const payload = toPayload(data);
    const targets = new Set([
      ...(channelClients.get(WILDCARD_CHANNEL) || []),
      ...(channelClients.get(channel) || []),
    ]);

    let sent = 0;
    for (const client of targets) {
      if (send(client, payload)) {
        sent += 1;
      }
    }
    return sent;
  }

  function publishExact(channel, data) {
    const payload = toPayload(data);
    let sent = 0;
    for (const client of channelClients.get(channel) || []) {
      if (send(client, payload)) {
        sent += 1;
      }
    }
    return sent;
  }

  function publishScope(scope, data) {
    const payload = toPayload(data);
    let sent = 0;
    for (const client of scopeClients.get(String(scope || 'default')) || []) {
      if (send(client, payload)) {
        sent += 1;
      }
    }
    return sent;
  }

  function getSubscriptions(client) {
    return [...(clientChannels.get(client) || [])];
  }

  function sendAck(client, payload) {
    send(client, JSON.stringify(payload));
  }

  /**
   * 处理前端订阅控制消息。
   * 支持 {type:'subscribe', channels:['sit']} 和 {type:'unsubscribe', channels:['sit']}。
   * @param {import('ws')} client WebSocket 客户端。
   * @param {Buffer | string} message 原始消息。
   * @returns {boolean} 是否消费了该订阅控制消息。
   */
  function handleControlMessage(client, message) {
    const data = parseMessage(message);
    if (!data || typeof data !== 'object') return false;

    const type = data.type || data.action;
    if (type !== 'subscribe' && type !== 'unsubscribe' && type !== 'getSubscriptions') {
      return false;
    }

    if (type === 'subscribe') {
      const current = ensureClientChannels(client);
      const replace = data.replace !== false && current.has(WILDCARD_CHANNEL);
      const channels = subscribe(client, data.channels || data.channelId || data.channel, { replace });
      sendAck(client, {
        type: 'subscribed',
        clientId: getClientId(client),
        channels,
      });
      return true;
    }

    if (type === 'unsubscribe') {
      const channels = unsubscribe(client, data.channels || data.channelId || data.channel);
      sendAck(client, {
        type: 'unsubscribed',
        clientId: getClientId(client),
        channels,
      });
      return true;
    }

    sendAck(client, {
      type: 'subscriptions',
      clientId: getClientId(client),
      channels: getSubscriptions(client),
    });
    return true;
  }

  /**
   * 注册新客户端的默认订阅。
   * 主端口使用 `*` 保持旧页面兼容，独立端口使用各自的业务通道。
   * @param {import('ws')} client WebSocket 客户端。
   * @param {{channels?: string[], clientId?: string}} options 注册参数。
   * @returns {string[]} 当前客户端订阅列表。
   */
  function registerClient(client, { channels = [], clientId, scope = 'default' } = {}) {
    if (clientId) {
      clientIds.set(client, clientId);
    } else {
      getClientId(client);
    }

    subscribe(client, channels);
    addScopeClient(scope, client);
    client.on('message', (message) => {
      try {
        handleControlMessage(client, message);
      } catch (error) {
        logger?.warn?.('[WS] subscription control failed', error.message || error);
      }
    });
    client.on('close', () => unregisterClient(client));
    client.on('error', () => unregisterClient(client));

    return getSubscriptions(client);
  }

  function getStatus() {
    const channels = {};
    for (const [channel, clients] of channelClients.entries()) {
      channels[channel] = clients.size;
    }
    const scopes = {};
    for (const [scope, clients] of scopeClients.entries()) {
      scopes[scope] = clients.size;
    }
    return { channels, scopes };
  }

  return {
    getStatus,
    getSubscriptions,
    handleControlMessage,
    publish,
    publishExact,
    publishScope,
    registerClient,
    subscribe,
    unsubscribe,
    unregisterClient,
  };
}

module.exports = {
  WILDCARD_CHANNEL,
  createWebSocketSubscriptionManager,
};
