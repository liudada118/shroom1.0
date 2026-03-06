const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { jqbed } = require('../../../openWeb');

class SmallBedPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'smallBed',
      name: '席悦1.0',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'bed',
      threeComponent: 'SmallBed',
    });
  }

  mapLineOrder(rawData) {
    return jqbed([...rawData]);
  }
}

module.exports = new SmallBedPlugin();
