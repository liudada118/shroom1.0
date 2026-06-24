/**
 * 创建手套分包运行时。
 *
 * 该运行时负责 handGloveFullPacket 和 handGloveDouble 的分包解析、
 * 左右手路由、零点扣除、映射矩阵生成和实时 payload 输出。
 */
function createHandPacketRuntime({
  fullPacketType,
  doublePacketType,
  parseFullPacket,
  mapFullPacketModelMatrix,
  createDoublePacketParser,
  normalizeFiniteFrame,
  bytes4ToInt10,
  numLessZeroToZero,
  handL,
  handR,
  handRVideo1470506,
  publishSit,
  publishBack,
  getRuntime,
  setRuntime,
}) {
  const doublePacketParser = createDoublePacketParser();

  /**
   * 按当前零点帧扣除压力值，并把负数压到 0。
   *
   * @param {number[]} frame 原始或映射后的压力帧。
   * @param {number[]} zeroFrame 零点帧。
   * @returns {number[]} 扣零后的压力帧。
   */
  function subtractZeroFrame(frame, zeroFrame = []) {
    return Array.isArray(zeroFrame) && zeroFrame.length
      ? frame.map((value, index) => numLessZeroToZero(value - (zeroFrame[index] || 0)))
      : frame;
  }

  /**
   * 读取左右串口打开状态，统一附加到实时 payload。
   *
   * @param {object} runtime 当前运行时状态。
   * @returns {{sitFlag:boolean|undefined, backFlag:boolean|undefined}} 串口状态标记。
   */
  function buildPortFlags(runtime) {
    return {
      sitFlag: runtime.port1?.isOpen,
      backFlag: runtime.port2?.isOpen,
    };
  }

  /**
   * 处理完整手套包，按左右手分别写回状态并推送到对应通道。
   *
   * @param {Buffer|Uint8Array|number[]} buffer 完整手套协议包。
   * @param {'left'|'right'} fallbackSide 包内没有明确侧别时使用的默认侧。
   * @returns {boolean} 当前包是否被完整手套协议消费。
   */
  function handleFullPacket(buffer, fallbackSide) {
    const runtime = getRuntime();
    if (runtime.file !== fullPacketType) return false;

    const packet = parseFullPacket(buffer, fallbackSide);
    if (!packet) return false;

    const realArr = [...packet.pressureData];
    let mappedFrame = [...packet.mappedData];
    const outputSide = fallbackSide === 'right' ? 'right' : 'left';

    if (outputSide === 'right') {
      const zeroedPressure = subtractZeroFrame([...packet.pressureData], runtime.pointArr2zero);
      const mappedSourceFrame = [...mappedFrame];
      mappedFrame = subtractZeroFrame(mappedSourceFrame, runtime.pointArr147zero_2);
      const renderData = mapFullPacketModelMatrix(mappedFrame);

      setRuntime({
        pointArr2: zeroedPressure,
        pointArr2zeroData: [...packet.pressureData],
        pointArr2RawZeroData: [...packet.pressureData],
        newArr147_2: mappedSourceFrame,
      });

      publishBack(JSON.stringify({
        backData: renderData,
        realArr,
        rawPressureData: zeroedPressure,
        newArr147: mappedFrame,
        mappedArr195: mappedFrame,
        frameIndex: packet.frameIndex,
        packetType: packet.packetType,
        handSide: packet.side,
        outputSide,
        ...buildPortFlags(runtime),
      }));
      return true;
    }

    const zeroedPressure = subtractZeroFrame([...packet.pressureData], runtime.pointArr1zero);
    const mappedSourceFrame = [...mappedFrame];
    mappedFrame = subtractZeroFrame(mappedSourceFrame, runtime.pointArr147zero);
    const renderData = mapFullPacketModelMatrix(mappedFrame);

    setRuntime({
      pointArr: zeroedPressure,
      pointArr1zeroData: [...packet.pressureData],
      pointArr1RawZeroData: [...packet.pressureData],
      newArr147: mappedSourceFrame,
    });

    publishSit(JSON.stringify({
      sitData: renderData,
      realArr,
      rawPressureData: zeroedPressure,
      newArr147: mappedFrame,
      mappedArr195: mappedFrame,
      frameIndex: packet.frameIndex,
      packetType: packet.packetType,
      handSide: packet.side,
      outputSide,
      ...buildPortFlags(runtime),
    }));
    return true;
  }

  /**
   * 把双包协议拼出的完整压力帧路由到左手或右手输出。
   *
   * @param {object} frame 手套双包解析后的完整帧。
   * @param {number[]} frame.pressureData 压力点数据。
   * @param {number[]} [frame.imuBytes] 姿态原始字节。
   * @param {'left'|'right'} [frame.outputSide] 输出侧。
   * @param {'sit'|'back'} [frame.sourcePort] 来源串口。
   * @returns {boolean} 是否成功输出。
   */
  function routeDoubleFrame({ pressureData, imuBytes = [], outputSide = 'left', sourcePort = 'sit' }) {
    const runtime = getRuntime();
    const realPressureData = normalizeFiniteFrame(pressureData, 256);
    const rotate = bytes4ToInt10(imuBytes);
    const isRight = outputSide === 'right';

    if (isRight) {
      const rawPressureData = Array.isArray(runtime.pointArr2RawZero) && runtime.pointArr2RawZero.length
        ? realPressureData.map((value, index) => numLessZeroToZero(value - (runtime.pointArr2RawZero[index] || 0)))
        : [...realPressureData];
      const mappedSourceFrame = handR([...realPressureData]);
      const pressureSourceFrame = handRVideo1470506([...realPressureData]);
      let mappedData = subtractZeroFrame(mappedSourceFrame, runtime.pointArr147zero_2);
      const pressureFrame = subtractZeroFrame(pressureSourceFrame, runtime.pointArr2zero);

      setRuntime({
        pointArr2: pressureFrame,
        pointArr2RawZeroData: [...realPressureData],
        pointArr2zeroData: pressureSourceFrame,
        newArr147_2: mappedSourceFrame,
      });

      const payload = {
        backData: pressureFrame,
        realArr: realPressureData,
        rawPressureData,
        newArr147: mappedData,
        handSide: 'right',
        packetSourcePort: sourcePort,
        ...buildPortFlags(runtime),
      };
      if (rotate.length && !rotate.every((value) => value == 0)) {
        payload.rotate = rotate;
      }
      publishBack(JSON.stringify(payload));
      return true;
    }

    const rawPressureData = Array.isArray(runtime.pointArr1RawZero) && runtime.pointArr1RawZero.length
      ? realPressureData.map((value, index) => numLessZeroToZero(value - (runtime.pointArr1RawZero[index] || 0)))
      : [...realPressureData];
    const mappedSourceFrame = handL([...realPressureData]);
    let pressureFrame = [...realPressureData];
    const mappedData = subtractZeroFrame(mappedSourceFrame, runtime.pointArr147zero);
    pressureFrame = subtractZeroFrame(pressureFrame, runtime.pointArr1zero);

    setRuntime({
      pointArr: pressureFrame,
      pointArr1RawZeroData: [...realPressureData],
      pointArr1zeroData: [...realPressureData],
      newArr147: mappedSourceFrame,
    });

    const payload = {
      sitData: pressureFrame,
      realArr: realPressureData,
      rawPressureData,
      newArr147: mappedData,
      handSide: 'left',
      packetSourcePort: sourcePort,
      ...buildPortFlags(runtime),
    };
    if (rotate.length && !rotate.every((value) => value == 0)) {
      payload.rotate = rotate;
    }
    publishSit(JSON.stringify(payload));
    return true;
  }

  /**
   * 处理手套双包协议单段数据；未拼齐时只缓存，拼齐后输出完整帧。
   *
   * @param {Buffer|Uint8Array|number[]} buffer 串口 parser 输出的数据段。
   * @param {'left'|'right'} fallbackSide 默认侧。
   * @param {'sit'|'back'} sourcePort 来源串口。
   * @returns {boolean} 当前包是否被手套双包协议消费。
   */
  function handleDoublePacket(buffer, fallbackSide, sourcePort) {
    const runtime = getRuntime();
    if (runtime.file !== doublePacketType) return false;

    const frame = doublePacketParser.handlePacket(buffer, fallbackSide, sourcePort);
    if (!frame) return false;
    if (!frame.complete) return true;

    return routeDoubleFrame({
      pressureData: frame.pressureData,
      imuBytes: frame.imuBytes,
      outputSide: frame.side,
      sourcePort: frame.sourcePort,
    });
  }

  return {
    handleDoublePacket,
    handleFullPacket,
    routeDoubleFrame,
  };
}

module.exports = {
  createHandPacketRuntime,
};
