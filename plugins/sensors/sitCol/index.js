const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { handBlue } = require('../../../openWeb');

class SitcolPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'sitCol',
      name: '座椅采集',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'Car',
    });
  }


  mapLineOrder(rawData) {
    return handBlue([...rawData]);
  }
}

module.exports = new SitcolPlugin();
