const assert = require('assert');
const {
  createServerRuntimeContext,
  getStoreValue,
} = require('../../kernel/platform/runtime/runtimeContextFactory');

assert.strictEqual(getStoreValue(null, 'file', 'fallback'), 'fallback');
assert.strictEqual(getStoreValue({ get: () => undefined }, 'file', 'fallback'), 'fallback');
assert.strictEqual(getStoreValue({ get: () => 'store' }, 'file', 'fallback'), 'store');

let store = null;
const context = createServerRuntimeContext({
  getRuntimeStateStore: () => store,
  fallbacks: {
    baudRate: () => 115200,
    db: () => 'sitDbFallback',
    db1: () => 'backDbFallback',
    db2: () => 'headDbFallback',
    file: () => 'fallbackSensor',
    localFlag: () => false,
    nowDate: () => 100,
  },
});

assert.strictEqual(context.getSensorType(), 'fallbackSensor');
assert.strictEqual(context.getBaudRate(), 115200);
assert.strictEqual(context.getDatabase('back'), 'backDbFallback');
assert.strictEqual(context.getNowDate(), 100);
assert.strictEqual(context.isLocalPlayback(), false);

store = {
  /**
   * 假的 store 读取：从一张写死的表里取值。
   *
   * 上面那个 `context` 是在 `store === null` 时造的，这里**换掉外层的 `store` 变量**
   * 之后再断言 —— 验的正是 `createServerRuntimeContext` 每次都走
   * `getRuntimeStateStore()` 现取，而不是构造时拍快照。若是快照，
   * 换 store 后读到的还会是 fallback 值。
   *
   * @param {string} key 运行态字段名。
   * @returns {unknown} 对应值，表里没有则 undefined（触发 fallback）。
   */
  get(key) {
    return {
      baudRate: 230400,
      db: 'sitDb',
      db1: 'backDb',
      db2: 'headDb',
      file: 'jqbed',
      localFlag: true,
      nowDate: 200,
    }[key];
  },
};

assert.strictEqual(context.getSensorType(), 'jqbed');
assert.strictEqual(context.getBaudRate(), 230400);
assert.strictEqual(context.getDatabase(), 'sitDb');
assert.strictEqual(context.getDatabase('back'), 'backDb');
assert.strictEqual(context.getDatabase('head'), 'headDb');
assert.strictEqual(context.getNowDate(), 200);
assert.strictEqual(context.isLocalPlayback(), true);

console.log('runtimeContextFactory.test.js passed');
