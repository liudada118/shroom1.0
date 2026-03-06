const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class NormalPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'normal',
      name: '正常测试',
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

module.exports = new NormalPlugin();
