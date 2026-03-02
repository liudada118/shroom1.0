/**
 * aesUtil.js
 * 前端 AES-ECB 加解密工具
 * 与后端 aes_ecb.js 使用完全相同的密钥和算法
 */
import CryptoJS from 'crypto-js';

const KEY_STR = 'JIANXINGZHEPSVMC';

function stringToHex(str) {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return hex;
}

/**
 * AES-ECB 加密
 * @param {string} src - 明文字符串
 * @returns {string} 加密后的十六进制字符串
 */
export function encStr(src) {
  let key = stringToHex(KEY_STR);
  key = CryptoJS.enc.Hex.parse(key);
  const enc = CryptoJS.AES.encrypt(src, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return enc.ciphertext.toString();
}

/**
 * AES-ECB 解密
 * @param {string} enced - 加密后的十六进制字符串
 * @returns {string} 解密后的明文
 */
export function decryptStr(enced) {
  let key = stringToHex(KEY_STR);
  key = CryptoJS.enc.Hex.parse(key);
  const dec = CryptoJS.AES.decrypt(CryptoJS.format.Hex.parse(enced), key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return CryptoJS.enc.Utf8.stringify(dec);
}
