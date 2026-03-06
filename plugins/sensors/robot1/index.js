const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Robot1Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'robot1',
      name: '宇树G1触觉上衣',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'robot',
      threeComponent: 'Robot',
    });
  }


  mapLineOrder(rawData) {
    return [...rawData];
  }
}

module.exports = new Robot1Plugin();
