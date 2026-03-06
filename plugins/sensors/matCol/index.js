const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { matColLine } = require('../../../openWeb');

class MatcolPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'matCol',
      name: '小床褥采集',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'MatCol',
    });
  }


  mapLineOrder(rawData) {
    return matColLine([...rawData]);
  }
}

module.exports = new MatcolPlugin();
