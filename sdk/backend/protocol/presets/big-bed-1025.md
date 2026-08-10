# bigBed 1025 字节分片

**JSON 预设**：⚠️ 没有。单个分片能解，但**两片拼成一张矩阵不行**，见 [schema 缺口](#schema-缺口)。

一张 64×32 = 2048 点的大床矩阵，分两个 1025 字节的分片发。
和[标准 1024 帧](standard-1024.md)只差**一个字节**，那个字节是分片标志。

## 分片结构

```
偏移   0 ────────────────────── 1023   1024
     ┌────────────────────────────────┬────────┐
     │ 1024 × uint8 压力               │ 分片标志│
     └────────────────────────────────┴────────┘
      1024B                             1B       = 1025B
```

| 字段 | 偏移 | 长度 | 说明 |
| :--- | ---: | ---: | :--- |
| 压力 | 0 | 1024 | 半张矩阵 |
| `chunkFlag` | **1024**（最后一字节） | 1 | `0` = 前半片，`1` = 后半片，其它值 = 丢弃 |

| 项 | 值 |
| :--- | :--- |
| 分隔符 | `AA 55 03 99`（**与标准帧完全相同**） |
| 分帧方式 | 按分隔符切分，分隔符不保留 |
| 分片长度 | 1025（严格相等判定） |
| 数据类型 | `uint8` |
| 拼出的点数 | 1024 × 2 = **2048**（64×32） |
| 默认波特率 | 1000000（传感器表里没有显式波特率，走默认值） |
| 校验 | 无 |

## 和标准 1024 帧只差一个字节

这是最容易踩的坑：**同一个分隔符，帧长 1024 vs 1025**。
判定条件是传感器类型名 + 帧长同时成立：

```js
if (context.file !== 'bigBed' || buffer.length !== 1025) return null;
```

注意这里是 `!==` **严格等于 `'bigBed'`**，不像 `bed4096` 用的是 `includes()`。
所以传感器类型名必须一字不差地是 `bigBed`。

## 拼片规则

| `chunkFlag` | 行为 |
| :--- | :--- |
| `0` | 存成 `firstData`（前半片），**不输出完整帧** |
| `1` | 取出上次的 `firstData` 作为前半，本片作为后半，`combineBigBedRows()` 拼成 2048 点输出 |
| 其它 | 只返回原始分片，不参与拼接 |

拼接函数是 `combineBigBedRows(context.firstData || [], payload)`，**按行交织**，不是简单前后拼接：

```
每一行 64 个点 = firstData 的 32 个点 + lastData 的 32 个点
combined = [first行0(32), last行0(32), first行1(32), last行1(32), ...]  共 32 行
```

两个分片各自是一张 32×32，合成后是 32 行 × 64 列。
源码注释把它们叫「上半片/下半片」，但实际落位是**每行的左半 / 右半**。
`firstData` 缺失时传空数组，不会抛错，但那一帧每行的左半是 `undefined`。

## 通道

走独立的 parser 通道 `bigBedSit`（`SERIAL_PARSER_CHANNELS.BIG_BED_SIT`），
用的仍是标准分隔符。传感器定义里 `channels: ['sit', 'head']`。

## schema 缺口

| 缺什么 | 具体挡在哪 |
| :--- | :--- |
| **跨帧组装** | 一张矩阵来自两个分片，schema 是一帧进一帧出 |
| 按字段值路由 | 要读第 1024 字节的 `chunkFlag` 决定这片放哪 |

单个分片其实**可以**声明（`delimiter` 分帧 + `uint8` × 1024 @ offset 0，末尾那个标志字节不解码），
但那样只能得到半张矩阵、而且不知道是哪半张 —— 所以不放 JSON 预设。
补法：加 `assembly: {flagByteOffset: 1024, chunkCount: 2, combine: 'interleaveRows'}` 之类的分片声明。

## 代码位置

| 想看什么 | 位置 |
| :--- | :--- |
| 分片处理和拼接 | `backend/sensors/runtime/legacyBigBedFrameProcessor.js` 的 `processChunk` |
| parser 通道选择 | `backend/server/server.js`（`getSensorType() === 'bigBed'` → `BIG_BED_SIT`） |
| 矩阵定义 | `backend/sensors/registry.js` 的 `MATRIX_BIG_BED`（64×32，total 2048） |
| 2048 点的空帧初始化 | `backend/server/server.js`（`sensorType === 'bigBed' ? 2048 : sitTotal`） |

## 排错

| 现象 | 一般原因 |
| :--- | :--- |
| 一帧都收不到 | 传感器类型名不是**恰好** `bigBed`，或帧长是 1024 不是 1025 |
| 只有半张矩阵有数据 | 前半片丢了，或 `chunkFlag` 不是 0/1 |
| 矩阵左右两半错位 | 分片顺序错了，或 `combineBigBedRows` 的行宽假设与硬件不符 |
| 被当成标准 1024 帧解 | 两者分隔符相同，只能靠帧长和类型名区分 |
