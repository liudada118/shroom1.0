const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Footvideo256Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'footVideo256',
      name: '256鞋垫',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [256],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'foot',
      threeComponent: 'Bed1616',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new Footvideo256Plugin();
