const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { wowSitLine, wowBackLine, wowhead } = require('../../../openWeb');

class VolvoPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'volvo',
      name: '沃尔沃',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'CarWow',
    });
  }

  mapLineOrder(rawData) {
    return wowSitLine([...rawData]);
  }

  mapBackLineOrder(rawData) {
    return wowBackLine([...rawData]);
  }

  mapHeadLineOrder(rawData) {
    return wowhead([...rawData]);
  }
}

module.exports = new VolvoPlugin();
