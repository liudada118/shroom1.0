const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { xiyueReal1 } = require('../../../openWeb');

class Xiyuereal1Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'xiyueReal1',
      name: '席悦2.0',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'bed',
      threeComponent: 'SmallBed',
    });
  }


  mapLineOrder(rawData) {
    return xiyueReal1([...rawData]);
  }
}

module.exports = new Xiyuereal1Plugin();
