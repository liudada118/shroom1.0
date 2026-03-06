const { BaseSensorPlugin } = require('../../BaseSensorPlugin');


class SmallsamplePlugin extends BaseSensorPlugin {
  constructor() {
    super({
      id: 'smallSample',
      name: '小型样品',
      baudRate: 921600,
      multiPort: true,
      frameSizes: [146, 130],
      matrixWidth: 10,
      matrixHeight: 10,
      group: 'other',
      threeComponent: 'Box100',
    });
  }


  mapLineOrder(rawData) {
    const sensorToByteIndex = [
      223, 222, 221, 220, 219, 218, 217, 216, 215, 214,
      239, 238, 237, 236, 235, 234, 233, 232, 231, 230,
      255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
      31, 30, 29, 28, 27, 26, 25, 24, 23, 22,
      207, 206, 205, 204, 203, 202, 201, 200, 199, 198,
      191, 190, 189, 188, 187, 186, 185, 184, 183, 182,
      175, 174, 173, 172, 171, 170, 169, 168, 167, 166,
      159, 158, 157, 156, 155, 154, 153, 152, 151, 150,
      143, 142, 141, 140, 139, 138, 137, 136, 135, 134,
    ];
    const mappedArr = [];
    for (let i = 0; i < 100; i++) {
      mappedArr.push(rawData[sensorToByteIndex[i]] || 0);
    }
    return mappedArr;
  }
}

module.exports = new SmallsamplePlugin();
