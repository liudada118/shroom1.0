const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class SofaPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'sofa',
      name: '沙发',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'CarSofa',
    });
  }


  mapLineOrder(rawData) {
    const { arrToRealLine } = require('../../../server/mathUtils');
    return arrToRealLine([...rawData], [[7, 0], [8, 15]], [[0, 15]], 32);
  }

  mapBackLineOrder(rawData) {
    const { arrToRealLine } = require('../../../server/mathUtils');
    return arrToRealLine([...rawData], [[7, 0], [8, 15]], [[0, 15]], 32);
  }
}

module.exports = new SofaPlugin();
