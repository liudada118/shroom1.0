export function calFootType(arr, valueFlag) {
    // 将脚每一行求和
    const newArr = arr.map((a) => a < valueFlag ? 0 : a)
    const leftArr = []
    for (let i = 0; i < 32; i++) {
      let num = 0
      for (let j = 0; j < 16; j++) {
        num += arr[i * 16 + j]
      }
      leftArr.push(num)
    }
  
    // 找到整个脚的索引和重量
    const leftFoot = [], leftFootValue = []
    leftArr.forEach((a, index) => {
      if (a > valueFlag * 2) {
        leftFoot.push(index)
        leftFootValue.push(a)
      }
    })
  
    const footTotalPress = leftFootValue.reduce((a, b) => a + b, 0)
  
    // let footSlope = []
    // // 找到每个点的斜率
    // for (let i = 1; i < leftFootValue.length; i++) {
    //   footSlope.push(leftFootValue[i] - leftFootValue[i - 1])
    // }
  
    // 找到第一个下降然后上升的点  脚趾头跟脚板的分界线
    let footStart = 0
    for (let i = 1; i < leftFootValue.length; i++) {
      if (leftFootValue[i] - leftFootValue[i - 1] < 0 && ((leftFootValue[i + 1] - leftFootValue[i]) / leftFootValue[i]) > 0.2) {
        footStart = i + 1 + leftFoot[0]
        if (i > leftFootValue.length * 0.4) {
          footStart = leftFoot[0]
        }
        break
      }
    }
  
    if (!footStart) {
      footStart = leftFoot[0]
    }
    let footEnd = leftFoot[leftFoot.length - 1]
  
    let length = footEnd - footStart
    if (length % 3 == 1) {
      length = length - 1
      footEnd = footEnd - 1
    }
  
    if (length % 3 == 2) {
      length = length - 2
      footEnd = footEnd - 1
      footStart = footStart - 1
    }
  
    let totalFootPoint = 0, contentPoint = 0
  
    for (let i = footStart; i < footEnd; i++) {
      for (let j = 0; j < 16; j++) {
        if (arr[i * 16 + j] > valueFlag) {
          totalFootPoint++
        }
        if (i >= footStart + Math.floor(length / 3) && i < footStart + Math.floor(length * 2 / 3) && arr[i * 16 + j] > valueFlag) {
          contentPoint++
        }
  
        // arr[(i ) * 16 + j] = 100
      }
    }
  
    // console.log(footStart ,contentPoint  , totalFootPoint)
  
    const prop = contentPoint / (totalFootPoint ? totalFootPoint : 1)
    return { footType: prop, footLength: leftFoot.length }
  
  }