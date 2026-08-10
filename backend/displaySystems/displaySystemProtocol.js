/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/protocol/displaySystemProtocol.js`。
 *
 * protocol 段的 schema、归一化、校验和一帧字节的解码；串口预设和 manifest 复用的是同一套。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/protocol/displaySystemProtocol.js');
