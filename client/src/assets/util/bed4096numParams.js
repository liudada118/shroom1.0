/**
 * bed4096num（64*64高速）共享调参模块
 * Bed4096（3D点图）和 Fast256（原始数据）共用同一套调参变量
 * 切换模式时调参不重置
 */
export const bed4096numParams = {
  valuej1: localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
  valueg1: localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
  value1: localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
  valuel1: localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
  valuef1: localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
  valuelInit1: localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2,
};
