/**
 * 创建手套分包运行时。
 *
 * 该运行时负责 handGloveFullPacket 和 handGloveDouble 的分包解析、
 * 左右手路由、映射矩阵生成和实时 payload 输出。
 * 零点由统一输出边界按 channelId 应用。
 */
function createHandPacketRuntime({
  fullPacketType,
  doublePacketType,
  parseFullPacket,
  mapFullPacketModelMatrix,
  createDoublePacketParser,
  normalizeFiniteFrame,
  bytes4ToInt10,
  handL,
  handR,
  handRVideo1470506,
  publishSit,
  publishBack,
  getRuntime,
  setRuntime,
}) {
  const doublePacketParser = createDoublePacketParser();

  function getPublishedFrame(publishResult, fields, fallback = []) {
    const prepared = publishResult?.frame;
    for (const field of fields) {
      if (Array.isArray(prepared?.[field]) && prepared[field].length > 0) {
        return [...prepared[field]];
      }
    }
    return Array.isArray(fallback) ? [...fallback] : [];
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
    const mappedFrame = [...packet.mappedData];
    const outputSide = fallbackSide === 'right' ? 'right' : 'left';

    if (outputSide === 'right') {
      const pressureFrame = [...packet.pressureData];
      const renderData = mapFullPacketModelMatrix(mappedFrame);

      const published = publishBack(JSON.stringify({
        backData: renderData,
        realArr,
        rawPressureData: pressureFrame,
        newArr147: mappedFrame,
        mappedArr195: mappedFrame,
        frameIndex: packet.frameIndex,
        packetType: packet.packetType,
        handSide: packet.side,
        outputSide,
        ...buildPortFlags(runtime),
      }));
      setRuntime({
        pointArr2: getPublishedFrame(published, ['rawPressureData'], pressureFrame),
      });
      return true;
    }

    const pressureFrame = [...packet.pressureData];
    const renderData = mapFullPacketModelMatrix(mappedFrame);

    const published = publishSit(JSON.stringify({
      sitData: renderData,
      realArr,
      rawPressureData: pressureFrame,
      newArr147: mappedFrame,
      mappedArr195: mappedFrame,
      frameIndex: packet.frameIndex,
      packetType: packet.packetType,
      handSide: packet.side,
      outputSide,
      ...buildPortFlags(runtime),
    }));
    setRuntime({
      pointArr: getPublishedFrame(published, ['rawPressureData'], pressureFrame),
    });
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
      const rawPressureData = [...realPressureData];
      const mappedSourceFrame = handR([...realPressureData]);
      const pressureSourceFrame = handRVideo1470506([...realPressureData]);
      const mappedData = [...mappedSourceFrame];
      const pressureFrame = [...pressureSourceFrame];

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
      const published = publishBack(JSON.stringify(payload));
      setRuntime({
        pointArr2: getPublishedFrame(published, ['backData'], pressureFrame),
      });
      return true;
    }

    const rawPressureData = [...realPressureData];
    const mappedSourceFrame = handL([...realPressureData]);
    const pressureFrame = [...realPressureData];
    const mappedData = [...mappedSourceFrame];

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
    const published = publishSit(JSON.stringify(payload));
    setRuntime({
      pointArr: getPublishedFrame(published, ['sitData'], pressureFrame),
    });
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
