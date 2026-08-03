/**
 * vitest.setup.js - 测试环境的浏览器全局垫片
 *
 * 存在的原因：src/assets/util/util.js 在模块顶层就读取 localStorage
 * （initValue 常量，见 util.js:1323），因此该模块在 node 环境下一 import
 * 就抛 ReferenceError。util.js 被 55 个场景组件依赖，直接改动风险高，
 * 这里先用垫片把测试通路打开。
 *
 * 后续把 initValue 改成惰性求值之后，这个垫片里的 localStorage 部分
 * 就可以删掉了。
 */

/**
 * 创建符合 Storage 接口的内存实现。
 *
 * 用 Map 而不是普通对象，避免 key 与 Object.prototype 上的属性名冲突
 * （例如用户数据里出现 "constructor" 这种 key）。
 *
 * @returns {Storage} 内存版 Storage。
 */
function createMemoryStorage() {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key) {
      const value = store.get(String(key));
      return value === undefined ? null : value;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createMemoryStorage();
}

if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createMemoryStorage();
}
