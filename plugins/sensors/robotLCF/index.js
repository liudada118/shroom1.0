const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class RobotlcfPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'robotLCF',
      name: '零次方H1触觉上衣',
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

module.exports = new RobotlcfPlugin();
