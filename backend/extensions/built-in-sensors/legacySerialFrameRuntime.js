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
    zeroLineMatrix: ctx.zeroLineMatrix,
  });
  const bigBedFrameProcessor = createLegacyBigBedFrameProcessor();
  const gloveFrameProcessor = createLegacyGloveFrameProcessor({
    gloves0123: ctx.gloves0123,
    gloves0123Res: ctx.gloves0123Res,
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
  });

  /**
   * 把发布时的入参 payload 归一成对象。
   *
   * 调用方传进来的可能已经是对象，也可能是 JSON 串（旧链路上两种都出现过）。
   * 解析失败返回 null 而不抛 —— 这个值只用于下面 getPublishedFrame 的「来源比对」，
   * 比不上就走 fallback，不该因为一条畸形 payload 打断整帧处理。
   *
   * @param {object|string|*} value 待归一的 payload。
   * @returns {object|null} 归一后的对象；无法解析时为 null。
   */
  function parseFramePayload(value) {
    if (value && typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return null;
    }
  }

  /**
   * 逐点比较两个数组是否完全相同。
   *
   * 用于判断「发布结果里某个字段的来源，是否正是我们这次传进去的那一帧」，
   * 所以必须逐点比而不能只比长度 —— 长度相同的不同帧在这里必须判为不等，
   * 否则会发生 getPublishedFrame 注释里说的跨阶段互相覆盖。
   *
   * @param {*} left 左侧数组。
   * @param {*} right 右侧数组。
   * @returns {boolean} 两者都是数组且长度与每一点都相同时为 true。
   */
  function framesEqual(left, right) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => value === right[index]);
  }

  /**
   * 从发布结果里取回「该写回旧运行时状态」的那一帧。
   *
   * 取值优先级：
   * 1. 归零链路的 processed 阶段结果（长度与 fallback 一致时直接用）；
   * 2. `fields` 里第一个满足「发布结果有值 **且** 该字段的来源帧就是本次 fallback」的字段；
   * 3. fallback 本身。
   *
   * 第 2 条那个来源比对是关键，理由见下方行内注释：同一个发布结果里不同字段属于
   * 不同处理阶段（jqbed 的 sitData 可能是 Python 侧的 matrixOrigin，pointArr 则是
   * 下一轮算法的输入），只按长度匹配会让两个阶段的数据互相顶掉。
   *
   * 所有分支都返回**新数组**（`[...x]`），不把发布结果的引用漏给旧运行时状态 ——
   * 旧状态是长期持有的可变数组，共享引用会让后续处理反向污染已发布的帧。
   *
   * @param {{frame?: object, zeroedStages?: {processed?: number[]}}|null} publishResult 发布结果。
   * @param {string[]} fields 候选字段名，按优先级排列。
   * @param {number[]} [fallback=[]] 取不到时的兜底帧，同时充当来源比对的基准。
   * @param {object|string|null} [sourcePayload=null] 本次发布的原始 payload，用于来源比对。
   * @returns {number[]} 应写回旧运行时状态的帧副本。
   */
  function getPublishedFrame(publishResult, fields, fallback = [], sourcePayload = null) {
    const zeroedProcessed = publishResult?.zeroedStages?.processed;
    if (
      Array.isArray(zeroedProcessed)
      && zeroedProcessed.length > 0
      && zeroedProcessed.length === fallback.length
    ) {
      return [...zeroedProcessed];
    }
    const prepared = publishResult?.frame;
    const source = parseFramePayload(sourcePayload);
    for (const field of fields) {
      // 只把同一处理阶段的发布结果写回 runtime。jqbed 的 sitData 可以是
      // Python matrixOrigin，而 pointArr 是下一轮算法输入；二者不能因长度相同
      // 就互相覆盖。
      if (
        Array.isArray(prepared?.[field])
        && prepared[field].length > 0
        && framesEqual(source?.[field], fallback)
      ) {
        return [...prepared[field]];
      }
    }
    return Array.isArray(fallback) ? [...fallback] : [];
  }

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
        useMatrixOrigin: ctx.useMatrixOrigin,
        jqbedMatrixOrigin: ctx.jqbedMatrixOrigin,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (frameResult) {
        ctx.newData = frameResult.newData;
        const published = ctx.colOrSendData(frameResult.jsonData, {
          zeroSources: { processed: frameResult.pointArr },
        });
        ctx.pointArr = getPublishedFrame(
          published,
          ['pressureData', 'sitData'],
          frameResult.pointArr,
          frameResult.jsonData,
        );
      }
      return;
    }

    const lowDensityFrameResult = genericMatrixFrameProcessor.processLowDensitySitFrame(buffer, {
      file: ctx.file,
      colHZ: ctx.colHZ,
      newArr: ctx.newArr,
      port1: ctx.port1,
      port2: ctx.port2,
    });
    if (lowDensityFrameResult) {
      const published = ctx.colOrSendData(lowDensityFrameResult.jsonData, {
        zeroSources: { processed: lowDensityFrameResult.frame },
      });
      ctx.pointArr = getPublishedFrame(
        published,
        ['sitData'],
        lowDensityFrameResult.frame,
        lowDensityFrameResult.jsonData,
      );
      return;
    }

    if (buffer.length === 262) {
      const gloveFrameResult = gloveFrameProcessor.processSit262Frame(buffer, {
        port1: ctx.port1,
        port2: ctx.port2,
      });
      const published = ctx.colOrSendData(gloveFrameResult.jsonData, {
        zeroSources: { processed: gloveFrameResult.pointArr },
      });
      ctx.pointArr = getPublishedFrame(
        published,
        ['sitData'],
        gloveFrameResult.pointArr,
        gloveFrameResult.jsonData,
      );
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
        port1: ctx.port1,
        port2: ctx.port2,
        rawPressureMode: buffer.length === 158 ? 'pressure' : undefined,
      });
      ctx.lastBlueData = leftFrameResult.lastData;
      const published = ctx.colOrSendData(leftFrameResult.jsonData, {
        zeroSources: { processed: leftFrameResult.pointArr },
      });
      ctx.pointArr = getPublishedFrame(
        published,
        ['pressureData', 'sitData'],
        leftFrameResult.pointArr,
        leftFrameResult.jsonData,
      );
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
      const published = ctx.colOrSendData(sit256FrameResult.jsonData, {
        zeroSources: { processed: sit256FrameResult.frame },
      });
      ctx.pointArr = getPublishedFrame(
        published,
        ['sitData'],
        sit256FrameResult.frame,
        sit256FrameResult.jsonData,
      );
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
      const published = ctx.colOrSendData(bed4096FrameResult.jsonData, {
        zeroSources: { processed: bed4096FrameResult.frame },
      });
      ctx.pointArr = getPublishedFrame(
        published,
        ['sitData'],
        bed4096FrameResult.frame,
        bed4096FrameResult.jsonData,
      );
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
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (frameResult) {
        const published = ctx.colOrSendData1(frameResult.jsonData, {
          zeroSources: { processed: frameResult.frame },
        });
        ctx.pointArr2 = getPublishedFrame(
          published,
          ['backData'],
          frameResult.frame,
          frameResult.jsonData,
        );
      }
      return;
    }

    if (buffer.length === 130) {
      if (ctx.handleHandGloveDoublePacket(buffer, 'right', 'back')) return;
      const backFrameResult = segmentedFrameProcessor.processBack130Segment(buffer, {
        file: ctx.file,
        firstData: ctx.firstBlueData1,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (backFrameResult.firstData) {
        ctx.firstBlueData1 = backFrameResult.firstData;
        return;
      }
      ctx.lastBlueData1 = backFrameResult.lastData;
      const published = ctx.colOrSendData1(backFrameResult.jsonData, {
        zeroSources: { processed: backFrameResult.pointArr },
      });
      ctx.pointArr2 = getPublishedFrame(
        published,
        ['backData'],
        backFrameResult.pointArr,
        backFrameResult.jsonData,
      );
      return;
    }

    if (buffer.length === 146) {
      if (ctx.handleHandGloveDoublePacket(buffer, 'right', 'back')) return;
      const backFrameResult = segmentedFrameProcessor.processRightSecondSegment(buffer, {
        channel: 'back',
        file: ctx.file,
        firstData: ctx.firstBlueData1,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      ctx.lastBlueData1 = backFrameResult.lastData;
      const published = ctx.colOrSendData1(backFrameResult.jsonData, {
        zeroSources: { processed: backFrameResult.pressureData },
      });
      ctx.pointArr2 = getPublishedFrame(
        published,
        ['backData'],
        backFrameResult.pressureData,
        backFrameResult.jsonData,
      );
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
    const payloadText = JSON.stringify({ sitData: res });
    // bigBed 保留自己的 1/10 入库节奏，但实时帧仍先经过统一零点适配，
    // 这样动态 store 能看到完整合帧，且采零后的实时/历史数据使用同一结果。
    const published = ctx.colOrSendData(payloadText, {
      store: false,
      publish: !ctx.localFlag,
      zeroSources: { processed: res },
    });
    const preparedFrame = getPublishedFrame(
      published,
      ['sitData'],
      res,
      payloadText,
    );

    if (
      ctx.flag
      && ctx.shouldStoreCollectionFrame('sit')
      && ctx.hasEnoughCollectionDiskSpace()
    ) {
      ctx.dataFalg += 1;
      if (ctx.dataFalg % 10 === 0) {
        const timestamp = Date.now();
        const date = ctx.saveTime;
        ctx.enqueueCollectionInsert(ctx.db, [JSON.stringify(preparedFrame), timestamp, date], 'sit');
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
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (frameResult) {
        const published = ctx.colOrSendData2(frameResult.jsonData, {
          zeroSources: { processed: frameResult.frame },
        });
        ctx.pointArr4 = getPublishedFrame(
          published,
          ['headData'],
          frameResult.frame,
          frameResult.jsonData,
        );
      }
      return;
    }

    if (buffer.length === 130) {
      const headFrameResult = segmentedFrameProcessor.processHead130Segment(buffer, {
        firstData: ctx.firstBlueData2,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      if (headFrameResult.firstData) {
        ctx.firstBlueData2 = headFrameResult.firstData;
        return;
      }
      ctx.lastBlueData2 = headFrameResult.lastData;
      const published = ctx.colOrSendData2(headFrameResult.jsonData, {
        zeroSources: { processed: headFrameResult.pointArr },
      });
      ctx.pointArr4 = getPublishedFrame(
        published,
        ['headData'],
        headFrameResult.pointArr,
        headFrameResult.jsonData,
      );
      return;
    }

    if (buffer.length === 146) {
      const headFrameResult = segmentedFrameProcessor.processRightSecondSegment(buffer, {
        channel: 'head',
        file: ctx.file,
        firstData: ctx.firstBlueData2,
        port1: ctx.port1,
        port2: ctx.port2,
      });
      ctx.lastBlueData2 = headFrameResult.lastData;
      const published = ctx.colOrSendData2(headFrameResult.jsonData, {
        zeroSources: { processed: headFrameResult.pressureData },
      });
      ctx.pointArr4 = getPublishedFrame(
        published,
        ['headData'],
        headFrameResult.pressureData,
        headFrameResult.jsonData,
      );
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
