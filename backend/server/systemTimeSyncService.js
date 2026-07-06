const DEFAULT_SYSTEM_TIME_URL = 'http://sensor.bodyta.com:8080/rcv/login/getSystemTime';

/**
 * 从远端时间服务同步当前系统时间。
 *
 * 该服务只负责一次性拉取时间并回写运行时状态；调用方决定把时间保存到哪里。
 *
 * @param {object} options 依赖和配置。
 * @param {object} options.http Node.js http 模块。
 * @param {object} options.logger 日志对象。
 * @param {(timestamp: number) => void} options.setNowDate 写回当前时间戳。
 * @param {string} [options.url] 时间服务地址。
 * @returns {import('http').ClientRequest | null} HTTP 请求对象，便于测试或上层取消。
 */
function syncSystemTime({
  http,
  logger,
  setNowDate,
  url = DEFAULT_SYSTEM_TIME_URL,
}) {
  if (!http || typeof http.get !== 'function') {
    throw new Error('http.get is required for syncSystemTime');
  }
  if (typeof setNowDate !== 'function') {
    throw new Error('setNowDate is required for syncSystemTime');
  }

  const request = http.get(url, {
    headers: { 'content-type': 'application/json; charset=utf-8;' },
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const body = JSON.parse(data);
        const timestamp = Number.parseInt(body.time, 10);
        if (Number.isFinite(timestamp)) {
          setNowDate(timestamp);
          logger?.debug?.(timestamp, 'system time synced');
        }
      } catch (error) {
        logger?.warn?.('Failed to parse system time response', error);
      }
    });
  });

  request.on('error', (error) => {
    logger?.warn?.('Failed to get system time', error);
  });

  return request;
}

module.exports = {
  DEFAULT_SYSTEM_TIME_URL,
  syncSystemTime,
};
