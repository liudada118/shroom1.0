const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { matColLine } = require('../../../openWeb');

class MatcolposPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'matColPos',
      name: '小床睡姿采集',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'bed',
      threeComponent: 'MatCol',
    });
  }


  mapLineOrder(rawData) {
    return matColLine([...rawData]);
  }
}

module.exports = new MatcolposPlugin();
