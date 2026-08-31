const { timeStampToDate } = require('@shroom/backend/processing/timeFormatters.js');

/** 旧版遗留的数据工具。三个函数名字都名不副实，见各自说明。 */
module.exports = {
  /**
   * 判断型号是不是**多通道**（坐垫之外还有靠背/头部）。名字读作「是不是汽车」，
   * 但名单里还有手套、眼罩、沙发、整椅、足垫。
   *
   * 用法：`isCar(runtime.file)`。为真时要建第二个库、历史日期取两路并集、清零多发
   * 一份 `backData`。**新增多通道型号必须往这个数组里加一条**，只在 manifest 里
   * 声明多个 sensor 不够。
   *
   * @param {string} value 传感器型号标识（运行时的 `file`）。
   * @returns {boolean} 是否按多通道处理。
   */
  isCar: (value) => {
    const arr = ["car", "car10", 'yanfeng10', 'volvo', 'footVideo', 'hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket', 'carQX', 'wholeChair', 'eye' , 'sofa', 'carY'];
    return arr.includes(value);
  },

  /**
   * 把坐垫、靠背两路历史日期合成一份去重、可显示、时间倒序的列表。只有多通道型号用。
   *
   * 用法：`dedupli(sitRows, backRows)`，入参是 `queryHistoryDates` 的返回值
   * （每行只有 `date`）。取**并集**不是交集 —— 某一天可能只有一路有数据。
   *
   * `date` 列存的是采集时的 `saveTime`，可能是时间戳也可能是用户起的采集名，
   * 所以按有无空格分两支：带空格拆成 `name` + `date`，不带则当时间戳格式化。
   * `info` 始终是未加工的原始标签，「加载某天」要拿它回去按 `date = ?` 匹配。
   *
   * ⚠️ 两处实测行为，不是设计意图：日期部分带冒号的条目会被 filter 丢掉；
   * 排序是数值减法，非数字的 `date` 相减得 NaN，结果是保持原顺序。
   * 返回形状 `{date, name, info}` 与单通道型号直接下发的原始行不同，
   * 前端拿到的 `timeArr` 元素形状随型号而变，别假设 `name` 一定存在。
   *
   * @param {Array<{date: unknown}>} obj1 坐垫日期行。
   * @param {Array<{date: unknown}>} obj2 靠背日期行。
   * @returns {Array<{date: string, name: string, info: string}>} 可显示的日期列表。
   */
  dedupli(obj1, obj2) {
    const valueArr1 = [],
      valueArr2 = [];
    const rows1 = Array.isArray(obj1) ? obj1 : [];
    const rows2 = Array.isArray(obj2) ? obj2 : [];
    rows1.forEach((a, index) => {
      if (a?.date != null && String(a.date).trim() !== '') {
        valueArr1.push(String(a.date));
      }
    });
    rows2.forEach((a, index) => {
      if (a?.date != null && String(a.date).trim() !== '') {
        valueArr2.push(String(a.date));
      }
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
    objArr = objArr.filter((a) => a.date && !String(a.date).includes(":"));
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
  /**
   * 压力总值换算（「total 转牛顿」）。
   *
   * ⚠️ **当前是恒等函数：原样返回 `x`，`mul` 被忽略。** 标定多项式已注释掉。
   * 所以全仓 `totalToN(total, 1.3)` 里那个 1.3 是死参数，靠背压力并没有被乘 1.3。
   *
   * 用法：换算的是**整块矩阵的压力总和**，不是单点，且发生在从库里读出之后 ——
   * 恢复标定只改这一个函数即可，但会同时改变已入库历史数据的显示值。
   *
   * @param {number} x 压力总值（矩阵各点之和）。
   * @param {number} [mul] 额外倍率。当前实现忽略。
   * @returns {number} 原样返回的 `x`。
   */
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



 
