const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { handL, handR } = require('../../../openWeb');

class Hand0205pointPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'hand0205Point',
      name: '手套触觉',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'hand',
      threeComponent: 'Hand0205Point',
    });
  }


  mapLineOrder(rawData) {
    return handL([...rawData]);
  }

  mapBackLineOrder(rawData) {
    return handR([...rawData]);
  }
}

module.exports = new Hand0205pointPlugin();
