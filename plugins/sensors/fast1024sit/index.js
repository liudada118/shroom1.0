const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { endiSit1024 } = require('../../../openWeb');

class Fast1024sitPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'fast1024sit',
      name: '1024高速座椅',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'Fast1024sit',
    });
  }


  mapLineOrder(rawData) {
    return endiSit1024([...rawData]);
  }
}

module.exports = new Fast1024sitPlugin();
