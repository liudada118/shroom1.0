const WebSocket = require('ws');
const { toPayload } = require('./websocketChannelService');

const WILDCARD_CHANNEL = '*';

/**
 * WebSocket 实时订阅服务。
 *
 * 维护客户端与业务 channel/scope 的订阅关系，并按订阅结果发送实时数据。
 * 该服务不解析传感器协议，也不直接处理采集、入库或算法逻辑。
 */

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

  /**
   * 获取客户端稳定 ID；未显式传入时生成一个运行期 ID。
   * @param {import('ws')} client WebSocket 客户端。
   * @returns {string} 客户端 ID。
   */
  function getClientId(client) {
    if (!clientIds.has(client)) {
      clientIds.set(client, `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    }
    return clientIds.get(client);
  }

  /**
   * 获取客户端当前订阅集合；不存在时自动创建。
   * @param {import('ws')} client WebSocket 客户端。
   * @returns {Set<string>} 当前客户端订阅的 channel 集合。
   */
  function ensureClientChannels(client) {
    let channels = clientChannels.get(client);
    if (!channels) {
      channels = new Set();
      clientChannels.set(client, channels);
    }
    return channels;
  }

  /**
   * 把客户端加入指定 channel 的订阅集合。
   * @param {string} channel 业务通道名。
   * @param {import('ws')} client WebSocket 客户端。
   */
  function addChannelClient(channel, client) {
    if (!channelClients.has(channel)) {
      channelClients.set(channel, new Set());
    }
    channelClients.get(channel).add(client);
  }

  /**
   * 从指定 channel 中移除客户端，并清理空集合。
   * @param {string} channel 业务通道名。
   * @param {import('ws')} client WebSocket 客户端。
   */
  function removeChannelClient(channel, client) {
    const clients = channelClients.get(channel);
    if (!clients) return;
    clients.delete(client);
    if (!clients.size) {
      channelClients.delete(channel);
    }
  }

  /**
   * 把客户端加入指定 scope，用于按连接组发送消息。
   * @param {string} scope 连接分组名。
   * @param {import('ws')} client WebSocket 客户端。
   */
  function addScopeClient(scope, client) {
    const normalizedScope = String(scope || 'default');
    if (!scopeClients.has(normalizedScope)) {
      scopeClients.set(normalizedScope, new Set());
    }
    scopeClients.get(normalizedScope).add(client);
    clientScopes.set(client, normalizedScope);
  }

  /**
   * 从客户端所属 scope 中移除客户端。
   * @param {import('ws')} client WebSocket 客户端。
   */
  function removeScopeClient(client) {
    const scope = clientScopes.get(client);
    if (!scope) return;
    const clients = scopeClients.get(scope);
    clients?.delete(client);
    if (clients && !clients.size) {
      scopeClients.delete(scope);
    }
  }

  /**
   * 为客户端订阅一个或多个 channel。
   * @param {import('ws')} client WebSocket 客户端。
   * @param {string | string[]} channels 要订阅的 channel。
   * @param {{replace?: boolean}} options 是否替换已有订阅。
   * @returns {string[]} 更新后的订阅列表。
   */
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

  /**
   * 取消客户端对一个或多个 channel 的订阅。
   * @param {import('ws')} client WebSocket 客户端。
   * @param {string | string[]} channels 要取消订阅的 channel。
   * @returns {string[]} 更新后的订阅列表。
   */
  function unsubscribe(client, channels) {
    const normalizedChannels = normalizeChannels(channels);
    const subscriptions = ensureClientChannels(client);

    for (const channel of normalizedChannels) {
      subscriptions.delete(channel);
      removeChannelClient(channel, client);
    }

    return [...subscriptions];
  }

  /**
   * 注销客户端，清理它的 channel 和 scope 订阅关系。
   * @param {import('ws')} client WebSocket 客户端。
   */
  function unregisterClient(client) {
    const subscriptions = clientChannels.get(client);
    if (!subscriptions) return;

    for (const channel of subscriptions) {
      removeChannelClient(channel, client);
    }
    subscriptions.clear();
    removeScopeClient(client);
  }

  /**
   * 向单个在线客户端发送已序列化 payload。
   * @param {import('ws')} client WebSocket 客户端。
   * @param {string} payload 已序列化消息。
   * @returns {boolean} 是否发送成功。
   */
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

  /**
   * 只向精确订阅指定 channel 的客户端发送，不包含通配符订阅者。
   * @param {string} channel 业务通道。
   * @param {string | object} data 要发送的数据。
   * @returns {number} 实际发送成功的客户端数量。
   */
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

  /**
   * 向指定 scope 下的所有客户端发送消息。
   * @param {string} scope 连接分组名。
   * @param {string | object} data 要发送的数据。
   * @returns {number} 实际发送成功的客户端数量。
   */
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

  /**
   * 查询客户端当前订阅的 channel 列表。
   * @param {import('ws')} client WebSocket 客户端。
   * @returns {string[]} 当前订阅列表。
   */
  function getSubscriptions(client) {
    return [...(clientChannels.get(client) || [])];
  }

  /**
   * 向客户端发送订阅控制确认消息。
   * @param {import('ws')} client WebSocket 客户端。
   * @param {object} payload 确认消息对象。
   */
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

  /**
   * 获取当前订阅管理器的运行状态统计。
   * @returns {{channels: Record<string, number>, scopes: Record<string, number>}} channel/scope 客户端数量。
   */
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
