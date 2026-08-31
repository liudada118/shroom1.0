/**
 * 先读 store、读不到再用 fallback —— 迁移期「读」侧的唯一取值规则。
 *
 * 「读不到」的判据是 **`=== undefined`**，不是真值判断。这一点是本函数的全部要害：
 * `localFlag: false`（不在回放）、`nowDate: 0`、`db: null`（数据库还没打开）都是合法状态
 * 值，用 `||` 兜底会把它们换成 fallback，于是同一个字段在 store 和旧闭包里给出不同答案 ——
 * 现象是「已经退出回放了，但某个模块还在读回放数据」。
 *
 * `runtimeStateStore?.get` 那一层判断对应装配期：`createServerRuntimeContext` 拿到的是
 * `() => runtimeStateStoreForContext`，而那个变量在 server.js 里先被置成 `null`，直到
 * store 建好（约 700 行之后）才回填。这期间任何读取都必须落到旧闭包上，否则启动早期的
 * 模块会拿到一串 undefined。
 *
 * @param {object|null|undefined} runtimeStateStore RuntimeStateStore，可为空。
 * @param {string} key 字段名。
 * @param {*} fallback store 未接管该字段时的取值。
 * @returns {*} 字段值。
 */
function getStoreValue(runtimeStateStore, key, fallback) {
  if (!runtimeStateStore?.get) return fallback;
  const value = runtimeStateStore.get(key);
  return value === undefined ? fallback : value;
}

/**
 * 创建 server 运行时读取上下文。
 *
 * 写入侧已经通过 RuntimeStateStore 逐步集中；读取侧用这个上下文先读 store，
 * store 尚未初始化或字段不存在时再回退到旧闭包变量，方便分阶段迁移。
 *
 * @param {object} options 创建参数。
 * @param {Function} options.getRuntimeStateStore RuntimeStateStore getter。
 * @param {object} options.fallbacks 旧变量 fallback getter。
 * @returns {object} 运行时读取上下文。
 */
function createServerRuntimeContext({
  getRuntimeStateStore,
  fallbacks = {},
} = {}) {
  /**
   * 读一个运行时字段：store 优先，回退到旧闭包 getter。
   *
   * ⚠️ `fallbacks[key]?.()` 是**每次都求值**的（作为实参先算出来再传进去），也就是说
   * **即使 store 里有值，旧闭包的 getter 也照样被调了一遍**。当前所有 fallback 都是
   * `() => someLet` 这样的纯读取，所以只是几纳秒的浪费；但**往 fallbacks 里放带副作用的
   * getter（懒打开数据库之类）会在这里被意外触发**。要改成惰性就得把 getStoreValue 的
   * 第三个参数改成函数，那是它当前签名之外的事。
   *
   * `getRuntimeStateStore?.()` 每次重新取 store 而不缓存：store 是在装配后期才被回填的
   * （见 getStoreValue 的说明），缓存住就永远是 null。
   *
   * @param {string} key 字段名。
   * @returns {*} 字段值。
   */
  function getValue(key) {
    return getStoreValue(getRuntimeStateStore?.(), key, fallbacks[key]?.());
  }

  /**
   * 取当前传感器类型。
   *
   * ⚠️ 内部键名是 **`file`**，不是 `sensorType` —— 旧 server.js 用一个叫 `file` 的变量
   * 存传感器类型（它同时也是历史库文件名的一部分）。这个对外方法名是把那个历史名字挡在
   * 上下文边界之外的唯一一层，所以**读它请一律走这里，不要直接 `store.get('file')`**：
   * 将来键名改掉时，改动面就只有这一行。
   *
   * @returns {string|undefined} 传感器类型（如 `jqbed`）。
   */
  function getSensorType() {
    return getValue('file');
  }

  /**
   * 取当前串口波特率。
   *
   * 之所以要走上下文而不是直接读配置：波特率会被运行时命令改（切传感器类型时跟着变），
   * 配置里的那份只是启动初值。
   *
   * @returns {number|undefined} 波特率。
   */
  function getBaudRate() {
    return getValue('baudRate');
  }

  /**
   * 取当前采集/回放会话的日期标记。
   *
   * 它决定历史数据写进哪张表、回放读哪张表，所以采集侧和回放侧必须读到同一个值 ——
   * 这也是它没有留在各自模块里而被提到公共上下文的原因。
   *
   * @returns {*} 日期标记（旧链路里的形态由 server.js 决定，这里不做归一）。
   */
  function getNowDate() {
    return getValue('nowDate');
  }

  /**
   * 是否处于本地回放模式。
   *
   * 这里**做了 `Boolean()` 归一**，是上下文里唯一一处对值做处理的地方：`localFlag` 在旧
   * 代码里被赋过 `0`/`1`/`'true'` 等各种形态，而调用方全是 `if (isLocalPlayback())` 这种
   * 判断。归一放在这里，比让每个调用方各自猜要安全。
   *
   * 注意归一发生在兜底之后，所以 store 里是 `undefined`、旧闭包也没有时结果是 `false`
   * （「不在回放」），这正是想要的默认。
   *
   * @returns {boolean} 是否在回放。
   */
  function isLocalPlayback() {
    return Boolean(getValue('localFlag'));
  }

  /**
   * 按展示通道取对应的数据库句柄。
   *
   * 三个句柄（`db`/`db1`/`db2`）是旧的固定三通道模型：坐垫 / 靠背 / 头枕各一个库文件。
   * 这个映射函数是**兼容边界**，新链路应该按 channelId 走存储层，而不是扩展这里的分支 ——
   * 再加通道就得再加一个 `dbN` 变量，那条路走不远。
   *
   * 默认 `'sit'`：旧代码里绝大多数调用不传参，含义就是主通道。未知通道名也落到 `db` 而
   * 不是报错，保持旧行为（旧代码有传拼错通道名的地方，报错会让采集直接中断）。
   *
   * @param {'sit'|'back'|'head'} [channel] 展示通道。
   * @returns {object|undefined} 数据库句柄。
   */
  function getDatabase(channel = 'sit') {
    if (channel === 'back') return getValue('db1');
    if (channel === 'head') return getValue('db2');
    return getValue('db');
  }

  return {
    getBaudRate,
    getDatabase,
    getNowDate,
    getSensorType,
    isLocalPlayback,
  };
}

module.exports = {
  createServerRuntimeContext,
  getStoreValue,
};
