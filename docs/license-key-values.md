# License 页面 Key/Value 与密钥规则

来源：

- `client/src/page/license/License.jsx`
- `client/src/page/license/aesUtil.js`
- `aes_ecb.js`
- `server.js`
- `licenseHelper.js`

## 密钥生成规则

1. 管理员进入 `/license` 页面，在“生成密钥”页签中选择授权范围。
2. 授权范围必须满足二选一：
   - 开启“全部授权”，生成 `file: "all"`。
   - 自定义选择至少 1 个传感器，生成单个 key 或 key 数组。
3. 有效期支持两种模式：
   - `days`：按天数生成，要求 `days > 0`，到期时间为 `Date.now() + days * 86400000`。
   - `picker`：指定日期生成，要求已选择 `pickerDate`，到期时间为 `pickerDate.valueOf()`。
4. `file` 字段生成规则：
   - 全部授权：`"all"`。
   - 单类型授权：单个传感器 key 字符串，例如 `"hand0205"`。
   - 多类型授权：传感器 key 数组，例如 `["hand0205", "fast1024"]`。
5. `moduleConfig` 是可选字段，只在页面配置了默认功能模块时写入；未配置的传感器不写入，由前端按默认模块处理。
6. 最终明文 payload 先执行 `JSON.stringify(obj)`，再用 AES-ECB 加密，输出十六进制密文字符串。

生成的明文结构：

```json
{
  "date": 1790000000000,
  "file": ["hand0205", "fast1024"],
  "moduleConfig": {
    "hand0205": "skin"
  }
}
```

加密参数：

| 项 | 规则 |
| --- | --- |
| 算法 | AES |
| 模式 | ECB |
| Padding | Pkcs7 |
| Key 字符串 | `JIANXINGZHEPSVMC` |
| Key 转换 | 逐字符 `charCodeAt(i).toString(16)` 拼接后用 `CryptoJS.enc.Hex.parse()` |
| 输出 | `enc.ciphertext.toString()`，即十六进制密文 |

## 密钥写入规则

License 页面点击“写入应用”时，通过 WebSocket `ws://localhost:19999` 发送：

```json
{
  "date": {
    "date": "<encrypted-license-key>"
  }
}
```

后端收到后执行：

1. 拒绝空字符串，向前端广播 `licenseError: "密钥不能为空，请输入有效密钥"`。
2. 调用 `aes_ecb.js` 的 `decryptStr()` 解密密钥。
3. 解密结果为空时，广播 `licenseError: "密钥无效，解密失败"`。
4. 将密文写入可写 `config.txt`，路径由 `getWritableConfigFile()` 决定。
5. JSON 解析明文，更新运行期变量：
   - `endDate = parseFloat(parsedLicense.date)`
   - `licenseFile = parsedLicense.file || null`
   - `selectFlag = getSelectFlagFromLicense(parsedLicense.file)`
   - `file = getDefaultFileFromLicense(parsedLicense.file)`，如果能取到默认系统 key
   - `baudRate = getSensorBaudRate(file)`
6. 向所有前端连接广播授权状态：

```json
{
  "date": 1790000000000,
  "nowDate": 1780000000000,
  "file": ["hand0205", "fast1024"],
  "selectFlag": ["hand0205", "fast1024"],
  "moduleConfig": {
    "hand0205": "skin"
  }
}
```

如果 JSON 解析或处理失败，广播 `licenseError: "密钥无效，请检查后重新输入"`。

## 启动加载规则

后端启动时：

1. `server.js` 调用 `resolveConfigFile()` 解析可用 `config.txt`。
2. 如果文件存在，读取密文并调用 `decryptStr()` 解密。
3. 解密结果按 JSON 解析，读取 `date` 与 `file`。
4. `date` 转成数字后写入全局 `endDate`。
5. `file` 决定启动默认系统：
   - 数组：取第一个非空字符串。
   - 字符串且不是 `all`：使用该字符串。
   - `all` 或无有效值：回退到默认 `hand0205`。
6. 根据默认系统 key 计算串口波特率。
7. 如果文件不存在，只记录日志并跳过加载；前端连接时会收到无有效密钥提示。

`licenseHelper.js` 也保留了一套授权文件路径和有效期辅助函数，用于统一解析 `config.txt`、读取在线时间和计算剩余天数。

## 校验规则

当前运行时校验分为“密钥格式校验”和“有效期校验”两层。

### 密钥格式校验

| 条件 | 结果 |
| --- | --- |
| 密钥为空 | 拒绝，提示密钥不能为空 |
| AES 解密结果为空 | 拒绝，提示解密失败 |
| 解密后不是合法 JSON | 拒绝，提示密钥无效 |
| JSON 中没有可用 `date` | 后续有效期无法成立，运行期不会获得有效授权 |
| `file` 为 `all` | 视为全部授权 |
| `file` 为字符串 | 视为单类型授权 |
| `file` 为数组 | 过滤非空字符串后视为多类型授权 |
| `moduleConfig` 存在 | 原样下发给前端作为默认模块配置 |

### 有效期校验

1. `server.js` 启动时请求 `http://sensor.bodyta.com:8080/rcv/login/getSystemTime`。
2. 请求成功后取响应 JSON 的 `time` 字段，写入全局 `nowDate`。
3. 多数串口和数据处理入口使用 `nowDate < endDate` 判断是否允许继续处理。
4. 前端收到后端广播的 `date` 和 `nowDate` 后自行计算：
   - `remainMs = endDate - serverNow`
   - `remainDays = Math.ceil(remainMs / 86400000)`
5. `remainMs <= 0` 时，前端显示“密钥已过期”弹窗。
6. `remainDays <= 7` 且未过期时，前端显示“密钥即将过期”警告弹窗。
7. 没有有效 `endDate` 时，后端在前端连接时广播 `licenseError: "未检测到有效密钥，请输入密钥后使用"`。

注意：当前密钥没有服务端签名、客户白名单或在线 license 服务校验。只要能按固定 AES 规则解密成合法 payload，就会进入本地授权流程；安全边界主要依赖密钥字符串保密和本地 `config.txt` 管理。

## 密钥 Payload 字段

| Key | Value / 含义 |
| --- | --- |
| `date` | 到期时间戳，毫秒级 Unix timestamp |
| `file` | 授权范围：`all`、单个传感器 key，或传感器 key 数组 |
| `moduleConfig` | 可选对象，形如 `{ [sensorKey]: numMatrixFlag }`，用于指定默认功能模块 |

## 页面固定 Key/Value

| 类型 | Key | Value |
| --- | --- | --- |
| Tab | `generate` | 生成密钥 |
| Tab | `parse` | 解析密钥 |
| 时间模式 | `days` | 按天数 |
| 时间模式 | `picker` | 指定日期 |

## 授权传感器 Key/Value

| 序号 | 分组 | Key | Value |
| --- | --- | --- | --- |
| 1 | 常用 | `hand` | 手部检测 |
| 2 | 关怀 | `jqbed` | 小床监测 |
| 3 | 关怀 | `petCare` | 宠物看护 |
| 4 | lab | `bed4096` | OneStep |
| 5 | 定制 | `smallBedNoAlg` | 小床检测(数据) |
| 6 | 定制 | `smallBed12B` | 小床检测(12B) |
| 7 | 定制 | `tempFullBed` | 温度全床系统 |
| 8 | 定制 | `wholeChair` | 整椅展示 |
| 9 | 定制 | `minzhen` | 轮椅 |
| 10 | 精密 | `handSinglePoint` | 32*32(检测点) |
| 11 | 精密 | `hand0205` | 触觉手套 |
| 12 | 精密 | `hand0205Double` | 触觉手套2 |
| 13 | 精密 | `handGlove115200` | 触觉手套(115200) |
| 14 | 精密 | `handGloveFullPacket` | 触觉手套(整包) |
| 15 | 精密 | `smallSample` | 10*10小样 |
| 16 | 精密 | `robot1` | 宇树G1触觉上衣 |
| 17 | 精密 | `robotSY` | 松延N2触觉上衣 |
| 18 | 精密 | `robotLCF` | 零次方H1触觉上衣 |
| 19 | 精密 | `footVideo` | 触觉足底 |
| 20 | 精密 | `daliegu` | 14x20高速 |
| 21 | 精密 | `fast256` | 16x16高速 |
| 22 | 精密 | `fast1024` | 32x32高速 |
| 23 | 精密 | `humanBody` | 人体全身 |
| 24 | 关怀 | `petCareMini` | mini看护 |

## numMatrixFlag 模块 Key/Value

未列出的传感器默认回退为 `normal`=3D模型、`numoriginal`=原始数据。

| 传感器 Key | 传感器名称 | 可选模块 Key/Value |
| --- | --- | --- |
| `bed4096` | OneStep | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `bed4096num` |  | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `daliegu` | 14x20高速 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `fast1024` | 32x32高速 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `fast256` | 16x16高速 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `footVideo` | 触觉足底 | `num`=2D数字<br>`normal`=3D模型<br>`numoriginal`=原始数据 |
| `hand` | 手部检测 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `hand0205` | 触觉手套 | `num`=2D数字<br>`normal`=3D遥操<br>`num3D`=3D数字<br>`numoriginal`=原始数据<br>`skin`=3D皮肤 |
| `hand0205Double` | 触觉手套2 | `num`=2D数字<br>`normal`=3D遥操<br>`num3D`=3D数字<br>`numoriginal`=原始数据<br>`skin`=3D皮肤 |
| `handGlove115200` | 触觉手套(115200) | `num`=2D数字<br>`normal`=3D遥操<br>`num3D`=3D数字<br>`numoriginal`=原始数据<br>`skin`=3D皮肤 |
| `handGloveFullPacket` | 触觉手套(整包) | `num`=2D数字<br>`normal`=3D遥操<br>`num3D`=3D数字<br>`numoriginal`=原始数据<br>`skin`=3D皮肤 |
| `handSinglePoint` | 32*32(检测点) | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `humanBody` | 人体全身 | `skin`=3D皮肤 |
| `jqbed` | 小床监测 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `minzhen` | 轮椅 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `petCare` | 宠物看护 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `petCareMini` | mini看护 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `robot1` | 宇树G1触觉上衣 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `robotLCF` | 零次方H1触觉上衣 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `robotSY` | 松延N2触觉上衣 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `smallBed` |  | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `smallBedNoAlg` | 小床检测(数据) | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `smallBed12B` | 小床检测(12B) | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `smallSample` | 10*10小样 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `tempFullBed` | 温度全床系统 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `wholeChair` | 整椅展示 | `normal`=3D模型 |

## 快捷预设 Key/Value

| 类型 | Key | Value |
| --- | --- | --- |
| 传感器预设 | 触觉全套 | `hand0205`, `handGlove115200`, `handGloveFullPacket`, `robot1`, `robotSY`, `robotLCF`, `footVideo` |
| 传感器预设 | 高速矩阵 | `fast256`, `fast1024`, `daliegu` |
| 天数预设 | `30` | 30天 |
| 天数预设 | `90` | 90天 |
| 天数预设 | `180` | 180天 |
| 天数预设 | `365` | 1年 |
| 天数预设 | `730` | 2年 |
| 天数预设 | `1095` | 3年 |
| 过期测试预设 | 已过期1天 | `offset=-1` |
| 过期测试预设 | 已过期7天 | `offset=-7` |
| 过期测试预设 | 已过期30天 | `offset=-30` |
| 过期测试预设 | 1分钟后过期 | `offsetMs=60000` |
| 过期测试预设 | 5分钟后过期 | `offsetMs=300000` |
| 过期测试预设 | 1小时后过期 | `offsetMs=3600000` |
