/**
 * processing 领域聚合入口。
 *
 * 纯计算部分（线序、矩阵、压力、插值、平滑、视频映射、配置化映射、通用数学）
 * 已经搬进 `@shroom/backend/processing`，这里只剩两件事：
 *
 * 1. 转出包里的纯计算层，保住 `require("../processing")` 这个既有出口形状。
 * 2. 拼上 `webStaticServer` —— 它起 http 服务、读打包目录、调 `child_process`，
 *    是 Electron 打包形态专属的，不属于可复用的 SDK 能力，所以留在后端。
 *
 * `webStaticServer` 排在前面是照搬原顺序；它只出 `getContentType` / `openWeb`，
 * 和包里的出口不撞名。
 */
module.exports = {
  ...require('./webStaticServer'),
  ...require('@shroom/backend/processing'),
};
