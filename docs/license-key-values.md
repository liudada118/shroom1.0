# License 页面 Key/Value 与密钥规则

来源：

- `client/src/page/license/License.jsx`
- `client/src/page/date/Date.jsx`
- `client/src/page/licensePortal/LicensePortal.jsx`
- `client/src/page/licensePortal/solutionConfig.jsx`
- `client/src/page/license/aesUtil.js`
- `aes_ecb.js`
- `server.js`
- `licenseHelper.js`

## 页面入口

- `/`：应用启动密钥输入页，使用行业解决方案体验中心样式，输入密钥后通过 WebSocket 交给后端验证；验证成功后默认停留在当前页，显示“进入系统”按钮，由用户手动进入 `/system`。
- `/license`：面向用户的行业解决方案体验中心，只负责输入访问密钥、前端 AES-ECB 校验、展示已解锁方案，并通过 WebSocket 写入应用。
- `/license-admin`：验证方密钥配置中心，负责解析、预览和写入密钥；密钥由外部发证服务生成。

## 密钥生成规则

1. 外部发证服务选择授权范围并生成密钥；桌面端 `crypto-lib.cjs` 保留相同的生成/解码契约供服务端复用和自动化验证。
2. `file` / 离线 `sensorTypes` 授权范围支持：
   - 全部授权：`"all"`。
   - 单类型授权：单个传感器 key 字符串，例如 `"hand0205"`。
   - 多类型授权：传感器 key 数组，例如 `["hand0205", "fast1024"]`。
   - 分类全部授权：稳定令牌 `"@group:<groupKey>"`，例如精密全部为 `"@group:precision"`。
   - 混合授权：分类令牌与具体传感器可放在同一数组，例如 `["@group:care", "humanBodyOptimized"]`；运行时按顺序展开并去重。
3. 分类令牌密钥版本为 v3；旧单类型、固定数组和 `all` 密钥继续按原规则兼容。
4. 发证端必须只签发注册表存在的分类；验证端遇到未知 `@group:` 令牌时拒绝密钥，不能把它当成普通展示系统 key。
5. `moduleConfig` 是可选字段，只使用具体展示系统 key，不使用分类令牌；未配置的传感器由前端按默认模块处理。
6. 最终明文 payload 先执行 `JSON.stringify(obj)`，再用 AES-ECB 加密，输出十六进制密文字符串。离线密钥则把相同授权范围写入签名 payload 的 `sensorTypes`。

生成的明文结构：

```json
{
  "date": 1790000000000,
  "file": ["@group:precision", "jqbed"],
  "moduleConfig": {
    "hand0205": "skin"
  },
  "v": 3
}
```

### 分类全部 Key/Value

分类注册表唯一来源为根目录 `licenseSensorGroups.json`，发证端与验证端必须使用相同的 `groupKey`。该文件会进入 Electron 后端运行包，同时被 Vite 内联到前端构建。已有分类密钥会在新版软件中按当前注册表重新展开；因此以后向某分类加入展示系统时，未过期的该分类密钥会自动获得新增系统。

| 分类 | 令牌 | 当前展开范围 |
| --- | --- | --- |
| 常用全部 | `@group:common` | `hand` |
| 关怀全部 | `@group:care` | `jqbed`、`petCare`、`petCareMini` |
| 实验室全部 | `@group:lab` | `bed4096`、`bed4096num` |
| 定制全部 | `@group:custom` | `smallBedNoAlg`、`smallBed12B`、`matCol`、`tempFullBed`、`wholeChair`、`minzhen` |
| 精密全部 | `@group:precision` | 注册表中的全部精密展示系统，包括 `humanBody` 与 `humanBodyOptimized` |

### 发证服务生成分类密钥

发证服务不要在生成密钥时把分类展开成固定数组，而要把稳定分类令牌原样写入 `file`。这样以后向分类注册表加入系统时，已有且未过期的分类密钥才能在新版客户端中自动获得该系统。

发证接口可以按下面的契约接入项目根目录的生成模块：

```js
const {
  createGroupScopeToken,
  generateLicenseKey,
} = require('./crypto-lib.cjs');

function issueCategoryLicense({ groupKey, days, category = 'production' }) {
  const licenseFile = createGroupScopeToken(groupKey);
  return generateLicenseKey(licenseFile, days, category);
}

// 精密全部
const key = issueCategoryLicense({
  groupKey: 'precision',
  days: 365,
});
```

若发证服务不是直接引用本仓库模块，也必须保持同样的 payload 契约：`file="@group:precision"`、`v=3`，并使用与客户端相同的 AES 参数。发证服务的分类下拉必须读取同步后的 `licenseSensorGroups.json`，不能再维护另一份手写分类数组；收到未知 `groupKey` 时应拒绝生成。

### 新增展示系统同步到发证服务

新增展示系统时按以下顺序处理：

1. 在桌面端完成系统 key、协议、页面、标题与国际化注册。
2. 把该系统的 key **只加入一次**到根目录 `licenseSensorGroups.json` 对应分类的 `items`；启动时会校验分类 key、系统 key 是否重复以及分类是否为空。
3. 把共享注册表同步到实际发证服务仓库：

   ```powershell
   node scripts/sync-license-registry.cjs D:\实际发证服务\config\licenseSensorGroups.json
   ```

   目标目录必须已存在。命令会输出分类数量、展示系统数量和 SHA-256；发证服务应加载这个 JSON 并保留该摘要用于发布核对。
4. 发布发证服务，再发布包含同一注册表的新桌面端。两边的注册表 SHA-256 应一致。
5. 使用分类令牌签发的旧密钥无需重发；固定单系统/固定数组密钥不会自动增加新系统，需要重新签发才会包含它。

发证服务需要同步处理三个入口：

- 分类下拉：从同步后的注册表生成选项，提交值使用 `group.key`，不要提交中文名称。
- 密钥生成：把选中的分类转成 `@group:<groupKey>` 后签入 `file`，并将版本写为 `v: 3`。
- 密钥校验：用同一注册表展开分类，将具体 `sensorTypes` 返回给桌面端；未知分类必须返回无效。

若服务端还提供桌面端正在使用的 `GET /sensorTypes`，新增系统也要出现在该接口中。接口格式保持：

```json
{
  "time": 1790000000000,
  "flat": [
    { "label": "人体全身优化", "value": "humanBodyOptimized", "group": "精密" }
  ],
  "map": {
    "humanBodyOptimized": "人体全身优化"
  }
}
```

其中 `value` 必须与共享注册表和桌面端内部系统 key 完全一致；`label` 只负责显示。发布后桌面端会后台拉取 `/sensorTypes` 并缓存，用于动态系统名称清单，但授权能否使用该系统仍由密钥中的 `file` 分类范围决定。

本机当前没有 `https://shroom.jq-industries.com` 所对应的真实发证服务源码，因此本仓库只提供共享注册表、校验器和同步工具；拿到真实服务仓库路径后，将上述 JSON 接到它的分类下拉和签发入口即可。

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
   - `licenseFile = parsedLicense.file || null`，保留密钥中的原始分类令牌用于状态管理
   - `selectFlag = getSelectFlagFromLicense(parsedLicense.file)`，分类令牌在这里展开为具体展示系统列表
   - `file = getDefaultFileFromLicense(parsedLicense.file)`，使用展开后的第一个展示系统作为默认系统
   - `baudRate = getSensorBaudRate(file)`
6. 向所有前端连接广播授权状态：

```json
{
  "date": 1790000000000,
  "nowDate": 1780000000000,
  "file": ["hand0205", "fast1024"],
  "activeSensorType": "hand0205",
  "selectFlag": ["hand0205", "fast1024"],
  "moduleConfig": {
    "hand0205": "skin"
  }
}
```

其中下发给前端的 `file` / `selectFlag` 已是展开、去重后的具体展示系统范围，不会把 `@group:` 伪装成可切换系统；`activeSensorType` 表示后端当前实际使用的展示系统、串口协议和数据库。前端系统页必须优先按 `activeSensorType` 设置默认展示，避免“界面系统已授权但与后端当前解析系统不同”导致串口无法正确连接。

如果 JSON 解析或处理失败，广播 `licenseError: "密钥无效，请检查后重新输入"`。

## 启动加载规则

后端启动时：

1. `server.js` 调用 `resolveConfigFile()` 解析可用 `config.txt`。
2. 如果文件存在，读取密文并调用 `decryptStr()` 解密。
3. 解密结果按 JSON 解析，读取 `date` 与 `file`。
4. `date` 转成数字后写入全局 `endDate`。
5. `file` 决定启动默认系统：
   - 分类令牌或混合数组：先展开、去重，再取第一个具体展示系统。
   - 普通数组：取第一个具体展示系统。
   - 普通字符串且不是 `all`：使用该字符串。
   - `all` 或无有效值：回退到默认 `hand0205`。
6. 根据默认系统 key 计算串口波特率。
7. 前端连接时，后端同时下发授权范围 `file/selectFlag` 和实际运行系统 `activeSensorType`；多类型授权时前端默认选中 `activeSensorType`，与后端串口解析保持一致。
8. 如果文件不存在，只记录日志并跳过加载；前端连接时会收到无有效密钥提示。

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
| `file` / `sensorTypes` 含 `@group:<groupKey>` | 按共享注册表展开分类全部，去重后下发 |
| `@group:` 的分类不存在 | 拒绝密钥，授权范围无效 |
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
| `file` | 授权范围：`all`、单个传感器 key、传感器 key 数组、`@group:<groupKey>` 分类全部令牌，或分类令牌与具体 key 的混合数组 |
| `moduleConfig` | 可选对象，形如 `{ [sensorKey]: numMatrixFlag }`，用于指定默认功能模块 |

`/license-admin` 只负责解析、预览和写入密钥，不在桌面端签发密钥。分类密钥由外部发证服务按上面的 v3 规则生成。

## 授权传感器 Key/Value

| 序号 | 分组 | Key | Value |
| --- | --- | --- | --- |
| 1 | 常用 | `hand` | 手部检测 |
| 2 | 关怀 | `jqbed` | 小床监测 |
| 3 | 关怀 | `petCare` | 宠物看护 |
| 4 | lab | `bed4096` | OneStep |
| 4.1 | lab | `bed4096num` | OneStep 数字展示 |
| 5 | 定制 | `smallBedNoAlg` | 小床检测(数据) |
| 6 | 定制 | `smallBed12B` | 小床检测(12B) |
| 7 | 定制 | `matCol` | 小床褥采集 |
| 8 | 定制 | `tempFullBed` | 温度全床系统 |
| 9 | 定制 | `wholeChair` | 整椅展示 |
| 10 | 定制 | `minzhen` | 轮椅 |
| 11 | 精密 | `handSinglePoint` | 32*32(检测点) |
| 12 | 精密 | `hand0205` | 触觉手套 |
| 13 | 精密 | `hand0205Double` | 触觉手套2 |
| 14 | 精密 | `handGlove115200` | 触觉手套(115200) |
| 15 | 精密 | `handGloveFullPacket` | 触觉手套(整包) |
| 16 | 精密 | `smallSample` | 10*10小样 |
| 17 | 精密 | `robot1` | 宇树G1触觉上衣 |
| 18 | 精密 | `robotSY` | 松延N2触觉上衣 |
| 19 | 精密 | `robotLCF` | 零次方H1触觉上衣 |
| 20 | 精密 | `footVideo` | 触觉足底 |
| 21 | 精密 | `daliegu` | 14x20高速 |
| 22 | 精密 | `fast256` | 16x16高速 |
| 23 | 精密 | `fast1024` | 32x32高速 |
| 24 | 精密 | `humanBody` | 人体全身 |
| 25 | 关怀 | `petCareMini` | mini看护 |
| 26 | 精密 | `humanBodyOptimized` | 人体全身优化 |

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
| `humanBodyOptimized` | 人体全身优化 | `skin`=3D皮肤<br>`numoriginal`=原始数据 |
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
