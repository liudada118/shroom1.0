const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { smallBed1 } = require('../../../openWeb');

class Smallbed1Plugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'smallBed1',
      name: '小床128',
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
    return smallBed1([...rawData]);
  }
}

module.exports = new Smallbed1Plugin();
