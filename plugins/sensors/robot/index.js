const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class RobotPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'robot',
      name: '机器人出手',
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

module.exports = new RobotPlugin();
