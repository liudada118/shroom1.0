const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { jqbed } = require('../../../openWeb');

class ChairqxPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'chairQX',
      name: '清闲',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'Ware',
    });
  }


  mapLineOrder(rawData) {
    return jqbed([...rawData]);
  }
}

module.exports = new ChairqxPlugin();
