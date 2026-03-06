const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class FootvideoPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'footVideo',
      name: '触觉足底',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'foot',
      threeComponent: 'FootVideo',
    });
  }


  mapLineOrder(rawData) {
    const { footVideo, footL } = require('../../../openWeb');
    return footVideo([...rawData]);
  }

  mapLeftDetail(rawData) {
    const { footL } = require('../../../openWeb');
    return footL([...rawData]);
  }

  mapBackLineOrder(rawData) {
    const { footVideo1, footR } = require('../../../openWeb');
    return footVideo1([...rawData]);
  }

  mapRightDetail(rawData) {
    const { footR } = require('../../../openWeb');
    return footR([...rawData]);
  }
}

module.exports = new FootvideoPlugin();
