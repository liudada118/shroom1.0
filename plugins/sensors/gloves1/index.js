const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { gloves1 } = require('../../../openWeb');

class Gloves1Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'gloves1',
      name: '左手手套',
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
    return gloves1([...rawData]);
  }
}

module.exports = new Gloves1Plugin();
