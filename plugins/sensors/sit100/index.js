const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Sit100Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'sit100',
      name: 'car100',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'Car100',
    });
  }


  mapLineOrder(rawData) {
    const { pressNew1220 } = require('../../../server/mathUtils');
    const { sit100Line } = require('../../../openWeb');
    let data = pressNew1220({ arr: [...rawData], width: 32, height: 32, type: 'col', value: 4096 / 6 });
    return sit100Line(data);
  }
}

module.exports = new Sit100Plugin();
