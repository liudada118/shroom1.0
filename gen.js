const module2 = require('./aes_ecb')
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 所有支持的传感器类型列表（供参考）
const ALL_SENSOR_TYPES = [
  'hand0205', 'robot1', 'robotSY', 'robotLCF', 'footVideo',
  'fast256', 'fast1024', 'sofa', 'eye', 'daliegu',
  'yanfeng10', 'foot', 'carQX', 'volvo', 'car', 'car10',
  'jqbed', 'matCol', 'matColPos', 'carCol', 'newHand',
  'smallBed', 'xiyueReal1', 'gloves', 'gloves1', 'gloves2',
  'hand0205Point', 'hand0205Point147', 'ware', 'robot',
  'handVideo', 'handVideo1', 'bed1616', 'footVideo256',
  'bed4096', 'bed4096num', 'fast1024sit', 'car100',
  'hand0507', 'bigBed', 'sitCol', 'sit10', 'smallBed1',
  'smallM', 'rect', 'short', 'CarTq', 'normal', 'chairQX',
  'Num3D', 'robot0428', 'handBlue', 'localCar'
];

console.log('=== 密钥生成工具 ===');
console.log('');
console.log('支持三种授权模式:');
console.log('  1. all+天数          → 授权所有传感器类型');
console.log('  2. 单类型+天数       → 只授权一个类型，如: hand0205+365');
console.log('  3. 多类型+天数       → 授权多个类型，用逗号分隔，如: hand0205,footVideo,fast256+365');
console.log('');
console.log('可用的传感器类型:');
console.log(ALL_SENSOR_TYPES.join(', '));
console.log('');

rl.question('请输入授权类型+天数: ', (input) => {
  const plusIndex = input.lastIndexOf('+');
  if (plusIndex === -1) {
    console.error('格式错误！请使用 "类型+天数" 格式');
    rl.close();
    return;
  }

  const fileStr = input.substring(0, plusIndex).trim();
  const days = parseInt(input.substring(plusIndex + 1).trim());

  if (isNaN(days) || days <= 0) {
    console.error('天数必须为正整数');
    rl.close();
    return;
  }

  // 解析 file 字段
  let file;
  if (fileStr === 'all') {
    file = 'all';
  } else if (fileStr.includes(',')) {
    // 多类型模式：用逗号分隔，存为数组
    const types = fileStr.split(',').map(t => t.trim()).filter(Boolean);
    // 验证类型是否合法
    const invalid = types.filter(t => !ALL_SENSOR_TYPES.includes(t));
    if (invalid.length > 0) {
      console.warn(`警告: 以下类型不在已知列表中: ${invalid.join(', ')}`);
    }
    file = types;
  } else {
    // 单类型模式
    if (!ALL_SENSOR_TYPES.includes(fileStr)) {
      console.warn(`警告: 类型 "${fileStr}" 不在已知列表中`);
    }
    file = fileStr;
  }

  const date = new Date().getTime() + days * 24 * 60 * 60 * 1000;
  const obj = { date, file };

  console.log('');
  console.log('密钥信息:');
  console.log(`  授权类型: ${Array.isArray(file) ? file.join(', ') + ` (共${file.length}个)` : file}`);
  console.log(`  有效天数: ${days} 天`);
  console.log(`  到期时间: ${new Date(date).toLocaleString()}`);
  console.log('');
  console.log(`密钥: ${module2.encStr(JSON.stringify(obj))}`);

  rl.close();
});
