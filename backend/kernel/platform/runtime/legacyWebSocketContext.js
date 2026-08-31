/**
 * 把一对 get/set 收成访问器对象。
 *
 * 只是个规范化的形状。存在的意义是让下面的代码只认 `{get, set}` 一种形状，
 * 而不用应付「有的传函数、有的传对象、有的只传 get」——
 * 旧 server.js 里那批变量的暴露方式并不统一。
 *
 * @param {Function} get 读函数。
 * @param {Function} set 写函数。
 * @returns {{get: Function, set: Function}} 访问器。
 */
function createMutableAccessor(get, set) {
  return { get, set };
}

/**
 * 访问器 → `Object.defineProperties` 需要的属性描述符。
 *
 * `enumerable: true` 是必需的：旧 WebSocket handler 里有 `{...context}` 和
 * `Object.keys(context)` 这类写法，不可枚举的话那些字段会凭空消失，
 * 而且不报错 —— 现象是某些消息处理里读到 undefined。
 *
 * `configurable: true` 留给测试：测试要能重新 define 覆盖某个字段做桩。
 *
 * 注意这里给的是 **getter/setter 而不是 value** —— 这是整个模块的关键。
 * 用 value 就等于在创建上下文的那一刻拍了快照，之后 server.js 改了变量
 * handler 读不到（回放下标、串口列表都是会变的）。
 *
 * @param {{get: Function, set: Function}} accessor 访问器。
 * @returns {object} 属性描述符。
 */
function toPropertyDescriptor(accessor) {
  return {
    configurable: true,
    enumerable: true,
    get: accessor.get,
    set: accessor.set,
  };
}

/**
 * 组装旧 WebSocket 上下文的全部属性描述符。
 *
 * 分两类来源，**后者覆盖前者**（对象字面量里写在后面）：
 * - `mutableAccessors` —— server.js 仍然直接持有的那些 `let` 变量。
 * - 五个固定字段 —— 已经迁进 PlaybackStateStore / RuntimeStateStore 的部分。
 *
 * 覆盖顺序是有意的：一个字段一旦迁进 store，就以 store 为准，
 * 即使 server.js 还在 `mutableAccessors` 里传着同名的旧访问器也不会生效。
 * 这让迁移可以一个字段一个字段地做，而不必一次性改完 server.js ——
 * 迁完的字段自动接管，漏掉的旧访问器只是失效，不会出现「两处都是真相」。
 *
 * 这五个字段是**逐个迁移的进度记录**：还没出现在这里的旧运行态字段
 * （`file`、`length`、`timeStamp` 等）说明仍走 `mutableAccessors`。
 *
 * @param {object} [options] 参数。
 * @param {Record<string, {get: Function, set: Function}>} [options.mutableAccessors] 旧变量访问器。
 * @param {Function} options.playbackStateAccessor 回放状态访问器工厂。
 * @param {Function} options.serialPortStateAccessor 串口状态访问器工厂。
 * @returns {Record<string, object>} 属性描述符表。
 */
function createWebSocketContextAccessors({
  mutableAccessors = {},
  playbackStateAccessor,
  serialPortStateAccessor,
} = {}) {
  const accessors = {
    ...mutableAccessors,
    indexArr: playbackStateAccessor('indexArr'),
    localData: playbackStateAccessor('localData'),
    localDataBack: playbackStateAccessor('localDataBack'),
    nowIndex: playbackStateAccessor('nowIndex'),
    serialport: serialPortStateAccessor('serialport'),
  };

  return Object.fromEntries(
    Object.entries(accessors).map(([key, accessor]) => [key, toPropertyDescriptor(accessor)]),
  );
}

/**
 * 将 getter/setter 描述转换成 WebSocket handler 可使用的运行态访问器。
 *
 * @param {Record<string, { get: Function, set: Function }>} mutableAccessors 可读写旧变量描述。
 * @returns {Record<string, { get: Function, set: Function }>} 规范化后的运行态访问器。
 */
function buildMutableAccessors(mutableAccessors = {}) {
  return Object.entries(mutableAccessors).reduce((result, [key, accessor]) => {
    result[key] = createMutableAccessor(accessor.get, accessor.set);
    return result;
  }, {});
}

/**
 * 创建旧 WebSocket handler 的运行时兼容上下文。
 *
 * server.js 只负责把依赖和旧运行态变量以 getter/setter 形式传进来；
 * 本模块统一挂载 runtime accessor，避免 WebSocket handler 继续直接耦合 server.js 变量。
 *
 * @param {object} options 创建参数。
 * @param {object} options.dependencies WebSocket handler 需要的稳定服务依赖。
 * @param {Record<string, { get: Function, set: Function }>} options.mutableAccessors 旧运行态变量访问器。
 * @param {Function} options.playbackStateAccessor 回放状态访问器工厂。
 * @param {Function} options.serialPortStateAccessor 串口状态访问器工厂。
 * @returns {object} 可直接传给 createWebSocketHandlerAttacher 的上下文。
 */
function createWebSocketHandlerContext({
  dependencies,
  mutableAccessors,
  playbackStateAccessor,
  serialPortStateAccessor,
}) {
  const context = { ...dependencies };

  Object.defineProperties(context, createWebSocketContextAccessors({
    mutableAccessors: buildMutableAccessors(mutableAccessors),
    playbackStateAccessor,
    serialPortStateAccessor,
  }));

  return context;
}

module.exports = {
  buildMutableAccessors,
  createWebSocketContextAccessors,
  createWebSocketHandlerContext,
};
