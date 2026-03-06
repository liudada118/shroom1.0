const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { sit10Line } = require('../../../openWeb');

class Sit10Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'sit10',
      name: '席悦座椅',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 10,
      matrixHeight: 10,
      group: 'car',
      threeComponent: 'Sit10',
    });
  }


  mapLineOrder(rawData) {
    return sit10Line([...rawData]);
  }
}

module.exports = new Sit10Plugin();
