# License 页面 Key/Value 与密钥规则

来源：

- `client/src/page/license/License.jsx`
- `client/src/page/date/Date.jsx`
- `client/src/page/licensePortal/LicensePortal.jsx`
- `client/src/page/licensePortal/solutionConfig.jsx`
- `client/src/page/license/aesUtil.js`
- `licenseSensorGroups.json`
- `licenseScopes.js`
- `backend/kernel/platform/license/aes_ecb.js`
- `backend/kernel/platform/license/licenseValidationService.js`
- `backend/kernel/platform/server.js`
- `licenseHelper.js`

## 分类全选稳定契约

- `licenseSensorGroups.json` 是分类和内置展示系统的唯一注册表，客户端预览、主进程兜底清单和授权库都从它读取。
- Agent 或外部发证服务可从软件安装目录读取 `licenseSensorGroups.json`，并通过根级 `licenseScopes.js` 生成分类令牌和预检展开结果。本阶段不调整公共 SDK。
- 分类授权在密钥中保存稳定令牌 `@group:<groupKey>`，例如 `@group:care`；不把当时展开出的系统数组写死进密钥。
- 后端收到密钥后才把令牌展开成当前分类下的具体系统，并把展开结果作为 `selectFlag` 发给前端。因此同一分类中的系统调整只需同步注册表和重新打包，不需要重签已有分类密钥。
- 分类令牌可与具体系统 key 混用，例如 `["@group:care", "humanBodyOptimized"]`；展开结果保持声明顺序并自动去重。
- 未知分类令牌一律以 `LICENSE_SCOPE_INVALID` 拒绝，不能退化成普通系统 key，避免授权范围意外放大。
- `all` 仍表示不限制系统；单 key 和固定 key 数组的旧密钥行为保持兼容。

稳定分类 key：`common`（常用）、`care`（关怀）、`lab`（实验室）、`custom`（定制）、`precision`（精密）。

## 页面入口

- `/`：应用启动密钥输入页，使用行业解决方案体验中心样式，输入密钥后通过 WebSocket 交给后端验证；验证成功后默认停留在当前页，显示“进入系统”按钮，由用户手动进入 `/system`。
- `/license`：面向用户的行业解决方案体验中心，只负责输入访问密钥、前端 AES-ECB 校验、展示已解锁方案，并通过 WebSocket 写入应用。
- `/license-admin`：管理员密钥配置中心，负责生成、复制、写入和解析密钥，沿用 `client/src/page/license/License.jsx`。

## 密钥生成规则

1. 管理员进入 `/license-admin` 页面，在“生成密钥”页签中选择授权范围。
2. 授权范围必须满足二选一：
   - 开启“全部授权”，生成 `file: "all"`。
   - 选择某个分类全部，生成 `@group:<groupKey>`；也可以与具体系统组合。
   - 自定义选择至少 1 个传感器，生成单个 key 或 key 数组。
3. 有效期支持两种模式：
   - `days`：按天数生成，要求 `days > 0`，到期时间为 `Date.now() + days * 86400000`。
   - `picker`：指定日期生成，要求已选择 `pickerDate`，到期时间为 `pickerDate.valueOf()`。
4. `file` 字段生成规则：
   - 全部授权：`"all"`。
   - 分类全选：`"@group:care"`；多个范围可写成 `["@group:care", "humanBodyOptimized"]`。
   - 单类型授权：单个传感器 key 字符串，例如 `"hand0205"`。
   - 多类型授权：传感器 key 数组，例如 `["hand0205", "fast1024"]`。
5. `moduleConfig` 是可选字段，只在页面配置了默认功能模块时写入；未配置的传感器不写入，由前端按默认模块处理。
6. 最终明文 payload 先执行 `JSON.stringify(obj)`，再用 AES-ECB 加密，输出十六进制密文字符串。

生成的明文结构：

```json
{
  "date": 1790000000000,
  "file": ["@group:care", "humanBodyOptimized"],
  "v": 3,
  "moduleConfig": {
    "humanBodyOptimized": "skin"
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

`/` 启动输入页点击“保存”、`/license` 体验页点击“保存”或 `/license-admin` 管理页点击“写入应用”时，通过 WebSocket `ws://localhost:19999` 发送：

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
   - `licenseScopes.expandLicenseFile(parsedLicense.file)` 先展开分类范围并去重
   - `selectFlag` 使用展开后的具体系统数组；`all` 仍保持字符串 `all`
   - `file` 使用展开结果中的第一个系统 key，`all` 则回退当前默认系统
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

如果 JSON 解析失败，广播“密钥无效”；如果分类不存在或授权范围为空，以 `LICENSE_SCOPE_INVALID` 拒绝并提示联系厂商重新签发。

## 启动加载规则

后端启动时：

1. `server.js` 调用 `resolveConfigFile()` 解析可用 `config.txt`。
2. 如果文件存在，读取密文并调用 `decryptStr()` 解密。
3. 解密结果按 JSON 解析，读取 `date` 与 `file`。
4. `date` 转成数字后写入全局 `endDate`。
5. `file` 决定启动默认系统：
   - 分类令牌或含分类的数组：先展开，取第一个具体系统。
   - 固定数组：取第一个有效系统。
   - 单个系统字符串：使用该字符串。
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
| `file` 含合法 `@group:<groupKey>` | 展开为注册表中该分类的全部系统，并向前端下发具体 `selectFlag` |
| `file` 含未知分类或展开后为空 | 拒绝，错误码 `LICENSE_SCOPE_INVALID` |
| `file` 为字符串 | 视为单类型授权 |
| `file` 为数组 | 展开分类、过滤无效空项、按声明顺序去重后视为多类型授权 |
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
| `file` | 授权范围：`all`、`@group:<groupKey>`、单个系统 key，或这些范围的数组 |
| `v` | 密钥范围版本；分类令牌使用 `3`，旧单系统/固定数组继续使用 `2` |
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
| 2 | 常用 | `normal` | 正常测试 |
| 3 | 关怀 | `jqbed` | 小床监测 |
| 4 | 关怀 | `petCare` | 宠物看护 |
| 5 | 关怀 | `petCareMini` | mini 看护 |
| 6 | 实验室 | `bed4096` | OneStep |
| 7 | 实验室 | `bed4096num` | 64*64 高速 |
| 8 | 定制 | `smallBedNoAlg` | 小床检测（数据） |
| 9 | 定制 | `smallBed12B` | 小床检测（12B） |
| 10 | 定制 | `matCol` | 小床褥监测 |
| 11 | 定制 | `tempFullBed` | 温度全床系统 |
| 12 | 定制 | `wholeChair` | 整椅展示 |
| 13 | 定制 | `minzhen` | 轮椅 |
| 14 | 定制 | `carQX` | 清闲椅子 |
| 15 | 精密 | `handSinglePoint` | 32*32（检测点） |
| 16 | 精密 | `hand0205` | 触觉手套 |
| 17 | 精密 | `hand0205Double` | 触觉手套 2 |
| 18 | 精密 | `handGlove115200` | 触觉手套（115200） |
| 19 | 精密 | `handGloveFullPacket` | 触觉手套（整包） |
| 20 | 精密 | `smallSample` | 10*10 小样 |
| 21 | 精密 | `robot1` | 宇树 G1 触觉上衣 |
| 22 | 精密 | `robotSY` | 松延 N2 触觉上衣 |
| 23 | 精密 | `robotLCF` | 零次方 H1 触觉上衣 |
| 24 | 精密 | `footVideo` | 触觉足底 |
| 25 | 精密 | `daliegu` | 14*20 高速 |
| 26 | 精密 | `fast256` | 16*16 高速 |
| 27 | 精密 | `fast1024` | 32*32 高速 |
| 28 | 精密 | `humanBodyOptimized` | 人体全身优化 |

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
| `humanBodyOptimized` | 人体全身优化 | `skin`=3D皮肤 |
| `jqbed` | 小床监测 | `normal`=3D模型<br>`numoriginal`=原始数据 |
| `matCol` | 小床褥采集 | `normal`=3D模型<br>`numoriginal`=原始数据（16x10，宽16高10） |
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
