const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { gloves2 } = require('../../../openWeb');

class Gloves2Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'gloves2',
      name: '右手手套',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'hand',
      threeComponent: 'Gloves1',
    });
  }


  mapLineOrder(rawData) {
    return gloves2([...rawData]);
  }
}

module.exports = new Gloves2Plugin();
