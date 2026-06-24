const {
  createLegacyBigBedFrameProcessor,
} = require('./legacyBigBedFrameProcessor');
const {
  createLegacyGenericMatrixFrameProcessor,
} = require('./legacyGenericMatrixFrameProcessor');
const {
  createLegacySegmentedFrameProcessor,
} = require('./legacySegmentedFrameProcessor');

/**
 * 遗留串口帧运行时。
 *
 * 该模块是旧 server.js 串口处理逻辑的兼容分发层。
 * 具体协议处理已逐步拆到 sit1024/backHead1024/segmented/generic/bigBed 等 processor，
 * 这里主要负责旧状态读写、通道输出和少量未完全迁出的旧帧。
 */
function createLegacySerialFrameRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('legacy serial frame runtime context is required');
  }

  with (ctx) {
    const genericMatrixFrameProcessor = createLegacyGenericMatrixFrameProcessor({
      isCar,
      isSmallBedMatrixType,
      numLessZeroToZero,
      zeroLineMatrix,
    });
    const bigBedFrameProcessor = createLegacyBigBedFrameProcessor();
    const segmentedFrameProcessor = createLegacySegmentedFrameProcessor({
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
      numLessZeroToZero,
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
      pointArr = new Array();
      const buffer = Buffer.from(data);
      newData = new Array();
      if (nowDate >= endDate) return;

      if (file === HAND_GLOVE_FULL_PACKET && buffer.length === HAND_GLOVE_FULL_PACKET_LENGTH) {
        handleHandGloveFullPacket(buffer, 'left');
        return;
      }

      if (buffer.length === 1024) {
        const frameResult = sit1024FrameProcessor.processFrame(buffer, {
          file,
          colHZ,
          pointArr1zero,
          useMatrixOrigin,
          jqbedMatrixOrigin,
          port1,
          port2,
        });
        if (frameResult) {
          pointArr = frameResult.pointArr;
          newData = frameResult.newData;
          pointArr1zeroData = frameResult.zeroSourceFrame;
          colOrSendData(frameResult.jsonData);
        }
        return;
      }

      const lowDensityFrameResult = genericMatrixFrameProcessor.processLowDensitySitFrame(buffer, {
        file,
        colHZ,
        newArr,
        pointArr1zero,
        port1,
        port2,
      });
      if (lowDensityFrameResult) {
        pointArr = lowDensityFrameResult.frame;
        pointArr1zeroData = lowDensityFrameResult.zeroSourceFrame;
        colOrSendData(lowDensityFrameResult.jsonData);
        return;
      }

      if (buffer.length == 262) {
        for (let index = 0; index < buffer.length; index++) {
          pointArr[index] = buffer.readUInt8(index);
        }
        const rotate = pointArr.splice(pointArr.length - 6, pointArr.length);
        pointArr = gloves0123Res(pointArr);
        pointArr = gloves0123(pointArr);
        publishSystemEvent(JSON.stringify({
          sitData: pointArr,
          rotate,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        }));
        return;
      }

      if (buffer.length == 130) {
        if (handleHandGloveDoublePacket(buffer, 'left', 'sit')) return;
        firstBlueData = segmentedFrameProcessor.processLeftFirstSegment(buffer).firstData;
        return;
      }

      if (buffer.length == 142) {
        firstBlueData = segmentedFrameProcessor.processLeftFirstSegment(buffer).firstData;
        return;
      }

      if (buffer.length == 146 || buffer.length == 158) {
        if (buffer.length == 146 && handleHandGloveDoublePacket(buffer, 'left', 'sit')) return;
        const leftFrameResult = segmentedFrameProcessor.processLeftSecondSegment(buffer, {
          file,
          firstData: firstBlueData,
          pointArr147zero,
          pointArr1RawZero,
          pointArr1zero,
          port1,
          port2,
          rawPressureMode: buffer.length == 158 ? 'pressure' : undefined,
        });
        lastBlueData = leftFrameResult.lastData;
        pointArr = leftFrameResult.pointArr;
        pointArr1RawZeroData = leftFrameResult.pointArr1RawZeroData;
        pointArr1zeroData = leftFrameResult.pointArr1zeroData;
        newArr147 = leftFrameResult.newArr147;
        colOrSendData(leftFrameResult.jsonData, []);
        return;
      }

      const sit256FrameResult = genericMatrixFrameProcessor.processSit256Frame(buffer, {
        file,
        colHZ,
        newArr,
        port1,
        port2,
      });
      if (sit256FrameResult) {
        pointArr = sit256FrameResult.frame;
        colOrSendData(sit256FrameResult.jsonData);
        return;
      }

      const bed4096FrameResult = genericMatrixFrameProcessor.processBed4096Frame(buffer, {
        file,
        colHZ,
        newArr,
        port1,
        port2,
      });
      if (bed4096FrameResult) {
        pointArr = bed4096FrameResult.frame;
        colOrSendData(bed4096FrameResult.jsonData);
        return;
      }

      if (buffer.length == 1 && buffer.readUInt8(0) == 3) {
        publishSystemEvent({ handReset: true });
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
      smallBed12BRuntime.handleFrame(data);
    
    }

    /**
     * 处理靠背/右手通道串口帧。
     *
     * 负责敏枕、完整手套包、1024 靠背矩阵和分段右手帧，并发布到靠背通道。
     *
     * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始帧。
     */
    function handleBackSerialFrame(data) {
      pointArr2 = new Array();
      const buffer = Buffer.from(data);
      if (nowDate >= endDate) return;

      if (file === MINZHEN_TYPE) {
        const minzhenSensorFrame = parseMinzhenSensorFrame(buffer);
        if (minzhenSensorFrame) {
          colOrSendData1(JSON.stringify(minzhenSensorFrame));
          return;
        }
      }

      if (file === HAND_GLOVE_FULL_PACKET && buffer.length === HAND_GLOVE_FULL_PACKET_LENGTH) {
        handleHandGloveFullPacket(buffer, 'right');
        return;
      }

      if (buffer.length === 1024) {
        const frameResult = backHead1024FrameProcessor.processBackFrame(buffer, {
          file,
          zeroFrame: pointArr2zero,
          port1,
          port2,
        });
        if (frameResult) {
          pointArr2 = frameResult.frame;
          pointArr2zeroData = frameResult.zeroSourceFrame;
          colOrSendData1(frameResult.jsonData);
        }
        return;
      }

      if (buffer.length == 130) {
        if (handleHandGloveDoublePacket(buffer, 'right', 'back')) return;
        const backFrameResult = segmentedFrameProcessor.processBack130Segment(buffer, {
          file,
          firstData: firstBlueData1,
          pointArr1zero,
          pointArr2RawZero,
          port1,
          port2,
        });
        if (backFrameResult.firstData) {
          firstBlueData1 = backFrameResult.firstData;
          return;
        }
        lastBlueData1 = backFrameResult.lastData;
        pointArr = backFrameResult.pointArr;
        pointArr2RawZeroData = backFrameResult.pointArr2RawZeroData;
        if (backFrameResult.newArr147_2) newArr147_2 = backFrameResult.newArr147_2;
        colOrSendData1(backFrameResult.jsonData, []);
        return;
      }

      if (buffer.length == 146) {
        if (handleHandGloveDoublePacket(buffer, 'right', 'back')) return;
        const backFrameResult = segmentedFrameProcessor.processRightSecondSegment(buffer, {
          channel: 'back',
          file,
          firstData: firstBlueData1,
          mappedZeroFrame: pointArr147zero_2,
          port1,
          port2,
          rawZeroFrame: pointArr2RawZero,
          zeroFrame: pointArr2zero,
        });
        lastBlueData1 = backFrameResult.lastData;
        pointArr2 = backFrameResult.pressureData;
        pointArr2RawZeroData = backFrameResult.rawZeroData;
        pointArr2zeroData = backFrameResult.zeroSourceFrame;
        newArr147_2 = backFrameResult.newArr147_2;
        colOrSendData1(backFrameResult.jsonData, []);
        return;
      }

      if (buffer.length == 1 && buffer.readUInt8(0) == 3) {
        publishSystemEvent({ handReset: true });
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
      if (nowDate >= endDate) return;

      const frameResult = bigBedFrameProcessor.processChunk(data, {
        file,
        firstData,
      });
      if (!frameResult) return;

      pointArr3 = frameResult.pointArr3;
      if (frameResult.firstData) firstData = frameResult.firstData;
      if (frameResult.lastData) lastData = frameResult.lastData;
      if (!frameResult.combinedFrame) return;

      const res = frameResult.combinedFrame;
      if (!localFlag) {
        publishSystemEvent(JSON.stringify({ sitData: res }));
      }

      if (flag && shouldStoreCollectionFrame('sit') && hasEnoughCollectionDiskSpace()) {
        dataFalg++;
        if (dataFalg % 10 == 0) {
          const timestamp = Date.now();
          const date = saveTime;
          enqueueCollectionInsert(db, [JSON.stringify(res), timestamp, date], 'sit');
        }
        if (dataFalg >= 10) {
          dataFalg = 0;
        }
      }
      return;
    }

    /**
     * 处理头枕通道串口帧。
     *
     * 负责 1024 头枕矩阵和分段头枕帧，并发布到头枕通道。
     *
     * @param {Buffer|Uint8Array|number[]} data 串口 parser 输出的原始帧。
     */
    function handleHeadSerialFrame(data) {
      pointArr4 = new Array();
      const buffer = Buffer.from(data);
      if (nowDate >= endDate) return;

      if (buffer.length === 1024) {
        const frameResult = backHead1024FrameProcessor.processHeadFrame(buffer, {
          file,
          zeroFrame: pointArr4zero,
          port1,
          port2,
        });
        if (frameResult) {
          pointArr4 = frameResult.frame;
          pointArr4zeroData = frameResult.zeroSourceFrame;
          colOrSendData2(frameResult.jsonData);
        }
        return;
      }

      if (buffer.length == 130) {
        const headFrameResult = segmentedFrameProcessor.processHead130Segment(buffer, {
          firstData: firstBlueData2,
          pointArr1zero,
          port1,
          port2,
        });
        if (headFrameResult.firstData) {
          firstBlueData2 = headFrameResult.firstData;
          return;
        }
        lastBlueData2 = headFrameResult.lastData;
        pointArr = headFrameResult.pointArr;
        colOrSendData1(headFrameResult.jsonData, []);
        return;
      }

      if (buffer.length == 146) {
        const headFrameResult = segmentedFrameProcessor.processRightSecondSegment(buffer, {
          channel: 'head',
          file,
          firstData: firstBlueData2,
          mappedZeroFrame: pointArr147zero_2,
          port1,
          port2,
          rawZeroFrame: [],
          zeroFrame: pointArr4zero,
        });
        lastBlueData2 = headFrameResult.lastData;
        pointArr4 = headFrameResult.pressureData;
        pointArr4zeroData = headFrameResult.zeroSourceFrame;
        newArr147_2 = headFrameResult.newArr147_2;
        colOrSendData2(headFrameResult.jsonData, []);
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
}

module.exports = {
  createLegacySerialFrameRuntime,
};
