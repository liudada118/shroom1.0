const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class DalieguPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'daliegu',
      name: '14*20高速',
      baudRate: 921600,
      multiPort: false,
      frameSizes: [72, 144],
      matrixWidth: 14,
      matrixHeight: 20,
      group: 'other',
      threeComponent: 'Daliegu',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new DalieguPlugin();
