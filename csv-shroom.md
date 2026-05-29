# Shroom CSV 下载实现说明

本文基于 `csv.md` 的通用下载说明，结合当前 Shroom 项目的实际实现整理。本文只描述现有项目逻辑，不描述尚未实现的下载配置弹窗、字段勾选、路径选择等能力。

## 1. 当前实现范围

本项目 CSV 下载目前主要覆盖三类场景：

1. 历史/回放数据下载：用户在历史数据中选中一条采集记录后，点击标题栏的“下载”按钮导出 CSV。
2. 采集模式自动下载：`sitCol`、`matCol` 在停止采集时，会根据本次采集标签自动触发下载。
3. `localCar` 本地数据下载：前端直接使用 `CSVLink` 将内存中的 `csvData` 导出为 CSV。

其中前两类由后端读取数据库并写 CSV；`localCar` 不走后端数据库导出流程。

## 2. 前端入口

历史/回放下载入口在 `client/src/components/title/Title.jsx`。

当用户点击“下载”按钮时，前端向 WebSocket 发送：

```js
{ download: this.state.dataTime }
```

这里的 `dataTime` 是当前选中的历史记录标识。后端收到后会按该标识查询 `matrix` 表。

`sitCol`、`matCol` 在停止采集时，如果本次采集已经生成了 `loadData`，前端会额外发送：

```js
{ colHZ: this.state.colHZ, download: loadData }
```

`localCar` 的下载按钮使用 `react-csv` 的 `CSVLink`，文件名为当前时间戳，不进入后端 `download` 分支。

## 3. 导出保存路径

CSV 保存目录由 `server.js` 中的 `csvPath` 决定：

```js
const exportRoot = app.isPackaged
  ? (process.platform === 'darwin' ? app.getPath('desktop') : process.resourcesPath)
  : runtimeWritableRoot;

let csvPath = path.join(exportRoot, "data");
```

当前路径规则：

| 运行环境 | CSV 输出目录 |
| :--- | :--- |
| 开发环境 | `E:\shroom1\data` |
| Windows 打包后 | `resources\data` |
| macOS 打包后 | 桌面 `data` 文件夹 |

当前项目没有提供下载前自定义保存目录、路径可写性检测、打开下载文件夹等 UI。目录不存在时，启动时会尝试自动创建。

## 4. 后端下载主流程

后端下载入口在 `server.js` 的 WebSocket 消息处理中：

```js
if (getMessage.download) {
  const selectQuery = "select * from matrix WHERE date=?";
  const params = [getMessage.download];
  ...
}
```

主流程：

1. 接收前端 WebSocket 消息中的 `download` 值。
2. 使用 `download` 值作为 `date` 条件查询 `matrix` 表。
3. 根据当前系统类型 `file` 进入不同导出分支。
4. 从历史帧中解析矩阵数据。
5. 计算秒数、时间、面积、压力、最大值、原始矩阵等字段。
6. 使用 `csv-writer` 写入 `csvPath`。
7. 写入完成后通过 WebSocket 返回 `export csv success`。
8. 写入失败时通过 WebSocket 返回 `export csv failed`。

前端在 `client/src/page/home/Home.jsx` 中优先处理 `jsonObject.download`，并用 `messageApi.info()` 显示下载结果提示。

## 5. 秒数列逻辑

本项目 CSV 的 `seconds` 列由 `getCsvElapsedSeconds()` 计算：

```js
function getCsvElapsedSeconds(rows, rowIndex, baseIndex = 0, frameIndex = 0) {
  const currentTimestamp = Number(rows?.[rowIndex]?.timestamp);
  const baseTimestamp = Number(rows?.[baseIndex]?.timestamp);
  if (Number.isFinite(currentTimestamp) && Number.isFinite(baseTimestamp)) {
    return ((currentTimestamp - baseTimestamp) / 1000).toFixed(3);
  }

  const fallbackHz = Number(colHZ) > 0 ? Number(colHZ) : 12;
  return (frameIndex / fallbackHz).toFixed(3);
}
```

优先使用数据库中的真实时间戳差值作为秒数。只有当时间戳不可用时，才使用采集频率 `colHZ` 兜底计算。这样下载后的 CSV 第一列不是固定按 12 等分，而是尽量反映真实采集时间。

## 6. 文件命名逻辑

当前项目没有统一的“用户可编辑文件名”流程，文件名由系统类型和历史记录时间组成。

常见命名规则：

| 场景 | 文件名示例 |
| :--- | :--- |
| 普通单路系统 | `sit2026-05-29-12-00.csv` |
| `smallBed12B` 通用分支 | `12B2026-05-29-12-00.csv` |
| 多路座椅 sit | `sit2026-05-29-12-00.csv` |
| 多路座椅 back | `back2026-05-29-12-00.csv` |
| 三路系统 head | `head2026-05-29-12-00.csv` |
| `sitCol` / `matCol` | `sitCol{采集记录}.csv` / `matCol{采集记录}.csv` |
| `bigBed` | `bigBed{当前时间}.csv` |

`smallBed12B` 在通用导出分支中通过 `getCsvFilePrefix()` 使用系统简写 `12B` 作为文件名前缀。

## 7. 数据方向与线序

CSV 导出会尽量与前端展示方向保持一致。

当前关键处理：

1. `smallBed`、`jqbed`、`smallBed12B` 会在导出前走 `transposeSquareMatrix()`，沿左上到右下对角线转置 32x32 原始矩阵。
2. `wholeChair` 会按 sit/back/head 分别调用 `normalizeWholeChairFrame()`，保证三路方向与展示一致。
3. `tempFullBed` 会通过专用回放 payload 处理压力与温度数据。
4. 手套类数据会拆分压力矩阵和四元数，避免把姿态数据混入压力矩阵。

因此 CSV 中的 `data` 字段不是单纯数据库原始字符串，而是经过当前系统线序/方向规则处理后的导出数据。

## 8. 字段计算逻辑

本项目 CSV 字段主要来自 `server.js` 中各导出分支构造的 `newData` 对象，再由 `csv-writer` 根据 header 写入文件。不同系统字段不完全一致，但核心字段逻辑如下。

### 通用时间字段

| 字段 | 写入来源 | 计算逻辑 |
| :--- | :--- | :--- |
| `seconds` | `index` | 调用 `getCsvElapsedSeconds(rows, i, historyArr[0], j)`。优先用当前帧 `timestamp` 减起始帧 `timestamp` 后除以 1000，保留 3 位小数；时间戳不可用时使用 `frameIndex / colHZ` 兜底。 |
| `time` | `time` | 调用 `timeStampToDate(rows[i].timestamp)`，把数据库帧时间戳转成可读时间字符串。 |

### 通用压力和面积字段

| 字段 | 写入来源 | 计算逻辑 |
| :--- | :--- | :--- |
| `max` | `max` | 调用 `findMax(pressureData/backData/headData)`，遍历矩阵取最大数值。 |
| `area` | `pressureArea` | 多数分支统计矩阵中有效点数量；通用 sit 分支使用 `pressureData.filter(a => a > 0).length`，back/head 分支常用 `> 10`，`smallBed/smallBed1` 若有前端回放缓存 `sitAreaSelect` 则优先使用缓存值。 |
| `press` | `pressure` | 多数分支先求矩阵总和 `press = data.reduce(...)`，再通过 `totalToN(press)` 写入；当前 `totalToN()` 实际直接返回输入值，因此本字段目前基本等于总压力值。back/head 分支传入 `1.3` 系数参数，但当前 `totalToN()` 没有使用该参数。 |
| `pressure` | `pressuremmgH` | `bigBed` 和 `smallBed/smallBed1` 使用 `calculatePressure()` 进行压力换算；公式当前为 `1.314 * 10^-4 * x^3.955`。 |
| `pressTotal` | `pressValue` | `bigBed` 专用，写入当前帧矩阵总和 `wsPointData.reduce(...)`。 |

### 通用矩阵字段

| 字段 | 写入来源 | 计算逻辑 |
| :--- | :--- | :--- |
| `data` | `realData` | 写入当前系统导出用矩阵。通用分支会先从数据库解析数据，再按系统处理手套拆包、`smallBed/jqbed/12B` 转置、`wholeChair` 三路线序、`tempFullBed` 压力阈值等，最后 `JSON.stringify()` 写入。 |
| `realInitData` | `realInitData` | `smallBed/smallBed1` 专用，直接写入数据库原始 `rows[i].data`，用于保留未处理前的数据。 |
| `algorData` | `dataToInterpGauss` | `smallBed/smallBed1` 专用。先对 32x32 数据调用 `interpSmall(sitData, 32, 32, 1, 2)` 做插值，再调用 `gaussBlur_2(..., 32, 64, 1)` 做高斯处理。 |
| `pressLine` | `pressLine` | `bigBed` 专用。按 64 列统计纵向压力，并用 `smoothValue = smoothValue + (num / 32 - smoothValue) / 3` 做平滑，生成横向压力曲线。 |

### 采集标签字段

| 字段 | 写入来源 | 计算逻辑 |
| :--- | :--- | :--- |
| `label` | `label` | `sitCol/matCol` 专用，从 `getMessage.download.split('_')[1]` 取采集标签。 |

### 手套和姿态字段

| 字段 | 写入来源 | 计算逻辑 |
| :--- | :--- | :--- |
| `quaternion` | `rotate` | 手套类系统专用。新版数据长度大于等于 260 时，前 256 位作为压力矩阵，后 4 位作为四元数；旧版数据取最后 4 位作为四元数。 |

### 温度字段

| 字段 | 写入来源 | 计算逻辑 |
| :--- | :--- | :--- |
| `temperatureCelsius` | `temperatureData` | `tempFullBed` 专用，从历史帧 payload 中的 `temperatureData` 读取，每个值转成 1 位小数字符串后 JSON 写入。 |
| `temperatureAvg` | `temperatureAvg` | `tempFullBed` 专用，从历史帧 payload 中读取平均温度，存在时转成 1 位小数。 |
| `temperatureK` | `temperatureK` | `tempFullBed` 专用，从历史帧 payload 中读取温度 K 值，原样写入。 |

### 内部统计字段

back/head 导出分支会计算一些内部统计字段：

| 字段 | 计算逻辑 |
| :--- | :--- |
| `area1` | 大于 1 的点数。 |
| `area10` | 大于 10 的点数。 |
| `total1` | 全部点总和。 |
| `total10` | 大于 10 的点总和。 |
| `total10area10` | 大于 10 的点总和 / 大于 10 的点数。 |
| `total1area1` | 全部点总和 / 大于 1 的点数。 |

这些字段当前在 `newData` 中会被计算，但对应 CSV header 没有全部打开，所以多数实际导出的 CSV 中看不到它们。后续如果要导出这些字段，需要同步补充 header。

## 9. 各系统导出字段

### bigBed

字段：

| 字段 | 来源字段 | 逻辑 |
| :--- | :--- | :--- |
| `time` | `time` | 当前帧时间戳转可读时间。 |
| `area` | `pressureArea` | 原始矩阵中大于 0 的点数。 |
| `pressTotal` | `pressValue` | 当前帧所有点总和。 |
| `press` | `pressure` | 当前帧总和 / 有效点数，即平均压力。 |
| `pressure` | `pressuremmgH` | 对平滑后的平均压力调用 `calculatePressure()` 换算。 |
| `data` | `realData` | 当前帧矩阵，低于 10 的值会先置 0。 |
| `pressLine` | `pressLine` | 64 列压力线，按列求和并做平滑。 |

### smallBed / smallBed1

字段：

| 字段 | 来源字段 | 逻辑 |
| :--- | :--- | :--- |
| `seconds` | `index` | 真实时间戳差值，失败时按 `colHZ` 兜底。 |
| `time` | `time` | 当前帧时间戳转可读时间。 |
| `area` | `pressureArea` | 优先使用 `sitAreaSelect[i]`，否则统计大于 10 的点数并乘以 `2.1`。 |
| `press` | `pressure` | 优先使用 `sitPressSelect[i]`，否则使用矩阵总和经过 `totalToN()`。 |
| `realInitData` | `realInitData` | 数据库原始 `rows[i].data`。 |
| `压力(mmHg)` | `pressuremmgH` | `calculatePressure(press / 非零点数)`。 |
| `data` | `realData` | `normalizeHistoryPressureData()` 后的数据；小床类会按需要做对角线转置。 |
| `algorData` | `dataToInterpGauss` | `interpSmall()` 插值后再 `gaussBlur_2()` 高斯处理。 |

### sitCol / matCol

字段：

| 字段 | 来源字段 | 逻辑 |
| :--- | :--- | :--- |
| `data` | `realData` | 直接写入数据库 `rows[i].data`。 |
| `label` | `label` | 从下载记录名中按 `_` 拆分取第二段作为采集标签。 |

这两个系统主要用于采集标签数据，字段较少。

### 通用单路系统

适用于多数非 `bigBed`、非 `smallBed/smallBed1`、非 `sitCol/matCol`、非 `car10` 的系统。

字段：

| 字段 | 来源字段 | 逻辑 |
| :--- | :--- | :--- |
| `seconds` | `index` | 真实时间戳差值，失败时按 `colHZ` 兜底。 |
| `max` | `max` | 处理后矩阵最大值。 |
| `time` | `time` | 当前帧时间戳转可读时间。 |
| `area` | `pressureArea` | 优先使用 `sitAreaSelect[i]`，否则统计大于 0 的点数。 |
| `press` | `pressure` | 优先使用 `sitPressSelect[i]`，否则矩阵总和经过 `totalToN()`。 |
| `data` | `realData` | 处理后的矩阵 JSON 字符串。 |
| `quaternion` | `rotate` | 手套类系统的 4 位四元数 JSON 字符串。 |
| `temperatureCelsius` | `temperatureData` | `tempFullBed` 温度矩阵 JSON 字符串。 |
| `temperatureAvg` | `temperatureAvg` | `tempFullBed` 平均温度，1 位小数。 |
| `temperatureK` | `temperatureK` | `tempFullBed` 温度 K 值。 |

### 多路座椅 / 三路系统

多路系统会分开生成文件。

sit 文件字段通常包括：

```text
seconds, max, time, area, press, data
```

back 文件字段通常包括：

```text
seconds, time, max, area, press, data
```

head 文件字段通常包括：

```text
seconds, time, max, area, press, data
```

部分内部统计字段如 `area1`、`area10`、`total1`、`total10` 当前会参与数据对象计算，但不是所有分支都会写入 CSV header。

## 10. 下载结果提示

后端写入 CSV 后通过 WebSocket 广播：

```js
{ download: "export csv success" }
```

或：

```js
{ download: "export csv failed" }
```

前端在 `Home.jsx` 中优先处理 `download` 消息，并通过 `messageApi.info()` 弹出提示。

当前中英文文案来自 `client/src/App.jsx`：

| key | 中文 |
| :--- | :--- |
| `export csv success` | `导出 CSV 成功` |
| `export csv failed` | `导出 CSV 失败` |
| `deleteSuccess` | `删除成功` |

## 11. 当前项目与通用文档的差异

`csv.md` 中描述了更完整的下载系统，但当前 Shroom 项目并未全部实现。

当前没有实现：

1. 下载前配置弹窗。
2. 用户自定义导出路径。
3. 导出字段勾选。
4. 导出格式选择。
5. 下载进度窗口。
6. 下载完成文件列表。
7. 软件内直接打开 CSV 文件。
8. 软件内打开下载文件夹。
9. 路径可写性预检查。
10. CSV BOM 自动补充。

当前已经实现：

1. 按历史记录 `date` 查询数据库。
2. 按系统类型分支生成 CSV。
3. 多路系统分文件导出。
4. 秒数列优先使用真实时间戳。
5. 部分系统的线序/方向导出与展示一致。
6. `smallBed12B` 文件名前缀使用 `12B`。
7. 导出成功/失败通过 WebSocket 回传并在前端提示。

## 12. 当前完整流程

```text
用户选择历史记录
  -> 点击下载
  -> Title.jsx 发送 { download: dataTime }
  -> server.js 根据 date 查询 matrix 表
  -> 根据当前 file 系统类型进入对应导出分支
  -> 解析历史帧数据
  -> 按系统规则做线序/方向处理
  -> 计算 seconds、time、area、press、max、data 等字段
  -> 使用 csv-writer 写入 csvPath
  -> 后端 WebSocket 返回 export csv success 或 export csv failed
  -> Home.jsx 收到 download 消息
  -> messageApi.info 显示导出结果
```

## 13. 后续最小增强建议

如果后续要把 `csv.md` 中的能力逐步迁入本项目，建议按以下顺序做最小改动：

1. 在导出成功消息中带上实际文件路径。
2. 前端提示中显示文件名或保存目录。
3. 增加“打开下载文件夹”按钮。
4. 增加路径可写性检查。
5. 最后再考虑下载配置弹窗和字段勾选。

这样可以先解决用户找文件和确认导出结果的问题，同时避免一次性重构当前稳定的 WebSocket 导出链路。
