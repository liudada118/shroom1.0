const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { handL, handR, handRVideo1470506 } = require('../../../openWeb');
const { bytes4ToInt10 } = require('../../../server/mathUtils');

class Hand0205Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'hand0205',
      name: '触觉手套',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [72, 144, 146, 130, 142, 158],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'hand',
      threeComponent: 'Hand0205',
    });
  }

  /**
   * 左手线序映射（主串口 146 帧）
   */
  mapLineOrder(rawData) {
    return handL([...rawData]);
  }

  /**
   * 右手线序映射（副串口 146 帧）
   */
  mapBackLineOrder(rawData) {
    return handR([...rawData]);
  }

  /**
   * 右手 147 点映射
   */
  mapBackLineOrder147(rawData) {
    return handRVideo1470506([...rawData]);
  }

  /**
   * 解析旋转数据（从帧尾 16 字节中提取）
   */
  parseRotation(tailBytes) {
    return bytes4ToInt10(tailBytes);
  }

  buildPayload(params) {
    const obj = {
      sitData: params.sitData,
      sitFlag: params.sitFlag || false,
      backFlag: params.backFlag || false,
    };
    if (params.extra) {
      if (params.extra.rotate && !params.extra.rotate.every(a => a === 0)) {
        obj.rotate = params.extra.rotate;
      }
      if (params.extra.newArr147 && params.extra.newArr147.length) {
        obj.newArr147 = params.extra.newArr147;
      }
      if (params.extra.realArr) {
        obj.realArr = params.extra.realArr;
      }
    }
    return JSON.stringify(obj);
  }

  buildStorageData(params) {
    if (params.extra && params.extra.newArr147 && params.extra.rotate) {
      return JSON.stringify([...params.extra.newArr147, ...params.extra.rotate]);
    }
    return JSON.stringify(params.sitData);
  }
}

module.exports = new Hand0205Plugin();
