const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { carSitLine, carBackLine } = require('../../../openWeb');

class CarPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'car',
      name: '汽车',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'Car',
    });
  }

  mapLineOrder(rawData) {
    return carSitLine([...rawData]);
  }

  mapBackLineOrder(rawData) {
    return carBackLine([...rawData]);
  }

  buildPayload(params) {
    return JSON.stringify({
      sitData: params.sitData,
      sitFlag: params.sitFlag || false,
      backFlag: params.backFlag || false,
      hz: params.hz,
    });
  }
}

module.exports = new CarPlugin();
