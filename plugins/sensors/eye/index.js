const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class EyePlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'eye',
      name: '眼罩',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 16,
      matrixHeight: 16,
      group: 'hand',
      threeComponent: 'Eye',
    });
  }


  mapLineOrder(rawData) {
    let wsPointData = [...rawData];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 16; j++) {
        [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j]];
      }
    }
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 16; j++) {
        [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j]];
      }
    }
    const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0];
    const newArr = [];
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < arr.length; i++) {
        newArr.push(wsPointData[j * 16 + arr[i]]);
      }
    }
    return newArr;
  }

  mapBackLineOrder(rawData) {
    let wsPointData = [...rawData];
    let lastArr = wsPointData.splice(128, 128);
    wsPointData = lastArr.concat(wsPointData);
    const arr = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse();
    const newArr = [];
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < arr.length; i++) {
        newArr.push(wsPointData[j * 16 + arr[i]]);
      }
    }
    return newArr;
  }
}

module.exports = new EyePlugin();
