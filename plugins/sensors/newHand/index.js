const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class NewhandPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'newHand',
      name: '手套监测',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'hand',
      threeComponent: 'CanvasnewHand',
    });
  }


  mapLineOrder(rawData) {
    const { jqbed, newHand } = require('../../../openWeb');
    let data = jqbed([...rawData]);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [data[i * 32 + j], data[i * 32 + 31 - j]] = [data[i * 32 + 31 - j], data[i * 32 + j]];
      }
    }
    return newHand(data);
  }
}

module.exports = new NewhandPlugin();
