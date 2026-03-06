const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class HandPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'hand',
      name: '手部视频',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'hand',
      threeComponent: 'CanvasHand',
    });
  }


  mapLineOrder(rawData) {
    const { jqbed } = require('../../../openWeb');
    let data = jqbed([...rawData]);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [data[i * 32 + j], data[i * 32 + 31 - j]] = [data[i * 32 + 31 - j], data[i * 32 + j]];
      }
    }
    return data;
  }
}

module.exports = new HandPlugin();
