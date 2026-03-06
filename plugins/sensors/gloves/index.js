const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { gloves } = require('../../../openWeb');

class GlovesPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'gloves',
      name: '手套96',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'hand',
      threeComponent: 'Gloves',
    });
  }


  mapLineOrder(rawData) {
    return gloves([...rawData]);
  }
}

module.exports = new GlovesPlugin();
