const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class CarqxPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'carQX',
      name: '清闲椅子',
      baudRate: 1000000,
      multiPort: true,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'CarQX',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new CarqxPlugin();
