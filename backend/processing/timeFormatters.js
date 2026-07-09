/**
 * 格式化为旧前端和 CSV 使用的时间字符串。
 *
 * 保持旧 openWeb.js 行为：月份和日期不强制补零，毫秒小于 10 时补一个 0。
 *
 * @param {number|string|Date} data 可传给 Date 的时间值。
 * @returns {string} 形如 `2026/7/7 09:08:07:03` 的时间字符串。
 */
function timeStampToDate(data) {
  const date = new Date(data);
  const Y = `${date.getFullYear()}/`;
  const M = `${date.getMonth() + 1}/`;
  const D = `${date.getDate()} `;
  const h = `${date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()}:`;
  const m = `${date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()}:`;
  const s = `${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}:`;
  const us = date.getMilliseconds() < 10 ? `0${date.getMilliseconds()}` : date.getMilliseconds();
  return Y + M + D + h + m + s + us;
}

/**
 * 格式化为文件名友好的旧时间字符串。
 *
 * @param {number|string|Date} data 可传给 Date 的时间值。
 * @returns {string} 形如 `2026-7-7 09-08-07` 的时间字符串。
 */
function timeStampTo_Date(data) {
  const date = new Date(data);
  const Y = `${date.getFullYear()}-`;
  const M = `${date.getMonth() + 1}-`;
  const D = `${date.getDate()} `;
  const h = `${date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()}-`;
  const m = `${date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()}-`;
  const s = date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds();
  return Y + M + D + h + m + s;
}

/**
 * 格式化为旧代码使用的紧凑数字时间。
 *
 * 保留旧实现的隐式加法行为：当月份、小时、分钟、秒均不需要补零时，返回值可能是
 * number；存在任一补零字符串时，返回值会变成 string。
 *
 * @param {number|string|Date} data 可传给 Date 的时间值。
 * @returns {number|string} 紧凑时间值。
 */
function timeStampToDateNum(data) {
  const date = new Date(data);
  const Y = date.getFullYear();
  const M = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
  const D = date.getDate();
  const h = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
  const m = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
  const s = date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds();
  return Y + M + D + h + m + s;
}

module.exports = {
  timeStampTo_Date,
  timeStampToDate,
  timeStampToDateNum,
};
