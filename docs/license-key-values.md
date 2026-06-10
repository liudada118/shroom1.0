# License 页面 Key/Value 对照表

来源：`client/src/page/license/License.jsx`。

## 密钥 Payload 字段

| Key | Value / 含义 |
| --- | --- |
| `date` | 到期时间戳，来自按天数或指定日期计算结果 |
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
| 5 | 定制 | `smallBed12B` | 小床检测(12B) |
| 6 | 定制 | `tempFullBed` | 温度全床系统 |
| 7 | 定制 | `wholeChair` | 整椅展示 |
| 8 | 定制 | `minzhen` | 轮椅 |
| 9 | 精密 | `handSinglePoint` | 32*32(检测点) |
| 10 | 精密 | `hand0205` | 触觉手套 |
| 11 | 精密 | `hand0205Double` | 触觉手套2 |
| 12 | 精密 | `handGlove115200` | 触觉手套(115200) |
| 13 | 精密 | `handGloveFullPacket` | 触觉手套(整包) |
| 14 | 精密 | `smallSample` | 10*10小样 |
| 15 | 精密 | `robot1` | 宇树G1触觉上衣 |
| 16 | 精密 | `robotSY` | 松延N2触觉上衣 |
| 17 | 精密 | `robotLCF` | 零次方H1触觉上衣 |
| 18 | 精密 | `footVideo` | 触觉足底 |
| 19 | 精密 | `daliegu` | 14x20高速 |
| 20 | 精密 | `fast256` | 16x16高速 |
| 21 | 精密 | `fast1024` | 32x32高速 |
| 22 | 精密 | `humanBody` | 人体全身 |
| 23 | 关怀 | `petCareMini` | mini看护 |

| 24 | 定制 | `smallBedNoAlg` | 小床检测(数据) |

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
## 2026-06-10 Small Bed License Updates

This section records the current readable key/value additions for the small-bed display split.

### Authorized Sensor Key/Value

| Group | Key | Value |
| --- | --- | --- |
| 定制 | `smallBedNoAlg` | 小床检测(数据) |

### numMatrixFlag Modules

| Sensor Key | Sensor Name | Module Key/Value |
| --- | --- | --- |
| `smallBedNoAlg` | 小床检测(数据) | `normal`=3D模型<br>`numoriginal`=原始数据 |

`smallBedNoAlg` uses the same serial protocol and visualization modules as `smallBed`, but it is not connected to the Python vital-signs algorithm package.
