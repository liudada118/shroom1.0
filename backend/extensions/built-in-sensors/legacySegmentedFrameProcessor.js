/**
 * 遗留分片压力帧处理器。
 *
 * 负责 130/142 字节首包与 146/158 字节尾包组成的旧协议压力帧。
 * 这里集中处理分片合并、手/足/眼部线序映射和实时 payload 构造。
 * 零点由统一输出边界按 channelId 应用。
 */
function createLegacySegmentedFrameProcessor({
  bytes4ToInt10,
  footL,
  footR,
  footVideo,
  footVideo1,
  handL,
  handR,
  handRVideo1470506,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  isHandGloveType,
}) {
  const SMALL_SAMPLE_SENSOR_TO_BYTE_INDEX = [
    223, 222, 221, 220, 219, 218, 217, 216, 215, 214,
    239, 238, 237, 236, 235, 234, 233, 232, 231, 230,
    255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
    31, 30, 29, 28, 27, 26, 25, 24, 23, 22,
    207, 206, 205, 204, 203, 202, 201, 200, 199, 198,
    191, 190, 189, 188, 187, 186, 185, 184, 183, 182,
    175, 174, 173, 172, 171, 170, 169, 168, 167, 166,
    159, 158, 157, 156, 155, 154, 153, 152, 151, 150,
    143, 142, 141, 140, 139, 138, 137, 136, 135, 134,
  ];

  /**
   * 将 Buffer/Uint8Array 按无符号字节读取成普通数组。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @returns {number[]} 字节数组。
   */
  function readUInt8Frame(data) {
    const buffer = Buffer.from(data);
    const frame = new Array(buffer.length);
    for (let index = 0; index < buffer.length; index++) {
      frame[index] = buffer.readUInt8(index);
    }
    return frame;
  }

  /**
   * 解析旧分片帧，去掉前 2 字节包头，并可取出末尾 16 字节 IMU。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @param {boolean} withImu 是否从尾部拆出 IMU 字节。
   * @returns {{order: number, type: number, payload: number[], imuBytes: number[]}} 分片内容。
   */
  function parseSegment(data, withImu = false) {
    const bytes = readUInt8Frame(data);
    const order = bytes[0];
    const type = bytes[1];
    const payload = bytes.slice(2);
    const imuBytes = withImu ? payload.splice(payload.length - 16, 16) : [];
    return { order, type, payload, imuBytes };
  }

  /**
   * 映射 smallSample 的 100 个有效采样点。
   * @param {number[]} frame 原始 256 点压力帧。
   * @returns {number[]} smallSample 100 点矩阵。
   */
  function mapSmallSample(frame) {
    return SMALL_SAMPLE_SENSOR_TO_BYTE_INDEX.map((index) => frame[index] || 0);
  }

  /**
   * 左眼旧线序映射。
   * @param {number[]} frame 原始 256 点压力帧。
   * @returns {number[]} 左眼显示矩阵。
   */
  function mapLeftEye(frame) {
    const wsPointData = [...frame];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 16; col++) {
        [wsPointData[(7 - row) * 16 + col], wsPointData[row * 16 + col]] =
          [wsPointData[row * 16 + col], wsPointData[(7 - row) * 16 + col]];
      }
    }
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 16; col++) {
        [wsPointData[(8 + 7 - row) * 16 + col], wsPointData[(8 + row) * 16 + col]] =
          [wsPointData[(8 + row) * 16 + col], wsPointData[(8 + 7 - row) * 16 + col]];
      }
    }
    const order = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0];
    const mapped = [];
    for (let row = 0; row < 16; row++) {
      for (const col of order) {
        mapped.push(wsPointData[row * 16 + col]);
      }
    }
    return mapped;
  }

  /**
   * 右眼旧线序映射。
   * @param {number[]} frame 原始 256 点压力帧。
   * @returns {number[]} 右眼显示矩阵。
   */
  function mapRightEye(frame) {
    let wsPointData = [...frame];
    const lastArr = wsPointData.splice(128, 128);
    wsPointData = lastArr.concat(wsPointData);
    const order = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse();
    const mapped = [];
    for (let row = 0; row < 16; row++) {
      for (const col of order) {
        mapped.push(wsPointData[row * 16 + col]);
      }
    }
    return mapped;
  }

  /**
   * 缓存左路首包。
   * @param {Buffer | Uint8Array | number[]} data 原始 130/142 字节首包。
   * @returns {{firstData: number[]}} 左路首包缓存。
   */
  function processLeftFirstSegment(data) {
    return { firstData: parseSegment(data).payload };
  }

  /**
   * 处理左路 146/158 字节尾包并生成 SIT payload。
   * @param {Buffer | Uint8Array | number[]} data 原始尾包。
   * @param {object} context 当前运行时上下文。
   * @returns {object} 更新后的运行时状态和 JSON payload。
   */
  function processLeftSecondSegment(data, context) {
    const { payload, imuBytes } = parseSegment(data, true);
    const realArr = [...(context.firstData || []), ...payload];
    let pressureFrame = [...realArr];
    let mappedFrame = [];

    if (context.file === 'handVideo1') {
      mappedFrame = handVideoRealPoint_0506_3([...pressureFrame]);
      pressureFrame = handVideo1_0416_0506(pressureFrame);
    } else if (context.file === 'footVideo') {
      mappedFrame = footL(pressureFrame);
      pressureFrame = footVideo(pressureFrame);
    } else if (String(context.file || '').includes('robot')) {
      mappedFrame = [...pressureFrame];
    } else if (context.file === 'smallSample') {
      pressureFrame = mapSmallSample(pressureFrame);
      mappedFrame = [...pressureFrame];
    } else if (context.file === 'hand0507' || isHandGloveType(context.file) || context.file === 'Num3D') {
      mappedFrame = handL([...pressureFrame]);
    } else if (context.file === 'eye') {
      mappedFrame = mapLeftEye(pressureFrame);
      pressureFrame = [...mappedFrame];
    } else if (context.file === 'daliegu') {
      mappedFrame = [...pressureFrame];
    }

    const rawPressureData = [...realArr];
    const pressureData = [...pressureFrame];
    const mappedData = [...mappedFrame];
    const rotate = bytes4ToInt10(imuBytes);
    const payloadObj = {
      sitData: pressureData,
      realArr,
      rawPressureData: context.rawPressureMode === 'pressure' ? pressureData : rawPressureData,
      newArr147: mappedData,
      sitFlag: context.port1?.isOpen,
      backFlag: context.port2?.isOpen,
    };
    if (!rotate.every((value) => value == 0)) payloadObj.rotate = rotate;
    if (mappedData.length) payloadObj.newArr147 = mappedData;

    return {
      firstData: context.firstData || [],
      lastData: payload,
      pointArr: pressureData,
      jsonData: JSON.stringify(payloadObj),
    };
  }

  /**
   * 处理右路 130 字节分片；order=1 时只缓存首包，其他 order 直接生成 BACK payload。
   * @param {Buffer | Uint8Array | number[]} data 原始分片。
   * @param {object} context 当前运行时上下文。
   * @returns {object} 分片处理结果。
   */
  function processBack130Segment(data, context) {
    const { order, payload } = parseSegment(data);
    if (order == 1) return { firstData: payload };

    const realArr = [...(context.firstData || []), ...payload];
    let mappedFrame = [];
    let pressureFrame = [...realArr];
    if (context.file === 'hand0507' || isHandGloveType(context.file)) {
      mappedFrame = handR(pressureFrame);
      pressureFrame = handRVideo1470506(pressureFrame);
    } else {
      pressureFrame = footVideo1(pressureFrame);
    }
    const rawPressureData = [...realArr];
    const payloadObj = {
      backData: [...pressureFrame],
      realArr,
      rawPressureData,
      sitFlag: context.port1?.isOpen,
      backFlag: context.port2?.isOpen,
    };
    if (mappedFrame.length) payloadObj.newArr147 = mappedFrame;
    return {
      lastData: payload,
      pointArr: pressureFrame,
      jsonData: JSON.stringify(payloadObj),
    };
  }

  /**
   * 处理 BACK/HEAD 146 字节尾包。
   * @param {Buffer | Uint8Array | number[]} data 原始尾包。
   * @param {object} context 当前运行时上下文。
   * @returns {object} 更新后的运行时状态和 JSON payload。
   */
  function processRightSecondSegment(data, context) {
    const { payload, imuBytes } = parseSegment(data, true);
    const realArr = [...(context.firstData || []), ...payload];
    let pressureFrame = [...realArr];
    let mappedFrame = [];

    if (context.file === 'footVideo') {
      mappedFrame = footR(pressureFrame);
      pressureFrame = footVideo1(pressureFrame);
    } else if (context.file === 'hand0507' || isHandGloveType(context.file)) {
      mappedFrame = handR(pressureFrame);
      pressureFrame = handRVideo1470506(pressureFrame);
    } else if (context.file === 'eye') {
      mappedFrame = mapRightEye(pressureFrame);
      pressureFrame = [...mappedFrame];
    }

    const rawPressureData = [...realArr];
    const pressureData = [...pressureFrame];
    const mappedData = [...mappedFrame];
    const rotate = bytes4ToInt10(imuBytes);
    const dataKey = context.channel === 'head' ? 'headData' : 'backData';
    const payloadObj = {
      [dataKey]: pressureData,
      realArr,
      rawPressureData: context.channel === 'head' ? pressureData : rawPressureData,
      newArr147: mappedData,
      sitFlag: context.port1?.isOpen,
      backFlag: context.port2?.isOpen,
    };
    if (!rotate.every((value) => value == 0)) payloadObj.rotate = rotate;
    if (mappedData.length) payloadObj.newArr147 = mappedData;

    return {
      lastData: payload,
      pressureData,
      jsonData: JSON.stringify(payloadObj),
    };
  }

  /**
   * 处理 HEAD 130 字节分片。
   * @param {Buffer | Uint8Array | number[]} data 原始分片。
   * @param {object} context 当前运行时上下文。
   * @returns {object} 分片处理结果。
   */
  function processHead130Segment(data, context) {
    const { order, payload } = parseSegment(data);
    if (order == 1) return { firstData: payload };

    let pressureFrame = [...(context.firstData || []), ...payload];
    pressureFrame = footVideo1(pressureFrame);
    return {
      lastData: payload,
      pointArr: pressureFrame,
      jsonData: JSON.stringify({
        headData: [...pressureFrame],
        sitFlag: context.port1?.isOpen,
        backFlag: context.port2?.isOpen,
      }),
    };
  }

  return {
    processBack130Segment,
    processHead130Segment,
    processLeftFirstSegment,
    processLeftSecondSegment,
    processRightSecondSegment,
  };
}

module.exports = {
  createLegacySegmentedFrameProcessor,
};
