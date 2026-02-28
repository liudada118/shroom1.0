

module.exports = {

  pressSmallBed({ arr, width = 32, height = 32, type = 'col', num = 2945 }) {

    let wsPointData = [...arr];

    if (num === 0) {
      return wsPointData
    }
    wsPointData = smallBedZero(wsPointData, 32, 32)
    // wsPointData = wsPointData.map((a) => a < 11 ? 0 : a)
    // return wsPointData;
    if (type == "row") {
      let colArr = [];
      for (let i = 0; i < height; i++) {
        let total = 0;
        for (let j = 0; j < width; j++) {
          total += wsPointData[i * width + j];
        }
        colArr.push(total);
      }

      // //////okok
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          wsPointData[i * width + j] = parseInt(
            (wsPointData[i * width + j] /
              (num - colArr[i] == 0 ? 1 : num - colArr[i])) *
            900
          );
        }
      }
    } else {
      let colArr = [];
      for (let i = 0; i < height; i++) {
        let total = 0;
        for (let j = 0; j < width; j++) {
          total += wsPointData[j * height + i];
        }
        colArr.push(total);
      }
      //   console.log(colArr)
      // //////okok
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          wsPointData[j * height + i] = parseInt(
            (wsPointData[j * height + i] /
              (num - colArr[i] == 0 ? 1 : num - colArr[i])) *
            900
          );
        }
      }
    }

    //////

    // wsPointData = wsPointData.map((a,index) => {return calculateY(a)})
    return wsPointData;
  }
};


function smallBedZero(arr, height, width) {
  let wsPointData = [...arr]
  for (let i = 0; i < 32; i++) {
    wsPointData[20 + i * 32] = (wsPointData[20 - 1 + i * 32] + wsPointData[20 + 1 + i * 32]) / 2
    wsPointData[24 + i * 32] = (wsPointData[24 - 1 + i * 32] + wsPointData[24 + 1 + i * 32]) / 2
    wsPointData[0 + i * 32] = (wsPointData[1  + i * 32])
    wsPointData[31 * 32 + i] = wsPointData[30 * 32 + i]
  }
  return wsPointData
}


