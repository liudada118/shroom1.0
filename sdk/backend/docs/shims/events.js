/**
 * events.js - 浏览器里的极小 EventEmitter
 *
 * **这是文档站的垫片，不是 `@shroom/backend` 的要求。** 包是给 Node 用的，
 * Node 里 `events` 是内置模块。这个文件只为了让 `telemetry/channelBus.js`
 * 能在文档站的浏览器环境里跑起来做活演示。
 *
 * 只实现 `channelBus.js` 真正用到的四个方法（`on` / `off` / `emit` /
 * `removeAllListeners`）—— 故意不做全量兼容：一个假装完整的 EventEmitter
 * 会让人以为在浏览器里用这个包是被支持的。
 *
 * @see ../vite.config.js 里的 alias
 */

export class EventEmitter {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
  }

  on(event, handler) {
    const list = this._listeners.get(event) || [];
    list.push(handler);
    this._listeners.set(event, list);
    return this;
  }

  off(event, handler) {
    const list = this._listeners.get(event);
    if (!list) return this;
    const next = list.filter((item) => item !== handler);
    if (next.length) this._listeners.set(event, next);
    else this._listeners.delete(event);
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list || !list.length) return false;
    // 复制一份再遍历：handler 里调 off() 是常见写法，直接遍历原数组会漏掉后面的。
    [...list].forEach((handler) => handler(...args));
    return true;
  }

  removeAllListeners(event) {
    if (event === undefined) this._listeners.clear();
    else this._listeners.delete(event);
    return this;
  }
}

export default { EventEmitter };
