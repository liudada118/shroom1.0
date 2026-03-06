const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Fast256Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'fast256',
      name: '16*16高速',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [256],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'other',
      threeComponent: 'Fast256',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new Fast256Plugin();
