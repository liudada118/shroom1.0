/**
 * 串口 parser 通道绑定模块。
 *
 * server.js 只负责提供各通道处理函数，本模块集中维护
 * serialParserManager.channels 与业务处理器之间的对应关系。
 */

/**
 * 绑定串口 parser 通道和传感器运行时处理函数。
 * @param {{serialParserManager: object, handlers?: object}} options 绑定参数。
 * @returns {{name:string, channel:string}[]} 已绑定的通道列表。
 */
function bindSerialSensorRuntimes({ serialParserManager, handlers = {} }) {
  if (!serialParserManager?.channels) {
    throw new Error('serialParserManager with channels is required');
  }

  const channels = serialParserManager.channels;
  const bindings = [
    ['sit', channels.SIT, handlers.handleSitFrame],
    ['smallBed12B', channels.SMALL_BED_12B, handlers.handleSmallBed12BFrame],
    ['back', channels.BACK, handlers.handleBackFrame],
    ['bigBedSit', channels.BIG_BED_SIT, handlers.handleBigBedSitFrame],
    ['head', channels.HEAD, handlers.handleHeadFrame],
  ];

  bindings.forEach(([name, channel, handler]) => {
    if (typeof handler !== 'function') {
      throw new Error(`missing serial runtime handler: ${name}`);
    }
    serialParserManager.onData(channel, handler);
  });

  return bindings.map(([name, channel]) => ({ name, channel }));
}

module.exports = {
  bindSerialSensorRuntimes,
};
