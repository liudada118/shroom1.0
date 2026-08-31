const {
  bindDisplaySystemRuntimeChannels,
} = require('./displaySystemRuntimeBinder');
const {
  createDisplaySystemRuntimeDispatcher,
} = require('./displaySystemRuntimeDispatcher');

/**
 * 把 binding 列表投影成诊断快照。
 *
 * 只取九个字段，**刻意不含 `handleFrame`、`runtimeChannel` 和 `metadata`**：
 * 这份快照会经 HTTP 出去，带上 `handleFrame` 是把函数塞进 JSON（序列化后消失，
 * 白占地方），带上 `runtimeChannel` 则会把整份通道计划（含算法源码路径）泄到
 * 对外接口上。新增字段前先确认它该不该成为对外契约。
 *
 * `serialStatus` 只取里面的 `.status` 字符串而不是整个对象，同理是收窄对外面。
 *
 * @param {object[]} [runtimeBindings=[]] binding 列表。
 * @returns {{count: number, bindings: object[]}} 快照。
 */
function buildRuntimeBindingSnapshot(runtimeBindings = []) {
  return {
    count: runtimeBindings.length,
    bindings: runtimeBindings.map((binding) => ({
      id: binding.id,
      displaySystemId: binding.displaySystemId,
      serialRole: binding.serialRole,
      parserChannel: binding.parserChannel,
      outputChannel: binding.outputChannel,
      status: binding.status,
      error: binding.error || null,
      serialStatus: binding.serialStatus?.status || null,
      runtimeMode: binding.runtimeMode || null,
    })),
  };
}

/**
 * 创建 Display Systems 实时链路控制器。
 *
 * appRuntimeFactory 只负责把 discovery 和 HTTP 状态拼起来；这里集中管理 runtime channel
 * binding、dispatcher 创建、重复绑定时旧 listener 清理，以及关闭时 dispatcher stop。
 *
 * @param {object} options 创建参数。
 * @param {object} options.runtimeChannelRegistry Display Systems runtime channel 注册表。
 * @param {object} [options.logger] 日志对象。
 * @param {Function} [options.bindRuntimeChannels] runtime channel 绑定函数。
 * @param {Function} [options.createRuntimeDispatcher] dispatcher 工厂。
 * @returns {object} Display Systems runtime 控制器。
 */
function createDisplaySystemRuntimeController({
  runtimeChannelRegistry,
  logger,
  bindRuntimeChannels = bindDisplaySystemRuntimeChannels,
  createRuntimeDispatcher = createDisplaySystemRuntimeDispatcher,
} = {}) {
  let runtimeBindings = [];
  let runtimeDispatcher = null;

  /**
   * 重新绑定并启动整条实时链路。
   *
   * **可重复调用**，每次都是全量重建（切换传感器、重新发现 manifest 之后都会走
   * 这里）。第一行 `runtimeDispatcher?.stop?.()` 是必须的：不先停掉旧 dispatcher，
   * 旧的 parser 监听会留在原地，同一帧被新旧两套 binding 各处理一次，现象是数据
   * 翻倍或画面闪烁 —— 这也是本文件头注释里「重复绑定时旧 listener 清理」那句话的
   * 具体所指。
   *
   * 注意两个运营侧开关（`allowParallelWithLegacy` / `allowActiveDisplaySystem`）
   * 只透传给 dispatcher，不参与 binding 构建 —— 闸门在调度侧，不在绑定侧。
   *
   * @param {object} [options] 运行时依赖。
   * @param {object} [options.serialManager] 串口管理器（只读状态，不在这里开关串口）。
   * @param {object} [options.serialParserManager] parser 管理器。
   * @param {object} [options.frameOutputPipeline] 实时帧输出管线。
   * @param {Function} [options.getSensorType] 当前传感器类型 getter。
   * @param {boolean} [options.allowParallelWithLegacy] 是否允许默认并行消费 legacy 通道。
   * @param {boolean} [options.allowActiveDisplaySystem] 是否允许 active manifest 接管旧通道。
   * @param {object} [options.zeroStateStore] 零点状态仓库。
   * @returns {object[]} 本次构建出的 binding 列表。
   */
  function bind({
    serialManager,
    serialParserManager,
    frameOutputPipeline,
    getSensorType,
    allowParallelWithLegacy,
    allowActiveDisplaySystem,
    zeroStateStore,
  } = {}) {
    runtimeDispatcher?.stop?.();
    runtimeBindings = bindRuntimeChannels({
      runtimeChannelRegistry,
      serialManager,
      serialParserManager,
      frameOutputPipeline,
      zeroStateStore,
    });
    runtimeDispatcher = createRuntimeDispatcher({
      bindings: runtimeBindings,
      serialParserManager,
      logger,
      getSensorType,
      allowParallelWithLegacy,
      allowActiveDisplaySystem,
    });
    runtimeDispatcher.start();
    return runtimeBindings;
  }

  /**
   * 停掉当前 dispatcher（应用退出、或切换传感器前调用）。
   *
   * 两层可选调用是为了「还没 bind 过就 stop」这种正常时序：启动失败或压根没有
   * 展示系统时 `runtimeDispatcher` 是 null，这里不该抛错 —— 退出路径上抛错会
   * 让后面的串口/数据库清理被跳过。
   *
   * ⚠️ 不清空 `runtimeBindings`：停掉调度之后 binding 快照还要能被诊断接口读到
   * （「停了，但当时有哪几条」是排查信息）。想彻底重置就重新 `bind()`。
   *
   * @returns {object|undefined} dispatcher 的状态快照；没有 dispatcher 时为 undefined。
   */
  function stop() {
    return runtimeDispatcher?.stop?.();
  }

  /**
   * 取 dispatcher 状态，dispatcher 不存在时给一份形状相同的空状态。
   *
   * 兜底对象**必须与 dispatcher.getStatus() 字段完全一致**，否则调用方（HTTP 状态
   * 接口、前端诊断面板）在「还没 bind」和「已 bind」两种情况下拿到的形状不同，
   * 就得到处写 `?.`。注意兜底里 `bindingCount` 用的是本地 `runtimeBindings.length`
   * 而不是 0 —— bind 成功但 dispatcher 创建失败时，这个数能说明「binding 建出来了，
   * 只是没人调度」，比一律报 0 更接近事实。
   *
   * @returns {{started: boolean, bindingCount: number, activeHandlerCount: number,
   *            skippedBindingCount: number, handlers: object[], skippedBindings: object[]}}
   *          dispatcher 状态。
   */
  function getDispatcherStatus() {
    return runtimeDispatcher?.getStatus?.() || {
      started: false,
      bindingCount: runtimeBindings.length,
      activeHandlerCount: 0,
      skippedBindingCount: 0,
      handlers: [],
      skippedBindings: [],
    };
  }

  /**
   * 整条实时链路的对外状态：binding 快照 + dispatcher 状态。
   *
   * 这两块要一起看才能定位「展示系统没数据」：`runtimeBindings` 里每条的
   * `status` 说明装配到哪一步（`bound` / `registered` / `error`），
   * `runtimeDispatcher` 的三个计数说明挂载和策略拦截情况。
   * 典型对法：`bindings` 里是 `registered` → parser 通道或输出发布器没解析出来
   * （看 displaySystemRuntimeBinder）；是 `bound` 但没进 `handlers` 且不在
   * `skippedBindings` 里 → 落进了 dispatcher `bindOne` 的静默 null 分支。
   *
   * @returns {{runtimeBindings: object, runtimeDispatcher: object}} 状态快照。
   */
  function getStatus() {
    return {
      runtimeBindings: buildRuntimeBindingSnapshot(runtimeBindings),
      runtimeDispatcher: getDispatcherStatus(),
    };
  }

  return {
    bind,
    getRuntimeBindings: () => runtimeBindings,
    getStatus,
    stop,
  };
}

module.exports = {
  buildRuntimeBindingSnapshot,
  createDisplaySystemRuntimeController,
};
