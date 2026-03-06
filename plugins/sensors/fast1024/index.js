const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Fast1024Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'fast1024',
      name: '32*32高速',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'Fast1024',
    });
  }


  mapLineOrder(rawData) {
    const { jqbed } = require('../../../openWeb');
    const { pressNew1220 } = require('../../../server/mathUtils');
    let data = jqbed([...rawData]);
    return pressNew1220({ arr: data, height: 32, width: 32, type: 'col', value: 1024 });
  }
}

module.exports = new Fast1024Plugin();
