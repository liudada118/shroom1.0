const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class RobotsyPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'robotSY',
      name: '松延N2触觉上衣',
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

module.exports = new RobotsyPlugin();
