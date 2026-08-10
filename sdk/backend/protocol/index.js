/**
 * `@shroom/backend/protocol` - 串口协议声明层
 *
 * 只用 `fs`/`path` 读预设目录，没有串口依赖 —— 没插硬件也能加载。
 *
 * ## 一套 schema，两个用处
 *
 * `displaySystemProtocol.js` 定义的 `protocol` 段（波特率 / 分帧 / 解码 / 校验）
 * **不是两套格式**：展示系统 manifest 里的 `protocol` 和 `presets/*.json` 里的
 * `protocol` 是同一个东西，所以预设可以整段复制进 `display-system.json`，
 * 中间不需要任何转换层。
 *
 * - `normalizeProtocolConfig()` / `validateProtocolConfig()`：归一化和校验。
 * - `decodeProtocolValues()` / `validateFrame()` / `computeChecksum()`：一帧字节 → 数值数组。
 * - `loadSerialProtocolPresets()`：加载内置 10 份预设，并让
 *   `<runtimeWritableRoot>/serial-protocols/*.json` 里同 id 的用户预设覆盖内置。
 *   打包之后用户不用重新构建就能加协议。
 *
 * 每份预设旁边有一份同名 `.md` 讲清楚一帧里每个字节是什么，见 `presets/README.md`。
 *
 * 要把 `protocol` 变成真正的切帧器，用 `@shroom/backend/serial` 的
 * `createParserFromProtocol()`（那一层才需要 `@serialport/parser-delimiter`）。
 */
module.exports = {
  ...require('./displaySystemProtocol'),
  ...require('./presets'),
};
