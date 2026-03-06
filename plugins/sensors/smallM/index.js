const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { smallM1 } = require('../../../openWeb');

class SmallmPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'smallM',
      name: '小矩陣1',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'SmallM',
    });
  }


  mapLineOrder(rawData) {
    return smallM1([...rawData]);
  }
}

module.exports = new SmallmPlugin();
