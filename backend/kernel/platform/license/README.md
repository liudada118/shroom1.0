# 授权

> 最后更新：2026-08-29

四个文件，职责切得很干净：一个管加解密，一个管**路径**，一个管**读写**，一个管**判定**。

分层的理由是可测性——判定逻辑不碰文件系统，所以能直接喂假数据测；文件 I/O 不含业务判断，所以出错时只需要看路径。

## 本目录文件

| 文件 | 作用 | 边界 |
| --- | --- | --- |
| `aes_ecb.js` | AES-ECB / Pkcs7 加解密，38 行。导出 `encStr`、`decryptStr` | 密钥硬编码在文件里，见下面「已知问题」。ECB 模式没有 IV，相同明文得到相同密文 |
| `licenseHelper.js` | 只算路径，不读不写。`getConfigFileCandidates` 列出候选位置、`getWritableConfigFile` 挑一个可写的、`resolveConfigFile` 解析最终路径 | 一个字节都不碰文件内容。安装目录只读、用户目录可写这类差异全在这里消化 |
| `licenseKeyStore.js` | 落盘读写。`findExistingConfigFile`、`readStoredLicenseKey`、`writeStoredLicenseKey` | 路径全靠 `licenseHelper` 提供，自己不拼路径。只管存取密钥字符串，不解析它 |
| `licenseValidationService.js` | 判定层。`validateLicenseKey` 校验密钥、`buildLicenseRuntimeState` 构造运行态、`getSelectFlagFromLicense` / `getDefaultFileFromLicense` 取授权范围 | **无任何文件 I/O**，纯函数式。密钥字符串从参数进来，结果从返回值出去 |

## 授权范围决定前端能选什么

`getSelectFlagFromLicense` 返回的 `selectFlag` 直接决定前端传感器类型下拉框里有哪些选项，`getDefaultFileFromLicense` 决定默认选中哪个。

这是授权最实际的作用点：不是弹个框拦一下，而是让没授权的传感器类型根本不出现在界面上。改这两个函数等于改授权范围，属高风险改动。

## 已知问题（三个，都没动）

**1. `aes_ecb.js` 的密钥是硬编码的，而且用的是 ECB。**

密钥以字面量写在文件里（这份文档不复述它的值）。同一个密钥还被复制进了前端——`client/src/page/license/aesUtil.js` 的文件头注释写着「与后端 aes_ecb.js 使用完全相同的密钥和算法」，`crypto-lib.cjs:9` 也声明了同一套算法。

也就是说这个密钥现在有三份，其中一份在会打进渲染进程的前端代码里。ECB 模式本身也不适合加密结构化数据（无 IV，相同明文块产生相同密文块，能看出模式）。

改这个属于安全配置变更，而且要三处同步改、还要考虑已发出去的旧密钥怎么兼容——必须人工确认，不能顺手做。

**2. 三个测试还指着已经不存在的路径。**

```
test/all_sensor_e2e_test.js:120
test/all_sensor_ws_test.js:316
test/e2e_serial_test.js:55
```

三处都是 `require(path.join(..., 'backend', 'license', 'aes_ecb'))`。`backend/license/` 在架构重构时搬到了现在这个 `backend/kernel/platform/license/`，所以这三个测试一跑就是 `Cannot find module`。

（`tools/generators/gen.js` 和 `genType.js` 已经指向新路径，说明搬迁时改了工具没改测试。）

**3. `getSelectFlagFromLicense` / `getDefaultFileFromLicense` 在 `server.js` 里有逐字符相同的第二份。**

见 `../README.md` 的「一处确认过的重复代码」。`server.js:151` 已经 require 了本目录的 `licenseValidationService`，删掉本地那两份是零行为变化的改动，但同样因为属授权链路而搁置。

## 运行期复检目前是缺的

旧架构有 `licenseManager.startRuntimeRecheck`，定时重新校验，能在运行中发现吊销、暂停、到期和时间回拨。重构之后这条链路没有对应实现：`validateLicenseKey` 只在 `server.js:1317` 被调用一次，即用户提交密钥的时候。

后果是吊销、暂停、运行中到期、运行中时间回拨全都要等到下次重启才生效。根目录还留着一个 `licenseManager.js`，但它 require 的 `./logger`、`./configManager`、`./aes_ecb` 都已不存在，加载即抛错，且无人 require——是孤儿文件，不能当成还在跑。

## 边界

- 授权判定属高风险改动，一律人工确认。
- 密钥值不写进任何文档、日志或错误信息。
- `licenseHelper` 的候选路径顺序有意义（可写优先），改顺序会影响已安装机器读到哪份密钥。
