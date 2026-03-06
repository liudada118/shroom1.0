const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { handBlue } = require('../../../openWeb');

class HandbluePlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'handBlue',
      name: '手部检测(蓝)',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'hand',
      threeComponent: 'CanvasHand',
    });
  }


  mapLineOrder(rawData) {
    return handBlue([...rawData]);
  }
}

module.exports = new HandbluePlugin();
