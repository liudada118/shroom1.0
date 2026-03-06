const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { short } = require('../../../openWeb');

class ShortPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'short',
      name: 'T-short',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'SmallShort',
    });
  }


  mapLineOrder(rawData) {
    return short([...rawData]);
  }
}

module.exports = new ShortPlugin();
