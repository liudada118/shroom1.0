/**
 * 授权字符串的 AES-ECB 加解密。
 *
 * ⚠️ **这不是安全机制，是一层混淆。** 密钥硬编码在本文件里，随包一起分发，
 * 任何拿到安装包的人都能解出来；ECB 模式也没有 IV，相同明文块产出相同密文块。
 * 它的实际作用是「让 config.txt 不能用记事本直接改」，仅此而已。
 *
 * 明确写下来是因为二开者可能误以为授权是密码学上安全的，从而把更敏感的东西
 * （用户数据、服务端凭据）也塞进这套加密里。真要防篡改需要服务端校验或非对称签名。
 *
 * 同时，**它是与已发出授权文件的兼容性契约**：密钥、模式、padding、
 * 甚至下面 `string_to_hex` 的怪异写法，任何一处改动都会让现存所有客户的
 * config.txt 解不出来（现象是全部变成「未授权」）。属于 CLAUDE.md 里
 * 「可能影响历史数据兼容性」那一类，改动前必须人工确认。
 */
const CryptoJS = require("crypto-js");

// 硬编码密钥。见文件头说明：它随包分发，不具备保密性。
// 16 个 ASCII 字符 = 16 字节 = AES-128。长度和字符集都不能随意改，见 string_to_hex。
let keystr = "JIANXINGZHEPSVMC";

// 字符串转hex
//
// ⚠️ **只对 ASCII 可用**：`toString(16)` 不补零，所以码位 < 0x10 的字符只产出 1 位十六进制，
// 而 > 0xFF 的字符（中文）产出 4 位 —— 两种都会让拼出来的 hex 串长度错乱，
// `Hex.parse` 于是得到一个长度不对的密钥，加解密结果全错且**不报错**。
// 当前 keystr 全是可打印 ASCII（每个都恰好 2 位），所以能工作。
// 换密钥时必须仍然是纯 ASCII，或者先把这里改成补零写法（但那会改变现有密钥的解析结果）。
let string_to_hex = function(str) {
  let tempstr = "";
  for (let i = 0; i < str.length; i++) {
    if (tempstr === "") tempstr = str.charCodeAt(i).toString(16);
    else tempstr += str.charCodeAt(i).toString(16);
  }
  return tempstr;
};

/**
 * 加密授权字符串。
 *
 * 用途只有一个：生成 config.txt 里的那串密文。**不要拿它加密别的东西** —— 见文件头，
 * 密钥随包分发，ECB 又没有 IV，相同的明文块每次都产出完全相同的密文块
 * （所以从密文能看出「两份授权的前 16 字节一样」这类信息）。
 *
 * 返回的是 `ciphertext.toString()`，CryptoJS 默认输出**十六进制**而不是 base64。
 * 这就是 `decryptStr` 必须用 `CryptoJS.format.Hex.parse` 的原因 ——
 * 两边的编码约定必须一致，改一边会让所有已发出的 config.txt 解不出来。
 *
 * @param {string} src 明文（授权信息）。
 * @returns {string} 十六进制密文。
 */
function encStr(src) {
  let key = string_to_hex(keystr);

  key = CryptoJS.enc.Hex.parse(key);
  const enc = CryptoJS.AES.encrypt(src, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });

  return enc.ciphertext.toString();
}

/**
 * 解密授权字符串。
 *
 * `CryptoJS.format.Hex.parse(enced)` 是与 `encStr` 的十六进制输出配对的：
 * 少了这一步 CryptoJS 会按 base64 去解 `enced`，两边编码约定必须一致。
 *
 * ⚠️ **解密失败没有可靠的单一信号。** Pkcs7 去 padding 只是按最后一个字节减长度、
 * 不做校验，所以密钥不对/密文被改/编码不对都不会在解密这一步报错，而是得到一段随机字节。
 * 之后 `enc.Utf8.stringify` 遇到非法 UTF-8 会抛 `Malformed UTF-8 data`，
 * 碰巧合法时则返回一段乱码字符串。也就是说调用方（licenseManager）必须
 * **同时**处理「抛异常」和「返回的内容不是预期格式」两种情况，不能只判空。
 *
 * 根因是 ECB + Pkcs7 没有 MAC，无法区分「被篡改」和「本来就不是有效密文」。
 * 这里刻意不吞异常，让「授权文件坏了」这件事能被上层看见。
 *
 * @param {string} enced 十六进制密文（由 encStr 产出）。
 * @returns {string} 明文；密文无效时通常是空串。
 */
function decryptStr(enced) {
  let key = string_to_hex(keystr);

  key = CryptoJS.enc.Hex.parse(key);
  const dec = CryptoJS.AES.decrypt(CryptoJS.format.Hex.parse(enced), key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });

  return CryptoJS.enc.Utf8.stringify(dec);
}
let obj =  { encStr, decryptStr }
module.exports = obj;