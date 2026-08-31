/**
 * JQBed 算法参数的读写协议（旧字段形态的 WebSocket 命令）。
 *
 * 这套命令没有迁到新的 HTTP 命令信封，是因为它需要**广播**：一个客户端改了参数，其他
 * 客户端的界面要立刻跟上（见 `broadcastJson`）。当前只有 WebSocket 有广播通道。
 */
const { JqbedAlgorithmConfigValidationError } = require('./jqbedAlgorithmConfig');

/**
 * 拼 Python `getData` 调用的参数。
 *
 * 只有 jqbed 才带 `config`：其他传感器型号共用同一个 Python 入口，但它们的算法不认识
 * 这批参数，多传一个键可能让 Python 侧报错。所以这里是**按型号显式开白名单**，
 * 而不是「有配置就传」。
 *
 * `configEnvelope?.values` 而不是整个信封：Python 只要参数本体，`version`/`savedAt`
 * 是本仓的持久化元数据，传过去等于往算法入参里塞两个它不认识的键。
 *
 * @param {number[]} data 一帧矩阵数据。
 * @param {string} activeFile 当前传感器型号标识。
 * @param {object|null} [configEnvelope] 算法参数信封；null 表示不带参数调用。
 * @returns {{data: number[], config?: object}} Python 调用参数。
 */
function buildJqbedGetDataArgs(data, activeFile, configEnvelope) {
  return activeFile === 'jqbed' && configEnvelope?.values
    ? { data, config: configEnvelope.values }
    : { data };
}

/**
 * 判断一条消息是不是算法参数命令。
 *
 * ⚠️ 这里用的是**真值判断**（与本仓大多数命令判定相反）。三个字段的合法值形状决定了这
 * 是安全的：`getJqbedAlgorithmConfig`/`resetJqbedAlgorithmConfig` 是 `true` 触发，
 * `setJqbedAlgorithmConfig` 带的是一个非空参数对象。三者都不存在「合法的假值」。
 * 但也意味着 `{setJqbedAlgorithmConfig: {}}` 会被判成「不是这类命令」而无人处理 ——
 * 空对象本来也过不了校验，所以现象上无差别。
 *
 * @param {*} message 待判断的消息。
 * @returns {boolean} 是否属于算法参数命令。
 */
function isJqbedAlgorithmConfigMessage(message) {
  return Boolean(
    message?.getJqbedAlgorithmConfig
    || message?.setJqbedAlgorithmConfig
    || message?.resetJqbedAlgorithmConfig,
  );
}

/**
 * 创建算法参数协议处理器。
 *
 * @param {object} options 依赖。
 * @param {object} options.store jqbedAlgorithmConfig store（load/getSnapshot/save/reset）。
 * @param {Function} options.sendJson 单播给发起命令的那个客户端。
 * @param {Function} options.broadcastJson 广播给全部客户端（参数变更要让所有界面同步）。
 * @param {Function} options.getAlgorithmStatus 取 Python 算法当前状态
 *        （waiting/ready/错误），随 load 一起回给前端。
 * @returns {{handle: Function}} 处理器。
 */
function createJqbedAlgorithmProtocol({ store, sendJson, broadcastJson, getAlgorithmStatus }) {
  /**
   * 回一条统一形状的结果给发起方。
   *
   * `errors` 默认 `{}` 而不是 undefined：前端无条件遍历这张表，缺了要写空值判断。
   *
   * `requestId` **只在调用方传了才带上**（判 `!== undefined`）。旧前端不发 requestId，
   * 无条件带一个 `requestId: undefined` 会在 JSON 序列化后变成缺字段，形状不稳定；
   * 更重要的是新前端按「有没有 requestId」决定走不走请求-响应配对，凭空造一个会让它
   * 等一个永远对不上的回执。
   *
   * @param {object} client 目标客户端连接。
   * @param {boolean} ok 是否成功。
   * @param {'load'|'save'|'reset'} action 本次动作。
   * @param {Record<string, string>} [errors] 字段级错误表。
   * @param {string|null} [message] 错误文案或 i18n key。
   * @param {*} [requestId] 请求标识，仅在存在时回传。
   * @returns {void}
   */
  function sendResult(client, ok, action, errors = {}, message = null, requestId) {
    sendJson(client, {
      jqbedAlgorithmConfigResult: {
        ok,
        action,
        errors,
        message,
        ...(requestId !== undefined ? { requestId } : {}),
      },
    });
  }

  /**
   * 处理一条算法参数命令。
   *
   * **三重前置条件必须同时满足**（授权有效、当前型号是 jqbed、处于实时模式），否则回一条
   * 失败结果。三条各有理由：
   * - `licenseValid` —— 算法参数是授权功能。
   * - `activeFile === 'jqbed'` —— 参数只对这套算法有意义，别的型号存了也没人读。
   * - `realtime` —— 回放历史数据时改参数不会影响任何东西（历史数据是算完存下来的），
   *   允许改只会让用户误以为改了有用。
   *
   * `load` 失败时回的是 i18n key（`'jqbedAlgorithmConfig.backend.unavailable'`），
   * save/reset 失败时回的是英文句子 —— 不一致是历史遗留：load 会在切到 jqbed 界面时自动
   * 触发（用户没主动操作，文案要能本地化），另两个是用户点按钮才发生的。
   *
   * `load` 单播时**顺带把算法状态一起发**：前端打开参数面板需要同时知道「参数是什么」和
   * 「Python 算法起来了没有」，两条消息分开发会出现面板先显示参数再跳出「算法未就绪」。
   *
   * save/reset 成功后是**广播**参数、**单播**回执：参数变更要让所有客户端界面同步，
   * 但「你这次操作成功了」只有发起方需要。
   *
   * catch 里区分两类错误（见 JqbedAlgorithmConfigValidationError）：校验错带字段表让前端
   * 高亮输入框；其他错（落盘失败等）只回一句通用文案，**不把原始 error.message 透出去** ——
   * 那里面可能带绝对路径。
   *
   * 返回 `true` 表示「这条命令我接了」（无论成败），路由层据此 stop；返回 `false` 表示
   * 不是这类命令，交给后面的处理器。
   *
   * @param {object} message 命令消息。
   * @param {object} context 运行时上下文（client/licenseValid/activeFile/realtime）。
   * @returns {boolean} 是否已接管这条命令。
   */
  function handle(message, context) {
    if (!isJqbedAlgorithmConfigMessage(message)) return false;

    const { client, licenseValid, activeFile, realtime } = context;
    const action = message.setJqbedAlgorithmConfig ? 'save' : message.resetJqbedAlgorithmConfig ? 'reset' : 'load';
    const { requestId } = message;
    if (!licenseValid || activeFile !== 'jqbed' || !realtime) {
      sendResult(
        client,
        false,
        action,
        {},
        action === 'load'
          ? 'jqbedAlgorithmConfig.backend.unavailable'
          : 'jqbed realtime configuration is unavailable',
        requestId,
      );
      return true;
    }

    if (message.getJqbedAlgorithmConfig) {
      sendJson(client, {
        jqbedAlgorithmConfig: store.getSnapshot(),
        jqbedAlgorithmStatus: getAlgorithmStatus(),
        jqbedAlgorithmConfigResult: {
          ok: true,
          action: 'load',
          errors: {},
          message: null,
          ...(requestId !== undefined ? { requestId } : {}),
        },
      });
      return true;
    }

    try {
      const snapshot = action === 'save'
        ? store.save(message.setJqbedAlgorithmConfig)
        : store.reset();
      broadcastJson({ jqbedAlgorithmConfig: snapshot });
      sendResult(client, true, action, {}, null, requestId);
    } catch (error) {
      if (error instanceof JqbedAlgorithmConfigValidationError) {
        sendResult(client, false, action, { ...error.errors }, error.message, requestId);
      } else {
        sendResult(client, false, action, {}, 'Unable to save jqbed algorithm configuration', requestId);
      }
    }
    return true;
  }

  return { handle };
}

/**
 * 构造可挂载到 codeOpi 命令路由器的隔离处理器。
 *
 * 配置协议只允许主 WebSocket 入口调用；授权、当前传感器和回放状态由
 * runtimeContextFactory 的读取函数在每次请求时提供，模块本身不持有串口或
 * Electron 状态。
 *
 * `when` 里的 `context.scope === 'main'` 是一条**权限边界**：算法参数只能从主界面那条
 * WebSocket 连接改。别的 scope（例如给外部工具用的连接）即使发同样的命令也不会命中，
 * 会一路落到「没人接」。
 *
 * `getRuntimeContext` 是**每次请求现调**（不是装配期取一次快照）：授权状态、当前型号、
 * 是否回放中都会在运行期变，缓存下来会让刚切到回放的客户端仍然改得动参数。
 *
 * `handle` 返回 `{stop: handled}` 而不是恒 `{stop: true}`：protocol 判定不是这类命令时
 * 要让责任链继续往下走。实际上 `when` 已经用同一个判据过滤过，所以 `handled` 为 false
 * 只可能是 protocol 内部判据与 `when` 不一致 —— 保留这个转发是防御性的。
 *
 * @param {object} options 依赖。
 * @param {{handle: Function}} options.protocol 由 createJqbedAlgorithmProtocol 建的处理器。
 * @param {Function} options.getRuntimeContext 取当前运行时上下文。
 * @returns {{name: string, when: Function, handle: Function}} 可注册的 handler。
 * @throws {Error} 依赖缺失或形状不对（装配期错误，立刻抛）。
 */
function createJqbedAlgorithmCommandHandler({ protocol, getRuntimeContext }) {
  if (!protocol || typeof protocol.handle !== 'function') {
    throw new Error('jqbed algorithm protocol is required');
  }
  if (typeof getRuntimeContext !== 'function') {
    throw new Error('getRuntimeContext is required');
  }

  return {
    name: 'jqbed-algorithm-config',
    when: (message, context) => (
      context.scope === 'main' && isJqbedAlgorithmConfigMessage(message)
    ),
    handle: (message, context) => {
      const handled = protocol.handle(message, {
        ...getRuntimeContext(),
        client: context.client,
      });
      return { stop: handled };
    },
  };
}

module.exports = {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmCommandHandler,
  createJqbedAlgorithmProtocol,
  isJqbedAlgorithmConfigMessage,
};
