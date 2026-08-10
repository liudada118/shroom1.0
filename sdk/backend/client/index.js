/**
 * `@shroom/backend/client` - 连一个已经跑起来的后端
 *
 * peer: `ws`（懒加载，只在 `connectRealtime()` 时才 require）。
 *
 * 这一层和包里其它层的方向是**反的**：其它层是「自己就是后端」，这一层是
 * 「别人是后端，我是客户端」。控制走 HTTP，实时数据走 WebSocket 订阅，
 * 路由和命令格式全部从 `GET /api/sdk/contract` 拿，不硬编码。
 *
 * ```js
 * const client = new BackendSdkClient({
 *   httpBaseUrl: 'http://127.0.0.1:19245',
 *   wsUrl: 'ws://127.0.0.1:19999',
 * });
 * await client.getContract();
 * client.on('frame', (frame) => console.log(frame.channelId, frame.value?.length));
 * client.connectRealtime({ channels: ['sit'] });
 * ```
 *
 * `listBackendOperations()` 列出后端全部可用操作，用来对照自己还缺哪块。
 */
module.exports = {
  ...require('./BackendSdkClient'),
  ...require('./BackendCommandRouter'),
  ...require('./backendOperations'),
};
