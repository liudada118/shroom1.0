/**
 * 后端全部 HTTP 接口的统一响应体。20 个调用点，是一条**前后端契约**。
 *
 * 用法：`new HttpResult(0, data, '')` / `new HttpResult(1, {}, '原因')`。`code` **0 成功 1 失败**、不
 * 细分错误类型；失败时 `data` 一律传 `{}` 而非 null，好让前端 `res.data.data.xxx` 只得到 undefined
 * 而不抛 TypeError。保持 class 只因 20 个调用点都写着 `new`；它没有方法也不该加 —— 加了会在
 * `res.json()` 序列化时丢失。
 *
 * ⚠️ **`message` 会被前端直接显示给用户**（`Title.jsx` 的 `message.error`），等同于 UI 文案：不能带
 * 绝对路径、堆栈或 SQL。这就是 `reportRoutes.js` 只回 `'callPy error'` 这类笼统字符串的原因。
 *
 * ⚠️ **`code` 与 HTTP 状态码不一致**：`controlRoutes.js` 会 `res.status(400/500)` + `code: 1`，而
 * `reportRoutes.js` 一律 200 + `code: 1`。新增路由时**至少要把 `code` 设对**，否则前端会把失败当成功。
 */
class HttpResult {
  /**
   * @param {number} code 0 = 成功，1 = 失败（不是 HTTP 状态码）。
   * @param {object} data 载荷；失败时传 `{}` 而不是 null。
   * @param {string} message 结果说明；失败时会被前端直接显示给用户，不要放路径或堆栈。
   */
  constructor(code, data, message) {
    this.code = code;
    this.data = data;
    this.message = message;
  }
}

module.exports = HttpResult;
