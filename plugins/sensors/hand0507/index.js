const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { handL, handR } = require('../../../openWeb');

class Hand0507Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'hand0507',
      name: '手套模型',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130, 142, 158],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'hand',
      threeComponent: 'Hand0507',
    });
  }


  mapLineOrder(rawData) {
    return handL([...rawData]);
  }

  mapBackLineOrder(rawData) {
    return handR([...rawData]);
  }
}

module.exports = new Hand0507Plugin();
