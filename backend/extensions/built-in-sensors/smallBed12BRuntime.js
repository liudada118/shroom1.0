/**
 * 小床 12B 串口运行时。
 *
 * 该模块只负责小床 12B 的实时串口帧处理：原始 buffer 解析、压力值标定、
 * 运行时状态同步和实时通道输出。零点按 channelId 在 decoded 阶段、标定前应用。
 * 但 onData 回调不再承载具体业务逻辑。
 */

/**
 * 创建小床 12B 串口运行时。
 * @param {object} options 运行时依赖。
 * @returns {{handleFrame: Function}} 小床 12B runtime。
 */
function createSmallBed12BRuntime({
  smallBed12B,
  sensorType,
  getSensorType,
  getLineOrder,
  zeroStateStore,
  resolveChannelIdentity,
  calibration,
  getDisplayOptions,
  getHz,
  transposeSquareMatrix,
  getNowDate,
  getEndDate,
  setCurrentPressureFrame,
  setCurrentDisplayData,
  sendSitFrame,
}) {
  /**
   * 减零点后的截负钩子：负值和非数一律归 0。
   *
   * 作为 `subtractZero` 传给 `smallBed12B.buildRealtimeFrameFromBuffer`，
   * 在 decoded 阶段、压力标定**之前**逐点作用。截负是必须的：零点基线取自
   * 空载采样，实测帧低于基线是正常噪声，负压力值往下游会污染标定（均值被拉低）
   * 并让配色映射跑到色阶之外。非有限值归 0 而不是丢弃，是为了保持帧长不变 ——
   * 长度一变，后续按索引取点的映射全错位。
   *
   * @param {*} value 减去零点后的单点值。
   * @returns {number} 截到 0 以上的有限数。
   */
  function clampZero(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  }

  /**
   * 处理一帧小床 12B 串口数据。
   *
   * @param {Buffer|number[]|Uint8Array} data 串口 parser 输出的原始帧数据。
   * @returns {boolean} 是否成功生成并发送实时帧。
   */
  function handleFrame(data) {
    const identity = typeof resolveChannelIdentity === 'function'
      ? resolveChannelIdentity('sit')
      : null;
    const channelId = String(identity?.channelId || '').trim();
    const zeroFrame = channelId && typeof zeroStateStore?.getBaseline === 'function'
      ? zeroStateStore.getBaseline(channelId, 'decoded')
      : [];
    const frame = smallBed12B.buildRealtimeFrameFromBuffer(Buffer.from(data), {
      lineOrder: getLineOrder(),
      zeroFrame,
      subtractZero: clampZero,
      calibration,
      displayOptions: getDisplayOptions(),
      hz: getHz(),
      transposeSquareMatrix,
    });

    if (!(getNowDate() < getEndDate() && getSensorType() === sensorType && frame)) {
      return false;
    }

    // 小床 12B 的零点定义在有线序的 ADC 阶段，必须先扣零再进入依赖
    // 全帧 adcAvg 的非线性压力标定。不能在统一输出层对 kPa/降采样结果相减。
    if (channelId && typeof zeroStateStore?.updateSources === 'function') {
      zeroStateStore.updateSources(channelId, {
        decoded: frame.orderedFrame,
      }, identity);
    }

    const realtimeFrame = channelId
      ? {
        ...frame.realtimeFrame,
        channelId,
        displaySystemId: identity.displaySystemId,
        sensorId: identity.sensorId,
        sensorType: identity.sensorType,
        outputChannel: identity.outputChannel || 'sit',
        runtimeSource: 'legacy',
        zeroApplied: true,
        rawData: Array.isArray(frame.orderedFrame) ? [...frame.orderedFrame] : [],
      }
      : frame.realtimeFrame;

    setCurrentPressureFrame(frame.pressureData);
    setCurrentDisplayData([...frame.pressureData]);
    sendSitFrame(JSON.stringify(realtimeFrame));
    return true;
  }

  return {
    handleFrame,
  };
}

module.exports = {
  createSmallBed12BRuntime,
};
