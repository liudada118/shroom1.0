/**
 * 创建 Display Systems 运行时通道注册表。
 *
 * manifest 发现层只说明有哪些展示系统；runtime channel registry 负责保存
 * 已进入运行时装配阶段的通道计划，后续串口绑定、parser 绑定和 frame processor
 * 都从这里读取稳定的计划。
 *
 * @param {object} options 创建参数。
 * @param {object} [options.logger] 日志对象。
 * @returns {object} 运行时通道注册表。
 */
function createDisplaySystemRuntimeRegistry({ logger } = {}) {
  const channels = new Map();

  function normalizePlan(plan, status = 'registered') {
    if (!plan?.id) {
      throw new Error('display system runtime channel id is required');
    }

    return Object.freeze({
      ...plan,
      status,
      registeredAt: Date.now(),
    });
  }

  function register(plan, { status = 'registered' } = {}) {
    const channel = normalizePlan(plan, status);
    if (channels.has(channel.id)) {
      logger?.warn?.('[DisplaySystems] override runtime channel', channel.id);
    }
    channels.set(channel.id, channel);
    return channel;
  }

  function registerMany(plans = [], options = {}) {
    return plans.map((plan) => register(plan, options));
  }

  function get(id) {
    return channels.get(id) || null;
  }

  function list() {
    return Array.from(channels.values());
  }

  function listByDisplaySystem(displaySystemId) {
    return list().filter((channel) => channel.displaySystemId === displaySystemId);
  }

  function snapshot() {
    const runtimeChannels = list();
    return {
      count: runtimeChannels.length,
      channels: runtimeChannels.map((channel) => ({
        id: channel.id,
        displaySystemId: channel.displaySystemId,
        serialRole: channel.serialRole,
        parserChannel: channel.parserChannel?.role || null,
        lineOrder: channel.processing?.lineOrder?.source || null,
        pointOrder: channel.processing?.pointOrder?.source || null,
        algorithmType: channel.processing?.algorithm?.type || 'none',
        outputChannel: channel.serialRole,
        status: channel.status,
      })),
    };
  }

  return {
    get,
    list,
    listByDisplaySystem,
    register,
    registerMany,
    snapshot,
  };
}

module.exports = {
  createDisplaySystemRuntimeRegistry,
};
