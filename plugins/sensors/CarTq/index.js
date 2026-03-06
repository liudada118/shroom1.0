const { BaseSensorPlugin } = require('../../BaseSensorPlugin');
const { jqbed } = require('../../../openWeb');

class CartqPlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'CarTq',
      name: '唐群座椅',
      baudRate: 1000000,
      multiPort: false,
      frameSizes: [1024],
      matrixWidth: 32,
      matrixHeight: 32,
      group: 'car',
      threeComponent: 'CarTq',
    });
  }


  mapLineOrder(rawData) {
    return jqbed([...rawData]);
  }
}

module.exports = new CartqPlugin();
