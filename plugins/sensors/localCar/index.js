const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class LocalcarPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'localCar',
      name: '本地自适应',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'other',
      threeComponent: 'Canvas',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new LocalcarPlugin();
