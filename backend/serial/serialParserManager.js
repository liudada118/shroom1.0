/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/serial/serialParserManager.js`。
 *
 * 命名 parser 通道；createParserFromProtocol 把 protocol 声明变成切帧器。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/serial/serialParserManager.js');
