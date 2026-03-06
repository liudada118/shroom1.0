const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { jqbed } = require('../../../openWeb');

class BigbedPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'bigBed',
      name: '床垫监测',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'bed',
      threeComponent: 'Bed',
    });
  }


  mapLineOrder(rawData) {
    return jqbed([...rawData]);
  }
}

module.exports = new BigbedPlugin();
