const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { yanfeng10back, yanfeng10sit } = require('../../../openWeb');

class Yanfeng10Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'yanfeng10',
      name: '轮椅',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'Car10',
    });
  }


  mapLineOrder(rawData) {
    return yanfeng10sit([...rawData]);
  }

  mapBackLineOrder(rawData) {
    return yanfeng10back([...rawData]);
  }
}

module.exports = new Yanfeng10Plugin();
