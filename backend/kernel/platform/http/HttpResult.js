/**
 * 后端全部 HTTP 接口的统一响应体。20 个调用点，是一条**前后端契约**。
 *
 * 三个字段的约定（照全部调用点归纳，不是设计文档）：
 * - `code` —— **0 成功，1 失败**。不是 HTTP 状态码，也不细分错误类型。
 * - `data` —— 成功时的载荷；**失败时一律传 `{}` 而不是 null**，这样前端
 *   `res.data.data.xxx` 只会得到 undefined 而不是抛 TypeError。
 * - `message` —— 失败原因。
 *
 * ⚠️ **`message` 会被前端直接显示给用户**（`Title.jsx` 里
 * `message.error({content: res.data?.message})`），所以往这里放的字符串等同于 UI 文案：
 * 不能带绝对路径、堆栈或 SQL。这正是 `reportRoutes.js` 只回 `'callPy error'`
 * 这类笼统字符串、把细节留在日志里的原因。
 *
 * ⚠️ **`code` 与 HTTP 状态码不一致，前端必须看 `code`。**
 * 两批路由的做法不同：`controlRoutes.js` 会 `res.status(400/500)` 再带 `code: 1`，
 * 而 `reportRoutes.js` 一律回 HTTP 200 + `code: 1`（报告生成失败不算传输层错误）。
 * 前端 `Title.jsx` 因此写的是 `res.status !== 200 || res.data?.code !== 0` ——
 * 两个都判。新增路由时**必须至少把 `code` 设对**，否则前端会把失败当成功。
 *
 * 保持 class 而不是改成普通对象字面量，纯粹是因为 20 个调用点都写着 `new HttpResult(...)`；
 * 它没有任何方法，也不该加 —— 加了会在 `res.json()` 序列化时丢失，是个陷阱。
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
