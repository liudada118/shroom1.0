const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class Robot0428Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'robot0428',
      name: '机器人',
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

module.exports = new Robot0428Plugin();
