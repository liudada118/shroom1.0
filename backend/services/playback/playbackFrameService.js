/**
 * 历史回放帧构造服务。
 *
 * 该服务只负责把数据库中的历史行转换为前端 WebSocket payload，
 * 不负责定时器、WebSocket 发送、数据库查询和播放状态。
 */
function createPlaybackFrameService(deps) {
  const {
    footArrToNormal,
    footL,
    footR,
    footVideo,
    footVideo1,
    handL,
    handR,
    handGloveFullPacket,
    isHandGloveType,
    isSmallBedMatrixType,
    isThreePortFile,
    mapHandGloveFullPacketModelMatrix,
    mapHandGloveFullPacketPressure,
    normalizeFiniteFrame,
    normalizeWholeChairFrame,
    parseStoredSensorFrame,
    buildSmallBedPlaybackPayload,
    buildTempFullBedPlaybackPayload,
    smallBed12BType,
    tempFullBedType,
    wholeChairType,
  } = deps;

  /**
   * 解析历史行中的传感器帧，并标准化为压力/旋转/清零字段。
   *
   * @param {{ data?: string }} row 历史数据库行。
   * @param {string} sensorType 传感器类型。
   * @returns {{ pressureData: number[], rotateData: number[], zeroFrame: number[] }} 标准帧。
   */
  function parseStoredPressure(row, sensorType) {
    return parseStoredSensorFrame(JSON.parse(row?.data || '[]'), sensorType);
  }

  /**
   * 处理 robot 类传感器历史回放 payload。
   *
   * @param {object} options 当前回放行和待写入 payload。
   */
  function applyRobotPlayback({ sensorType, sitRow, backRow, sitPayload, backPayload }) {
    const sitRawText = sitRow?.data;
    const backRawText = backRow?.data;

    if (sitRawText) {
      const sitFrame = parseStoredSensorFrame(JSON.parse(sitRawText), sensorType);
      const sitRaw = sitFrame.pressureData;
      if (sitFrame.rotateData.length) sitPayload.rotate = sitFrame.rotateData;
      const sitPressure = sitRaw.length >= 256
        ? sitRaw.slice(0, 256)
        : normalizeFiniteFrame(sitRaw, 256);
      sitPayload.sitData = sitPressure;
      sitPayload.newArr147 = sitPressure;
    }

    if (backRawText) {
      const backFrame = parseStoredSensorFrame(JSON.parse(backRawText), sensorType);
      const backRaw = backFrame.pressureData;
      if (backFrame.rotateData.length) backPayload.rotate = backFrame.rotateData;
      const backPressure = backRaw.length >= 256
        ? backRaw.slice(0, 256)
        : normalizeFiniteFrame(backRaw, 256);
      backPayload.backData = backPressure;
      backPayload.newArr147 = backPressure;
    }
  }

  /**
   * 处理手套类传感器历史回放 payload，兼容整包和双串口历史格式。
   *
   * @param {object} options 当前回放行和待写入 payload。
   */
  function applyHandGlovePlayback({ sensorType, sitRow, backRow, sitPayload, backPayload }) {
    const sitFrame = parseStoredPressure(sitRow, sensorType);
    const backFrame = parseStoredPressure(backRow, sensorType);
    const sitRaw = sitFrame.pressureData;
    const backRaw = backFrame.pressureData;

    if (sensorType === handGloveFullPacket && sitRaw.length >= 256) {
      const sitPressure = sitRaw.slice(0, 256);
      const sitMapped = mapHandGloveFullPacketPressure([...sitPressure], 'left');
      sitPayload.sitData = mapHandGloveFullPacketModelMatrix(sitMapped);
      sitPayload.realArr = sitPressure;
      sitPayload.rawPressureData = sitPressure;
      sitPayload.newArr147 = sitMapped;
      sitPayload.mappedArr195 = sitMapped;
      sitPayload.rotate = [];
    } else if (sitRaw.length >= 260) {
      const sitPressure = sitRaw.slice(0, 256);
      const sitRotate = sitFrame.rotateData.length ? sitFrame.rotateData : sitRaw.slice(256, 260);
      sitPayload.sitData = sitPressure;
      sitPayload.newArr147 = sensorType === handGloveFullPacket
        ? mapHandGloveFullPacketPressure([...sitPressure], 'left')
        : handL([...sitPressure]);
      sitPayload.rotate = sitRotate;
    } else if (sitRaw.length >= 256) {
      const sitPressure = sitRaw.slice(0, 256);
      sitPayload.sitData = sitPressure;
      sitPayload.rawPressureData = sitPressure;
      sitPayload.newArr147 = handL([...sitPressure]);
      sitPayload.rotate = sitFrame.rotateData;
    } else {
      sitPayload.newArr147 = sitFrame.rotateData.length ? sitRaw : sitRaw.slice(0, sitRaw.length - 4);
      sitPayload.rotate = sitFrame.rotateData.length ? sitFrame.rotateData : sitRaw.slice(sitRaw.length - 4);
    }

    if (sensorType === handGloveFullPacket && backRaw.length >= 256) {
      const backPressure = backRaw.slice(0, 256);
      const backMapped = mapHandGloveFullPacketPressure([...backPressure], 'right');
      backPayload.backData = mapHandGloveFullPacketModelMatrix(backMapped);
      backPayload.realArr = backPressure;
      backPayload.rawPressureData = backPressure;
      backPayload.newArr147 = backMapped;
      backPayload.mappedArr195 = backMapped;
      backPayload.rotate = [];
    } else if (backRaw.length >= 260) {
      const backPressure = backRaw.slice(0, 256);
      const backRotate = backFrame.rotateData.length ? backFrame.rotateData : backRaw.slice(256, 260);
      backPayload.backData = backPressure;
      backPayload.newArr147 = sensorType === handGloveFullPacket
        ? mapHandGloveFullPacketPressure([...backPressure], 'right')
        : handR([...backPressure]);
      backPayload.rotate = backRotate;
    } else if (backRaw.length >= 256) {
      const backPressure = backRaw.slice(0, 256);
      backPayload.backData = backPressure;
      backPayload.rawPressureData = backPressure;
      backPayload.newArr147 = handR([...backPressure]);
      backPayload.rotate = backFrame.rotateData;
    } else {
      backPayload.newArr147 = backFrame.rotateData.length ? backRaw : backRaw.slice(0, backRaw.length - 4);
      backPayload.rotate = backFrame.rotateData.length ? backFrame.rotateData : backRaw.slice(backRaw.length - 4);
    }
  }

  /**
   * 处理足底视频类传感器历史回放 payload。
   *
   * @param {object} options 当前回放行和待写入 payload。
   */
  function applyFootVideoPlayback({ sensorType, sitRow, backRow, sitPayload, backPayload }) {
    if (sitRow?.data) {
      const sitRaw256 = parseStoredPressure(sitRow, sensorType).pressureData;
      if (sitRaw256.length === 256) {
        sitPayload.sitData = footVideo([...sitRaw256]);
        sitPayload.newArr147 = footL([...sitRaw256]);
      } else {
        sitPayload.newArr147 = footArrToNormal(sitRow.data);
      }
    }

    if (backRow?.data) {
      const backRaw256 = parseStoredPressure(backRow, sensorType).pressureData;
      if (backRaw256.length === 256) {
        backPayload.backData = footVideo1([...backRaw256]);
        backPayload.newArr147 = footR([...backRaw256]);
      } else {
        backPayload.newArr147 = footArrToNormal(backRow.data);
      }
    }
  }

  /**
   * 构造指定下标的 sit/back/head 回放 payload。
   *
   * @param {object} options 回放帧构造参数。
   * @returns {{sitPayload: object, backPayload?: object, headPayload?: object}} 三通道 payload。
   */
  function buildPayloads({
    sensorType,
    sitRows = [],
    backRows = [],
    headRows = [],
    index = 0,
    includeIndex = true,
    includeTime = true,
  }) {
    const sitRow = sitRows[index];
    const backRow = backRows[index];
    const headRow = headRows[index];
    const hasBack = backRows.length > 0;
    const baseFields = includeIndex ? { index } : {};

    let sitPayload = {
      sitData: sitRow?.data,
      ...(includeTime ? { time: sitRow?.timestamp } : {}),
      ...baseFields,
      backFlag: hasBack,
    };
    let backPayload = hasBack
      ? {
        backData: backRow?.data,
        ...(includeTime ? { time: backRow?.timestamp } : {}),
        ...baseFields,
        sitFlag: sitRows.length > 0,
      }
      : undefined;

    if (sensorType?.includes?.('robot') && backPayload) {
      applyRobotPlayback({ sensorType, sitRow, backRow, sitPayload, backPayload });
    } else if (isHandGloveType(sensorType) && backPayload) {
      applyHandGlovePlayback({ sensorType, sitRow, backRow, sitPayload, backPayload });
    }

    if (sensorType === 'footVideo' && backPayload) {
      applyFootVideoPlayback({ sensorType, sitRow, backRow, sitPayload, backPayload });
    }

    if (sensorType === wholeChairType) {
      sitPayload.sitData = normalizeWholeChairFrame('sit', sitRow?.data);
      if (backPayload) {
        backPayload.backData = normalizeWholeChairFrame('back', backRow?.data);
      }
    }

    if (sensorType === tempFullBedType) {
      sitPayload = buildTempFullBedPlaybackPayload(sitRow, {
        ...baseFields,
        backFlag: hasBack,
      });
    } else if (isSmallBedMatrixType(sensorType) || sensorType === smallBed12BType) {
      sitPayload = buildSmallBedPlaybackPayload(sitRow, {
        ...baseFields,
        backFlag: hasBack,
      });
    }

    const headPayload = isThreePortFile(sensorType)
      ? {
        headData: sensorType === wholeChairType
          ? normalizeWholeChairFrame('head', headRow?.data)
          : headRow?.data,
        ...(includeTime ? { time: headRow?.timestamp } : {}),
        ...baseFields,
        sitFlag: sitRows.length > 0,
      }
      : undefined;

    return { sitPayload, backPayload, headPayload };
  }

  return { buildPayloads };
}

module.exports = {
  createPlaybackFrameService,
};
