/**
 * licenseKeygen.js
 * 激活码生成工具（管理员专用）
 *
 * 使用 RSA 私钥对授权数据签名，生成绑定机器码的专属激活码。
 * 此文件仅管理员使用，不随软件分发。
 *
 * 使用方式：
 *   node licenseKeygen.js --machineId=A3F8B2C1D4E5F6A7 --types=hand0205,robot1 --days=365
 *   node licenseKeygen.js --machineId=A3F8B2C1D4E5F6A7 --types=all --expire=2027-01-01
 *
 * 参数说明：
 *   --machineId  客户机器码（16位）
 *   --types      传感器类型，逗号分隔，或 "all" 表示全部授权
 *   --days       有效天数（与 --expire 二选一）
 *   --expire     到期日期 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss（与 --days 二选一）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRIVATE_KEY_PATH = path.join(__dirname, 'keys', 'private.pem');
const LICENSE_VERSION = 2;

/** 支持的传感器类型列表 */
const VALID_TYPES = [
  'hand', 'hand0205', 'handGlove115200', 'smallSample',
  'robot1', 'robotSY', 'robotLCF',
  'footVideo', 'daliegu', 'fast256', 'fast1024',
  'jqbed', 'normal',
];

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    args[key] = value;
  });
  return args;
}

/**
 * 生成激活码
 * @param {object} options
 * @param {string} options.machineId - 客户机器码
 * @param {string[]|'all'} options.sensorTypes - 授权的传感器类型
 * @param {number} options.expireDate - 到期时间戳
 * @returns {string} Base64 编码的激活码
 */
function generateActivationCode({ machineId, sensorTypes, expireDate }) {
  // 读取私钥
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');

  // 构造 payload
  const payload = {
    machineId,
    sensorTypes,
    expireDate,
    issuedAt: Date.now(),
    version: LICENSE_VERSION,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');

  // RSA-SHA256 签名
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(payloadB64);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');

  // 组装激活码
  const licenseObj = { payload: payloadB64, signature };
  const activationCode = Buffer.from(JSON.stringify(licenseObj)).toString('base64');

  return activationCode;
}

/**
 * 命令行入口
 */
function main() {
  const args = parseArgs();

  // 校验参数
  if (!args.machineId || args.machineId.length !== 16) {
    console.error('错误：请提供 16 位机器码 --machineId=XXXXXXXXXXXXXXXX');
    process.exit(1);
  }

  if (!args.types) {
    console.error('错误：请提供传感器类型 --types=hand0205,robot1 或 --types=all');
    process.exit(1);
  }

  if (!args.days && !args.expire) {
    console.error('错误：请提供有效期 --days=365 或 --expire=2027-01-01');
    process.exit(1);
  }

  // 解析传感器类型
  let sensorTypes;
  if (args.types === 'all') {
    sensorTypes = 'all';
  } else {
    sensorTypes = args.types.split(',').map(t => t.trim());
    const invalid = sensorTypes.filter(t => !VALID_TYPES.includes(t));
    if (invalid.length > 0) {
      console.error(`错误：无效的传感器类型: ${invalid.join(', ')}`);
      console.error(`支持的类型: ${VALID_TYPES.join(', ')}`);
      process.exit(1);
    }
  }

  // 计算到期时间
  let expireDate;
  if (args.expire) {
    expireDate = new Date(args.expire).getTime();
    if (isNaN(expireDate)) {
      console.error('错误：无效的日期格式，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss');
      process.exit(1);
    }
  } else {
    expireDate = Date.now() + parseInt(args.days) * 24 * 60 * 60 * 1000;
  }

  // 检查私钥
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`错误：私钥文件不存在: ${PRIVATE_KEY_PATH}`);
    console.error('请先生成密钥对: openssl genrsa -out keys/private.pem 2048');
    process.exit(1);
  }

  // 生成激活码
  const code = generateActivationCode({ machineId: args.machineId, sensorTypes, expireDate });

  console.log('\n========================================');
  console.log('  激活码生成成功');
  console.log('========================================');
  console.log(`机器码:     ${args.machineId}`);
  console.log(`传感器类型: ${sensorTypes === 'all' ? '全部授权' : sensorTypes.join(', ')}`);
  console.log(`到期时间:   ${new Date(expireDate).toLocaleString()}`);
  console.log(`有效天数:   ${Math.ceil((expireDate - Date.now()) / (1000 * 60 * 60 * 24))} 天`);
  console.log('----------------------------------------');
  console.log('激活码:');
  console.log(code);
  console.log('========================================\n');
}

// 如果直接运行则执行命令行入口，否则导出函数
if (require.main === module) {
  main();
} else {
  module.exports = { generateActivationCode, VALID_TYPES };
}
