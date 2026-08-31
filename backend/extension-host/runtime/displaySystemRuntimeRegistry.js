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

  /**
   * 给通道计划打上状态和注册时间戳，并浅冻结。
   *
   * `registeredAt` 在这里取而不是让调用方传，是为了让「注册时刻」这个事实只有
   * 一个产生点 —— 它会出现在诊断快照里，调用方各自取时间会让同一批注册的通道
   * 时间戳不一致，排查时序问题时反而误导。
   *
   * ⚠️ 与展示系统注册表同理，`Object.freeze` 是**浅冻结**：`processing`、
   * `parserChannel` 等嵌套对象仍可被就地修改。
   *
   * @param {{id: string}} plan 通道计划，必须带 id。
   * @param {string} [status='registered'] 通道状态。
   * @returns {Readonly<object>} 归一并冻结后的通道。
   * @throws {Error} plan 缺 id 时抛出。
   */
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

  /**
   * 注册一条运行时通道计划。
   *
   * ⚠️ 同 id 是**允许的覆盖**，只 warn 不抛（与展示系统注册表一致，理由相同：
   * 重新发现走「清空 + 重注册」，而用户工作区的通道要能覆盖内置同名通道）。
   *
   * @param {{id: string}} plan 通道计划。
   * @param {{status?: string}} [options] 注册选项。
   * @returns {Readonly<object>} 已注册通道。
   */
  function register(plan, { status = 'registered' } = {}) {
    const channel = normalizePlan(plan, status);
    if (channels.has(channel.id)) {
      logger?.warn?.('[DisplaySystems] override runtime channel', channel.id);
    }
    channels.set(channel.id, channel);
    return channel;
  }

  /**
   * 批量注册，共用同一份 options。
   *
   * 同样不做整体事务：中途抛错时前面已注册的留在表里。
   *
   * @param {Array<{id: string}>} [plans=[]] 通道计划数组。
   * @param {{status?: string}} [options={}] 所有计划共用的注册选项。
   * @returns {Array<Readonly<object>>} 已注册通道。
   */
  function registerMany(plans = [], options = {}) {
    return plans.map((plan) => register(plan, options));
  }

  /**
   * 按通道 id 取通道计划。
   *
   * @param {string} id 通道 id。
   * @returns {Readonly<object>|null} 通道；不存在为 null。
   */
  function get(id) {
    return channels.get(id) || null;
  }

  /**
   * 列出全部通道，顺序即注册顺序。
   *
   * @returns {Array<Readonly<object>>} 通道数组。
   */
  function list() {
    return Array.from(channels.values());
  }

  /**
   * 列出某个展示系统下的所有通道。
   *
   * 一个展示系统可以有多条通道（多物理串口按 serialRole 区分），所以这里返回
   * 数组而不是单值 —— 别按「一个系统一条通道」写调用方。
   *
   * @param {string} displaySystemId 展示系统 id。
   * @returns {Array<Readonly<object>>} 该系统的通道数组，可能为空。
   */
  function listByDisplaySystem(displaySystemId) {
    return list().filter((channel) => channel.displaySystemId === displaySystemId);
  }

  /**
   * 清空通道表，供重新发现时使用。
   *
   * @returns {void}
   */
  function clear() {
    channels.clear();
  }

  /**
   * 生成用于诊断/接口展示的精简通道快照。
   *
   * 与展示系统快照同理，刻意只投影固定字段而非整份计划：这份数据会出到前端和
   * SDK，`processing` 里含算法源码路径等不该成为对外契约的内容。注意
   * `outputChannel` 缺省回落到 `serialRole` —— `outputChannel` 只是展示别名，
   * 没声明时就用物理角色顶上。
   *
   * @returns {{count: number, channels: object[]}} 快照。
   */
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
        outputChannel: channel.outputChannel || channel.serialRole,
        status: channel.status,
      })),
    };
  }

  return {
    clear,
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
