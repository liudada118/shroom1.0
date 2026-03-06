const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { carSitLine } = require('../../../openWeb');

class FootPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'foot',
      name: '脚型检测',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'foot',
      threeComponent: 'Car',
    });
  }


  mapLineOrder(rawData) {
    return carSitLine([...rawData]);
  }
}

module.exports = new FootPlugin();
