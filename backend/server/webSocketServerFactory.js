const WebSocket = require('ws');

/**
 * 创建实时数据 WebSocket 服务。
 * 端口保持旧协议兼容：sit=19999、back=19998、head=19997。
 */
function createWebSocketServers({
  sitPort = 19999,
  backPort = 19998,
  headPort = 19997,
} = {}) {
  return {
    sit: new WebSocket.Server({ port: sitPort }),
    back: new WebSocket.Server({ port: backPort }),
    head: new WebSocket.Server({ port: headPort }),
  };
}

module.exports = {
  createWebSocketServers,
};
