const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { handL } = require('../../../openWeb');

class Num3dPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'Num3D',
      name: '3D数字',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'hand',
      threeComponent: 'Hand0205',
    });
  }


  mapLineOrder(rawData) {
    return handL([...rawData]);
  }
}

module.exports = new Num3dPlugin();
