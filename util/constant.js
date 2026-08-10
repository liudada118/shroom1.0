/**
 * 兼容壳：手部点位表已经搬进 `@shroom/backend`。
 *
 * 真实数据在 `sdk/backend/processing/lineOrderDefinitions/handArrays.js`，
 * 它是 `handR` / `handL` / `handRVideo1470506` 这几条线序的点位来源。
 * 这里只剩一个转出，给还没迁走的 `backend/legacy/openWeb.js` 用。
 */
module.exports = require('@shroom/backend/processing/lineOrderDefinitions/handArrays.js');
