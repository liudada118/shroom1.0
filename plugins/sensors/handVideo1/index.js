const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Handvideo1Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'handVideo1',
      name: '手部视频1',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'hand',
      threeComponent: 'CanvasHand',
    });
  }


  mapLineOrder(rawData) {
    const { handVideoRealPoint_0506_3, handVideo1_0416_0506 } = require('../../../openWeb');
    return handVideo1_0416_0506([...rawData]);
  }

  mapLeftDetail(rawData) {
    const { handVideoRealPoint_0506_3 } = require('../../../openWeb');
    return handVideoRealPoint_0506_3([...rawData]);
  }
}

module.exports = new Handvideo1Plugin();
