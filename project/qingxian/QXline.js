export function carQXsitLocal(wsPointData) {
  let resArr = []
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      resArr.push(wsPointData[i * 32 + j])
    }
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      [resArr[i * 16 + 8 + j], resArr[i * 16 + 8 + 7 - j]] = [resArr[i * 16 + 8 + 7 - j], resArr[i * 16 + 8 + j],]
    }
  }
  resArr = rotate90(resArr, 16, 16)
  return resArr
}

export function carQXbackLocal(wsPointData) {
  let resArr = []
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      resArr.push(wsPointData[i * 32 + j])
    }
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      [resArr[i * 16 + 8 + j], resArr[i * 16 + 8 + 7 - j]] = [resArr[i * 16 + 8 + 7 - j], resArr[i * 16 + 8 + j],]
    }
  }

  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 16; j++) {
      [resArr[i * 16 +  j], resArr[(15-i) * 16 +  j]] = [resArr[(15-i) * 16 +  j], resArr[i * 16 + j],]
    }
  }

  resArr = rotate90(resArr, 16, 16)
  return resArr
}

export function carQXheadLocal(wsPointData) {
  let resArr = []
  for (let i = 6; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      resArr.push(wsPointData[i * 32 + j])
    }
  }

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 2; j++) {
      [resArr[i * 10 + 5 + j], resArr[i * 10 + 5 + 4 - j]] = [resArr[i * 10 + 5 + 4 - j], resArr[i * 10 + 5 + j],]
    }
  }
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 5; j++) {
      [resArr[(i)*10 + j] , resArr[(i)*10 + 9-j], ] =  [resArr[(i)*10 + 9-j],resArr[(i)*10 + j] ,  ] 
    }
  }

  resArr = rotate90CW(resArr, 10, 10)
  return resArr
}