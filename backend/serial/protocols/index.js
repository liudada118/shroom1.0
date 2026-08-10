/**
 * 兼容壳：本模块已经搬进 `@shroom/backend`，真实实现在 `sdk/backend/protocol/presets/index.js`。
 *
 * 内置串口协议预设的加载，含用户目录同 id 覆盖。预设 JSON 和逐字节说明的 md 都跟着搬到了 sdk/backend/protocol/presets/。
 *
 * 新代码请直接写包名 `require('@shroom/backend/...')`；这里保留只是为了让现有调用点不用改。
 */
module.exports = require('@shroom/backend/protocol/presets/index.js');
