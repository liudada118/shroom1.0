/**
 * 创建 SIT 1024 字节矩阵帧处理器。
 *
 * 该处理器负责旧 SIT onData 中最常见的 32x32 单帧矩阵链路：
 * 原始字节读取 -> 传感器线序转换 -> 实时 payload 构造。
 * 零点由统一输出边界按 channelId 应用。
 * 串口事件绑定、运行时状态写回和通道输出由 server.js 负责。
 */
function createSit1024FrameProcessor(deps) {
  const {
    HAND_SINGLE_POINT_TYPE,
    MINZHEN_TYPE,
    WHOLE_CHAIR_TYPE,
    arrToRealLine,
    car10Sit,
    carCol,
    carSitLine,
    carYLine,
    endiSit1024,
    gloves,
    gloves1,
    gloves2,
    handBlue,
    handSinglePoint,
    isCar,
    isPetCareSystem,
    isSmallBedMatrixType,
    jqbed,
    matColLine,
    maskMinzhenMatrixValues,
    newHand,
    normalizeWholeChairFrame,
    press6sit,
    pressNew1220,
    pressNew12203131,
    rect,
    short,
    sit10Line,
    sit100Line,
    smallBed1,
    smallM1,
    tempFullBed,
    wowSitLine,
    xiyueReal1,
    yanfeng10sit,
  } = deps;

  /**
   * 将 1024 字节 Buffer 转成普通数值数组。
   *
   * @param {Buffer|Uint8Array|number[]} buffer 原始串口帧。
   * @returns {number[]} 逐点压力值。
   */
  function readUInt8Frame(buffer) {
    const frame = new Array(buffer.length);
    for (let index = 0; index < buffer.length; index++) {
      frame[index] = buffer.readUInt8(index);
    }
    return frame;
  }

  /**
   * 按 32x32 矩阵逐行左右镜像，用于适配部分坐垫传感器安装方向。
   *
   * @param {number[]} frame 32x32 矩阵展开数组。
   * @returns {number[]} 原地镜像后的数组。
   */
  function mirrorSitRows(frame) {
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 16; col++) {
        [frame[row * 32 + col], frame[row * 32 + 31 - col]] =
          [frame[row * 32 + 31 - col], frame[row * 32 + col]];
      }
    }
    return frame;
  }

  /**
   * 根据当前传感器类型应用对应线序、矩阵方向和设备专用归一化逻辑。
   *
   * @param {number[]} frame 原始 1024 点帧。
   * @param {object} context 当前运行时上下文。
   * @returns {{pointArr:number[], newData:unknown}} 映射后的压力帧和附加数据。
   */
  function applySensorMapping(frame, context) {
    const { file } = context;
    let pointArr = frame;
    let newData = [];

    if (file === 'car10') {
      pointArr = car10Sit(pointArr);
    } else if (file === 'car' || file === 'foot') {
      pointArr = carSitLine(pointArr);
    } else if (file === 'sit10') {
      pointArr = sit10Line(pointArr);
    } else if (isSmallBedMatrixType(file)) {
      pointArr = jqbed(pointArr);
    } else if (file === 'smallBed1') {
      pointArr = smallBed1(pointArr);
    } else if (file === 'smallM') {
      pointArr = smallM1(pointArr);
    } else if (file === 'rect') {
      pointArr = rect(pointArr);
    } else if (file === 'short') {
      pointArr = short(pointArr);
    } else if (file === 'hand') {
      pointArr = jqbed(pointArr);
      newData = [...pointArr];
    } else if (file === HAND_SINGLE_POINT_TYPE) {
      pointArr = handSinglePoint(pointArr);
      newData = [...pointArr];
    } else if (file === MINZHEN_TYPE) {
      pointArr = jqbed(pointArr);
      maskMinzhenMatrixValues(pointArr);
      newData = [...pointArr];
    } else if (isPetCareSystem(file)) {
      pointArr = jqbed(pointArr);
      newData = [...pointArr];
    } else if (file === 'sit') {
      pointArr = mirrorSitRows(jqbed(pointArr));
      newData = [...pointArr];
      pointArr = press6sit(pointArr, 32, 32, 'col');
    } else if (file === 'matCol') {
      pointArr = matColLine(pointArr);
    } else if (file === 'sitCol') {
      pointArr = handBlue(pointArr);
    } else if (file === 'yanfeng10') {
      pointArr = yanfeng10sit(pointArr);
    } else if (file === 'handBlue') {
      pointArr = handBlue(pointArr);
    } else if (file === 'volvo') {
      pointArr = wowSitLine(pointArr);
    } else if (file === WHOLE_CHAIR_TYPE) {
      pointArr = normalizeWholeChairFrame('sit', pointArr);
    } else if (file === 'xiyueReal1') {
      pointArr = xiyueReal1(pointArr);
    } else if (file === 'jqbed') {
      pointArr = jqbed(pointArr);
    } else if (file === 'tempFullBed') {
      const tempFullBedFrame = tempFullBed(pointArr);
      pointArr = tempFullBedFrame.sitData;
      newData = tempFullBedFrame;
    } else if (file === 'carCol') {
      pointArr = carCol(pointArr);
    } else if (file === 'newHand') {
      pointArr = newHand(mirrorSitRows(jqbed(pointArr)));
    } else if (file === 'gloves') {
      pointArr = gloves(pointArr);
    } else if (file === 'gloves1') {
      pointArr = gloves1(pointArr);
    } else if (file === 'gloves2') {
      pointArr = gloves2(pointArr);
    } else if (file === 'sit100') {
      pointArr = pressNew1220({ arr: pointArr, width: 32, height: 32, type: 'col', value: 4096 / 6 });
      pointArr = sit100Line(pointArr);
    } else if (file === 'fast1024sit') {
      pointArr = endiSit1024(pointArr);
    } else if (file === 'normalFast') {
      pointArr = pressNew12203131({ arr: pointArr, height: 32, width: 32, type: 'col', value: 1024 });
    } else if (file === 'sofa') {
      pointArr = arrToRealLine(pointArr, [[7, 0], [8, 15]], [[0, 15]], 32);
    } else if (file === 'carY') {
      pointArr = carYLine(pointArr);
    }

    return { pointArr, newData };
  }

  /**
   * 将映射后的坐垫帧包装成前端实时通道需要的 payload。
   *
   * @param {number[]} pointArr 映射后的压力帧。
   * @param {unknown} newData 映射阶段产生的附加数据。
   * @param {object} context 当前运行时上下文。
   * @returns {object} 可直接 JSON 序列化的坐垫 payload。
   */
  function buildPayload(pointArr, newData, context) {
    const {
      colHZ,
      file,
      jqbedMatrixOrigin,
      port1,
      port2,
      useMatrixOrigin,
    } = context;

    const sitDataToSend = (useMatrixOrigin && file === 'jqbed' && jqbedMatrixOrigin)
      ? jqbedMatrixOrigin
      : pointArr;

    if (file === 'tempFullBed') {
      return {
        sitData: pointArr,
        rawSitData: newData.rawSitData,
        matrixWidth: newData.matrixWidth,
        matrixHeight: newData.matrixHeight,
        matrixOrientation: newData.matrixOrientation,
        realArr: newData.realArr,
        pressureThreshold: newData.pressureThreshold,
        temperatureRawData: newData.temperatureRawData,
        temperatureData: newData.temperatureData,
        temperatureAvg: newData.temperatureAvg,
        temperatureK: newData.temperatureK,
        hz: colHZ,
      };
    }

    if (isCar(file)) {
      return {
        sitData: sitDataToSend,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
        hz: colHZ,
      };
    }

    return {
      sitData: isSmallBedMatrixType(file) || file === 'smallBed1' ? pointArr : sitDataToSend,
      hz: colHZ,
    };
  }

  /**
   * 处理一帧 1024 字节 SIT 矩阵数据。
   *
   * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出。
   * @param {object} context 当前运行时状态。
   * @returns {null|{pointArr:number[], newData:unknown, jsonData:string}}
   */
  function processFrame(data, context) {
    const buffer = Buffer.from(data);
    if (buffer.length !== 1024) return null;

    const mapped = applySensorMapping(readUInt8Frame(buffer), context);
    const pointArr = mapped.pointArr;

    return {
      pointArr,
      newData: mapped.newData,
      jsonData: JSON.stringify(buildPayload(pointArr, mapped.newData, context)),
    };
  }

  return {
    processFrame,
  };
}

module.exports = {
  createSit1024FrameProcessor,
};
