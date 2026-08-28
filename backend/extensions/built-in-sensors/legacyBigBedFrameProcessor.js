/**
 * 遗留 bigBed 双分片矩阵处理器。
 *
 * bigBed 串口每帧 1025 字节，最后 1 字节表示上半片或下半片。
 * 该处理器只负责读取分片、缓存分片数据和拼成 32x64 矩阵，不直接发布或入库。
 */
function createLegacyBigBedFrameProcessor() {
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
   * 将上半片和下半片按行交织成 32x64 矩阵。
   * @param {number[]} firstData 上半片 32x32 数据。
   * @param {number[]} lastData 下半片 32x32 数据。
   * @returns {number[]} 合并后的 32x64 矩阵。
   */
  function combineBigBedRows(firstData, lastData) {
    const combined = [];
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        combined.push(firstData[row * 32 + col]);
      }
      for (let col = 0; col < 32; col++) {
        combined.push(lastData[row * 32 + col]);
      }
    }
    return combined;
  }

  /**
   * 处理 bigBed 的一个 1025 字节分片。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @param {{file: string, firstData: number[]}} context 当前运行时上下文。
   * @returns {null | {pointArr3: number[], firstData?: number[], lastData?: number[], combinedFrame?: number[]}} 处理结果。
   */
  function processChunk(data, context) {
    const buffer = Buffer.from(data);
    if (context.file !== 'bigBed' || buffer.length !== 1025) return null;

    const pointArr3 = readUInt8Frame(buffer);
    const chunkFlag = pointArr3[pointArr3.length - 1];
    const payload = pointArr3.slice(0, -1);

    if (chunkFlag === 0) {
      return {
        pointArr3,
        firstData: payload,
      };
    }

    if (chunkFlag === 1) {
      return {
        pointArr3,
        lastData: payload,
        combinedFrame: combineBigBedRows(context.firstData || [], payload),
      };
    }

    return { pointArr3 };
  }

  return {
    processChunk,
  };
}

module.exports = {
  createLegacyBigBedFrameProcessor,
};
