const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Car100Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'car100',
      name: 'car100',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'Car100',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new Car100Plugin();
