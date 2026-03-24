const { timeStampToDate } = require("./openWeb");

module.exports = {
  isCar: (value) => {
    const arr = ["car", "car10", 'yanfeng10', 'volvo', 'footVideo', 'hand0205' , 'carQX' , 'eye' , 'sofa', 'carY'];
    return arr.includes(value);
  },

  dedupli(obj1, obj2) {
    const valueArr1 = [],
      valueArr2 = [];
    obj1.forEach((a, index) => {
      valueArr1.push(a.date);
    });
    obj2.forEach((a, index) => {
      valueArr2.push(a.date);
    });
    // Object.values(obj1)
    // const valueArr2 = Object.values(obj2)

    const resArr = Array.from(new Set([...valueArr1, ...valueArr2]));

    let objArr = [];
    console.log(resArr);
    resArr.forEach((a, index) => {
      let obj;
      if (a.includes(" ")) {
        obj = {
          date: a.split(" ")[1],
          name: a.split(" ")[0],
          info: a,
        };
        objArr.push(obj);
      } else {
        obj = {
          date: a,
          name: timeStampToDate(Number(a)),
          info: a,
        };
        objArr.push(obj);
      }
    });

    // let resStamp = resArr.map((a, index) => Date.parse(a))
    objArr = objArr.filter((a) => !a.date.includes(":"));
    console.log(objArr, "objArr");
    let resStamp = objArr.sort((a, b) => b.date - a.date);

    // resStamp = resStamp.map((a, index) => timeStampToDate(a))
    const resObj = [];
    resStamp.forEach((a, index) => {
      resObj.push({
        ...a,
      });
    });
    console.log(resObj, "resStamp");
    return resObj;
  },
  totalToN(x , mul) {
    // if (x < 1000) {
    //   return 0;
    // }
    // let value =
    //   Math.pow(x, 2) * 2.7551 * Math.pow(10, -5) - 0.0787 * x + 64.9349;
    // value = value < 0 ? 0 : value;
    // return mul ?  value * mul : value;
    return x //* 0.03
  },
  
};



 
