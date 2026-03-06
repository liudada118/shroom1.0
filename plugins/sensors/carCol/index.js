const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { carCol } = require('../../../openWeb');

class CarcolPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'carCol',
      name: '车载传感器',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'Carcol',
    });
  }


  mapLineOrder(rawData) {
    return carCol([...rawData]);
  }
}

module.exports = new CarcolPlugin();
