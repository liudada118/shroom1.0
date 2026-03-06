const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { car10Sit, car10Back } = require('../../../openWeb');

class Car10Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'car10',
      name: '汽车靠背(量产)',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'Car10',
    });
  }

  mapLineOrder(rawData) {
    return car10Sit([...rawData]);
  }

  mapBackLineOrder(rawData) {
    return car10Back([...rawData]);
  }
}

module.exports = new Car10Plugin();
