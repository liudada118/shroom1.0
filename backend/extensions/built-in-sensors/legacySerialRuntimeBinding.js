const { createLegacySerialFrameRuntime } = require('./legacySerialFrameRuntime');
const { bindSerialSensorRuntimes } = require('./bindSerialSensorRuntimes');
const { createSensorRuntimeRegistry } = require('./sensorRuntimeRegistry');

/**
 * 遗留串口 runtime 绑定工厂。
 *
 * 负责把 legacySerialFrameRuntime 创建、五路串口 handler 注册和 serialParserManager 绑定
 * 从 server.js 中移出。server.js 暂时仍提供旧状态 accessor，后续可继续把 accessor 迁入集中 runtimeState。
 */
function createLegacySerialRuntimeBinding({
  accessors = {},
  baseContext = {},
  serialParserManager,
}) {
  if (!serialParserManager) {
    throw new Error('serialParserManager is required for legacy serial runtime binding');
  }

  const context = { ...baseContext };
  Object.defineProperties(context, accessors);

  const legacySerialFrameRuntime = createLegacySerialFrameRuntime(context);

  const sensorRuntimeRegistry = createSensorRuntimeRegistry()
    .register('sit', legacySerialFrameRuntime.handleSitSerialFrame)
    .register('smallBed12B', legacySerialFrameRuntime.handleSmallBed12BSerialFrame)
    .register('back', legacySerialFrameRuntime.handleBackSerialFrame)
    .register('bigBedSit', legacySerialFrameRuntime.handleBigBedSitSerialFrame)
    .register('head', legacySerialFrameRuntime.handleHeadSerialFrame);

  bindSerialSensorRuntimes({
    serialParserManager,
    handlers: sensorRuntimeRegistry.getSerialHandlers(),
  });

  return {
    context,
    legacySerialFrameRuntime,
    sensorRuntimeRegistry,
  };
}

module.exports = {
  createLegacySerialRuntimeBinding,
};
