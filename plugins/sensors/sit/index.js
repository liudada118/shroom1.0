const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class SitPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'sit',
      name: '坐垫',
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
    const { jqbed } = require('../../../openWeb');
    const { press6sit } = require('../../../server/mathUtils');
    let data = jqbed([...rawData]);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [data[i * 32 + j], data[i * 32 + 31 - j]] = [data[i * 32 + 31 - j], data[i * 32 + j]];
      }
    }
    return press6sit(data, 32, 32, 'col');
  }
}

module.exports = new SitPlugin();
