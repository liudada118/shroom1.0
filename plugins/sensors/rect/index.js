const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { rect } = require('../../../openWeb');

class RectPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'rect',
      name: '矩陣2',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'SmallRect',
    });
  }


  mapLineOrder(rawData) {
    return rect([...rawData]);
  }
}

module.exports = new RectPlugin();
