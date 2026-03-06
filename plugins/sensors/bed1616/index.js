const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Bed1616Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'bed1616',
      name: '256',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [256],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'other',
      threeComponent: 'Bed1616',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new Bed1616Plugin();
