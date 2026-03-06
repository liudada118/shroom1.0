const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Bed4096numPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'bed4096num',
      name: '4096数字',
      baudRate: 3000000,
      multiPort: false,
      frameSizes: [4096],
      matrixWidth: 64,
      matrixHeight: 64,
      group: 'bed',
      threeComponent: 'Bed4096',
    });
  }


  mapLineOrder(rawData) {
    const { zeroLineMatrix } = require('../../../openWeb');
    return zeroLineMatrix([...rawData], 64);
  }
}

module.exports = new Bed4096numPlugin();
