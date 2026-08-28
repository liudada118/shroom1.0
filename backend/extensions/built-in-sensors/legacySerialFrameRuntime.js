const {
  createLegacyBigBedFrameProcessor,
} = require('./legacyBigBedFrameProcessor');
const {
  createLegacyGenericMatrixFrameProcessor,
} = require('./legacyGenericMatrixFrameProcessor');
const {
  createLegacyGloveFrameProcessor,
} = require('./legacyGloveFrameProcessor');
const {
  createLegacySegmentedFrameProcessor,
} = require('./legacySegmentedFrameProcessor');

/**
 * 旧串口帧运行时。
 *
 * 该模块是旧 server.js 串口处理逻辑的兼容分发层。具体协议处理已经逐步拆到
 * sit1024/backHead1024/segmented/generic/bigBed 等 processor，这里只保留旧状态读写、
 * 通道输出和少量未完全迁出的旧帧入口。
 */
function createLegacySerialFrameRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('legacy serial frame runtime context is required');
  }

  const genericMatrixFrameProcessor = createLegacyGenericMatrixFrameProcessor({
    isCar: ctx.isCar,
    isSmallBedMatrixType: ctx.isSmallBedMatrixType,
    numLessZeroToZero: ctx.numLessZeroToZero,
    zeroLineMatrix: ctx.zeroLineMatrix,
  });
  const bigBedFrameProcessor = createLegacyBigBedFrameProcessor();
  const gloveFrameProcessor = createLegacyGloveFrameProcessor({
    gloves0123: ctx.gloves0123,
    gloves0123Res: ctx.gloves0123Res,
    publishSystemEvent: ctx.publishSystemEvent,
  });
  const segmentedFrameProcessor = createLegacySegmentedFrameProcessor({
    bytes4ToInt10: ctx.bytes4ToInt10,
    footL: ctx.footL,
    footR: ctx.footR,
    footVideo: ctx.footVideo,
    footVideo1: ctx.footVideo1,
    handL: ctx.handL,
    handR: ctx.handR,
    handRVideo1470506: ctx.handRVideo1470506,
    handVideo1_0416_0506: ctx.handVideo1_0416_0506,
    handVideoRealPoint_0506_3: ctx.handVideoRealPoint_0506_3,
    isHandGloveType: ctx.isHandGloveType,
    numLessZeroToZero: ctx.numLessZeroToZero,
  });

  /**
   * 处理坐垫串口帧。
   *
   * 负责识别完整手套包、1024 矩阵、低密度矩阵、分段手套/脚垫帧和旧 4096 床垫帧，
   * 并把解析结果写回旧运行时状态后发布到坐垫通道。
   *
   * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始帧。
   */
  function handleSitSerialFrame(data) {
    ctx.pointArr = new Array();
    const buffer = Buffer.from(data);
    ctx.newData = new Array();
    if (ctx.nowDate >= ctx.endDate) return;

    if (
      ctx.file === ctx.HAND_GLOVE_FULL_PACKET
      && buffer.length === ctx.HAND_GLOVE_FULL_PACKET_LENGTH
    ) {
      ctx.handleHandGloveFullPacket(buffer, 'left');
      return;
    }

    if (buffer.length === 1024) {
      const frameResult = ctx.sit1024FrameProcessor.processFrame(buffer, {
        file: ctx.file,
        colHZ: ctx.colHZ,
        pointArr1zero: ctx.pointArr1zero,
        useMatrixOrigin: ctx.useMatrixOrigin,
        jqbedMatrixOrigin: ctx.jqbedMatrixOrigin,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (frameResult) {
        ctx.pointArr = frameResult.pointArr;
        ctx.newData = frameResult.newData;
        ctx.pointArr1zeroData = frameResult.zeroSourceFrame;
        ctx.colOrSendData(frameResult.jsonData);
      }
      return;
    }

    const lowDensityFrameResult = genericMatrixFrameProcessor.processLowDensitySitFrame(buffer, {
      file: ctx.file,
      colHZ: ctx.colHZ,
      newArr: ctx.newArr,
      pointArr1zero: ctx.pointArr1zero,
      port1: ctx.port1,
      port2: ctx.port2,
    });
    if (lowDensityFrameResult) {
      ctx.pointArr = lowDensityFrameResult.frame;
      ctx.pointArr1zeroData = lowDensityFrameResult.zeroSourceFrame;
      ctx.colOrSendData(lowDensityFrameResult.jsonData);
      return;
    }

    if (buffer.length === 262) {
      const gloveFrameResult = gloveFrameProcessor.processSit262Frame(buffer, {
        port1: ctx.port1,
        port2: ctx.port2,
      });
      ctx.pointArr = gloveFrameResult.pointArr;
      return;
    }

    if (buffer.length === 130) {
      if (ctx.handleHandGloveDoublePacket(buffer, 'left', 'sit')) return;
      ctx.firstBlueData = segmentedFrameProcessor.processLeftFirstSegment(buffer).firstData;
      return;
    }

    if (buffer.length === 142) {
      ctx.firstBlueData = segmentedFrameProcessor.processLeftFirstSegment(buffer).firstData;
      return;
    }

    if (buffer.length === 146 || buffer.length === 158) {
      if (
        buffer.length === 146
        && ctx.handleHandGloveDoublePacket(buffer, 'left', 'sit')
      ) {
        return;
      }
      const leftFrameResult = segmentedFrameProcessor.processLeftSecondSegment(buffer, {
        file: ctx.file,
        firstData: ctx.firstBlueData,
        pointArr147zero: ctx.pointArr147zero,
        pointArr1RawZero: ctx.pointArr1RawZero,
        pointArr1zero: ctx.pointArr1zero,
        port1: ctx.port1,
        port2: ctx.port2,
        rawPressureMode: buffer.length === 158 ? 'pressure' : undefined,
      });
      ctx.lastBlueData = leftFrameResult.lastData;
      ctx.pointArr = leftFrameResult.pointArr;
      ctx.pointArr1RawZeroData = leftFrameResult.pointArr1RawZeroData;
      ctx.pointArr1zeroData = leftFrameResult.pointArr1zeroData;
      ctx.newArr147 = leftFrameResult.newArr147;
      ctx.colOrSendData(leftFrameResult.jsonData, []);
      return;
    }

    const sit256FrameResult = genericMatrixFrameProcessor.processSit256Frame(buffer, {
      file: ctx.file,
      colHZ: ctx.colHZ,
      newArr: ctx.newArr,
      port1: ctx.port1,
      port2: ctx.port2,
    });
    if (sit256FrameResult) {
      ctx.pointArr = sit256FrameResult.frame;
      ctx.colOrSendData(sit256FrameResult.jsonData);
      return;
    }

    const bed4096FrameResult = genericMatrixFrameProcessor.processBed4096Frame(buffer, {
      file: ctx.file,
      colHZ: ctx.colHZ,
      newArr: ctx.newArr,
      port1: ctx.port1,
      port2: ctx.port2,
    });
    if (bed4096FrameResult) {
      ctx.pointArr = bed4096FrameResult.frame;
      ctx.colOrSendData(bed4096FrameResult.jsonData);
      return;
    }

    if (buffer.length === 1 && buffer.readUInt8(0) === 3) {
      ctx.publishSystemEvent({ handReset: true });
    }
  }

  /**
   * 处理 12B 小床垫协议帧。
   *
   * 具体解析和输出由 smallBed12BRuntime 接管，这里只保留旧入口兼容。
   *
   * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始帧。
   */
  function handleSmallBed12BSerialFrame(data) {
    ctx.smallBed12BRuntime.handleFrame(data);
  }

  /**
   * 处理靠背/右手通道串口帧。
   *
   * 负责敏枕、完整手套包、1024 靠背矩阵和分段右手帧，并发布到靠背通道。
   *
   * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始帧。
   */
  function handleBackSerialFrame(data) {
    ctx.pointArr2 = new Array();
    const buffer = Buffer.from(data);
    if (ctx.nowDate >= ctx.endDate) return;

    if (ctx.file === ctx.MINZHEN_TYPE) {
      const minzhenSensorFrame = ctx.parseMinzhenSensorFrame(buffer);
      if (minzhenSensorFrame) {
        ctx.colOrSendData1(JSON.stringify(minzhenSensorFrame));
        return;
      }
    }

    if (
      ctx.file === ctx.HAND_GLOVE_FULL_PACKET
      && buffer.length === ctx.HAND_GLOVE_FULL_PACKET_LENGTH
    ) {
      ctx.handleHandGloveFullPacket(buffer, 'right');
      return;
    }

    if (buffer.length === 1024) {
      const frameResult = ctx.backHead1024FrameProcessor.processBackFrame(buffer, {
        file: ctx.file,
        zeroFrame: ctx.pointArr2zero,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (frameResult) {
        ctx.pointArr2 = frameResult.frame;
        ctx.pointArr2zeroData = frameResult.zeroSourceFrame;
        ctx.colOrSendData1(frameResult.jsonData);
      }
      return;
    }

    if (buffer.length === 130) {
      if (ctx.handleHandGloveDoublePacket(buffer, 'right', 'back')) return;
      const backFrameResult = segmentedFrameProcessor.processBack130Segment(buffer, {
        file: ctx.file,
        firstData: ctx.firstBlueData1,
        pointArr1zero: ctx.pointArr1zero,
        pointArr2RawZero: ctx.pointArr2RawZero,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (backFrameResult.firstData) {
        ctx.firstBlueData1 = backFrameResult.firstData;
        return;
      }
      ctx.lastBlueData1 = backFrameResult.lastData;
      ctx.pointArr = backFrameResult.pointArr;
      ctx.pointArr2RawZeroData = backFrameResult.pointArr2RawZeroData;
      if (backFrameResult.newArr147_2) ctx.newArr147_2 = backFrameResult.newArr147_2;
      ctx.colOrSendData1(backFrameResult.jsonData, []);
      return;
    }

    if (buffer.length === 146) {
      if (ctx.handleHandGloveDoublePacket(buffer, 'right', 'back')) return;
      const backFrameResult = segmentedFrameProcessor.processRightSecondSegment(buffer, {
        channel: 'back',
        file: ctx.file,
        firstData: ctx.firstBlueData1,
        mappedZeroFrame: ctx.pointArr147zero_2,
        port1: ctx.port1,
        port2: ctx.port2,
        rawZeroFrame: ctx.pointArr2RawZero,
        zeroFrame: ctx.pointArr2zero,
      });
      ctx.lastBlueData1 = backFrameResult.lastData;
      ctx.pointArr2 = backFrameResult.pressureData;
      ctx.pointArr2RawZeroData = backFrameResult.rawZeroData;
      ctx.pointArr2zeroData = backFrameResult.zeroSourceFrame;
      ctx.newArr147_2 = backFrameResult.newArr147_2;
      ctx.colOrSendData1(backFrameResult.jsonData, []);
      return;
    }

    if (buffer.length === 1 && buffer.readUInt8(0) === 3) {
      ctx.publishSystemEvent({ handReset: true });
    }
  }

  /**
   * 处理大床坐垫分片帧。
   *
   * 按前后片缓存并组合完整大床矩阵，必要时发布实时数据并写入采集库。
   *
   * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始分片。
   */
  function handleBigBedSitSerialFrame(data) {
    if (ctx.nowDate >= ctx.endDate) return;

    const frameResult = bigBedFrameProcessor.processChunk(data, {
      file: ctx.file,
      firstData: ctx.firstData,
    });
    if (!frameResult) return;

    ctx.pointArr3 = frameResult.pointArr3;
    if (frameResult.firstData) ctx.firstData = frameResult.firstData;
    if (frameResult.lastData) ctx.lastData = frameResult.lastData;
    if (!frameResult.combinedFrame) return;

    const res = frameResult.combinedFrame;
    if (!ctx.localFlag) {
      ctx.publishSystemEvent(JSON.stringify({ sitData: res }));
    }

    if (
      ctx.flag
      && ctx.shouldStoreCollectionFrame('sit')
      && ctx.hasEnoughCollectionDiskSpace()
    ) {
      ctx.dataFalg += 1;
      if (ctx.dataFalg % 10 === 0) {
        const timestamp = Date.now();
        const date = ctx.saveTime;
        ctx.enqueueCollectionInsert(ctx.db, [JSON.stringify(res), timestamp, date], 'sit');
      }
      if (ctx.dataFalg >= 10) {
        ctx.dataFalg = 0;
      }
    }
  }

  /**
   * 处理头枕通道串口帧。
   *
   * 负责 1024 头枕矩阵和分段头枕帧，并发布到头枕通道。
   *
   * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始帧。
   */
  function handleHeadSerialFrame(data) {
    ctx.pointArr4 = new Array();
    const buffer = Buffer.from(data);
    if (ctx.nowDate >= ctx.endDate) return;

    if (buffer.length === 1024) {
      const frameResult = ctx.backHead1024FrameProcessor.processHeadFrame(buffer, {
        file: ctx.file,
        zeroFrame: ctx.pointArr4zero,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (frameResult) {
        ctx.pointArr4 = frameResult.frame;
        ctx.pointArr4zeroData = frameResult.zeroSourceFrame;
        ctx.colOrSendData2(frameResult.jsonData);
      }
      return;
    }

    if (buffer.length === 130) {
      const headFrameResult = segmentedFrameProcessor.processHead130Segment(buffer, {
        firstData: ctx.firstBlueData2,
        pointArr1zero: ctx.pointArr1zero,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (headFrameResult.firstData) {
        ctx.firstBlueData2 = headFrameResult.firstData;
        return;
      }
      ctx.lastBlueData2 = headFrameResult.lastData;
      ctx.pointArr = headFrameResult.pointArr;
      ctx.colOrSendData1(headFrameResult.jsonData, []);
      return;
    }

    if (buffer.length === 146) {
      const headFrameResult = segmentedFrameProcessor.processRightSecondSegment(buffer, {
        channel: 'head',
        file: ctx.file,
        firstData: ctx.firstBlueData2,
        mappedZeroFrame: ctx.pointArr147zero_2,
        port1: ctx.port1,
        port2: ctx.port2,
        rawZeroFrame: [],
        zeroFrame: ctx.pointArr4zero,
      });
      ctx.lastBlueData2 = headFrameResult.lastData;
      ctx.pointArr4 = headFrameResult.pressureData;
      ctx.pointArr4zeroData = headFrameResult.zeroSourceFrame;
      ctx.newArr147_2 = headFrameResult.newArr147_2;
      ctx.colOrSendData2(headFrameResult.jsonData, []);
    }
  }

  return {
    handleSitSerialFrame,
    handleSmallBed12BSerialFrame,
    handleBackSerialFrame,
    handleBigBedSitSerialFrame,
    handleHeadSerialFrame,
  };
}

module.exports = {
  createLegacySerialFrameRuntime,
};
