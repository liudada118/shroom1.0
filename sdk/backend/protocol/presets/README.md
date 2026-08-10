# 串口协议库

这个目录回答一个问题：**这台机器接进来的串口数据，一帧长什么样？**

每种协议一份 `.md`（人看的字节表）。能被系统直接加载的，额外配一份同名 `.json`（机器读的预设）——
新建传感器时选中预设，波特率 / 分帧 / 解码三段就自动填好了，不用再手抄字节。

## 目录

| 协议 | 文档 | JSON 预设 | 一句话 |
| :--- | :--- | :--- | :--- |
| 标准 1024 压力帧 | [standard-1024.md](standard-1024.md) | ✅ `standard-1024.json` | `AA 55 03 99` 分隔 + 1024×uint8，最常用的一种 |
| 小床 12B | [small-bed-12b.md](small-bed-12b.md) | ✅ `small-bed-12b.json` | 八字节帧尾 + 1024×uint16LE |
| 大床 4096 | [bed-4096.md](bed-4096.md) | ✅ `bed-4096.json` | 同一分隔符，4096×uint8 @ 3M 波特率 |
| 256 点单帧矩阵 | [matrix-256.md](matrix-256.md) | ✅ `matrix-256.json` | 一帧一张 16×16 |
| 低密度 72 / 144 | [low-density-72-144.md](low-density-72-144.md) | ✅ `low-density-72.json` / `low-density-144.json` | 只靠帧长区分 |
| bigBed 1025 分片 | [big-bed-1025.md](big-bed-1025.md) | ⚠️ 部分 | 1024 数据 + 1 字节分片标志，两片拼成 64×32 |
| 触觉手套整包 274 | [hand-glove-full-packet-274.md](hand-glove-full-packet-274.md) | ⚠️ 部分 | 压力 + IMU 混在一帧里 |
| 262 字节手套帧 | [glove-262.md](glove-262.md) | ⚠️ 部分 | 256 压力 + 尾部 6 字节姿态 |
| 触觉手套双包 | [hand-glove-double.md](hand-glove-double.md) | ❌ | 左右手交替、两包拼一帧 |
| 敏枕文本协议 | [minzhen-text.md](minzhen-text.md) | ❌ | ASCII 文本，不是二进制帧 |

「⚠️ 部分」和「❌」的含义见下面 [schema 覆盖不到的地方](#schema-覆盖不到的地方)。**没有半成品预设**：
JSON 只给今天能被系统完整解出来的协议，能解一半的不放 JSON，避免选了预设却拿到半张矩阵还不知道为什么。

## 一份 JSON 预设长什么样

```json
{
  "id": "standard-1024",
  "label": "标准 1024 压力帧 (32x32)",
  "summary": "一句话说明，会显示在预设下拉里",
  "doc": "standard-1024.md",
  "matrix": { "width": 32, "height": 32, "total": 1024 },
  "channels": ["sit", "back", "head"],
  "protocol": { "baudRate": 1000000, "framing": {}, "decoding": {}, "validation": null }
}
```

`protocol` 段**不是这个目录自己发明的格式**，它就是展示系统 manifest 里的 `protocol` 段，
定义和校验都在 [`../../displaySystems/displaySystemProtocol.js`](../../displaySystems/displaySystemProtocol.js)，
解析器由 [`../serialParserManager.js`](../serialParserManager.js) 的 `createParserFromProtocol()` 直接生成。
所以预设里的 `protocol` 可以整段复制进 `display-system.json`，不需要任何转换。

`matrix` 为 `null` 表示**协议本身不决定矩阵形状**（低密度那两种就是这样），得由使用者填。

### protocol 段字段

| 字段 | 取值 | 说明 |
| :--- | :--- | :--- |
| `baudRate` | 正整数，必填 | 缺了会校验失败 |
| `framing.type` | `delimiter` \| `fixedLength` | 分帧方式 |
| `framing.delimiter` | 字节数组 / `"AA 55 03 99"` 十六进制串 | `delimiter` 分帧必填 |
| `framing.frameLength` | 正整数 | `fixedLength` 分帧必填 |
| `framing.includeDelimiter` | 布尔 | 分隔符是否留在帧里，默认 `false` |
| `decoding.valueType` | 见下表 13 种 | 单一类型，整帧按它平铺 |
| `decoding.byteOffset` | 非负整数 | 从帧内第几字节开始解 |
| `decoding.valueCount` | 正整数 | 解多少个值 |
| `validation.headerOffset` / `header` | 偏移 + 期望字节 | 不匹配就丢帧 |
| `validation.checksum` | `{type, byteOffset, range}` | `sum8` / `xor8` / `crc16-modbus` |

`valueType` 支持：`uint8` `int8` `uint16le` `uint16be` `int16le` `int16be` `uint32le` `uint32be`
`int32le` `int32be` `float32le` `float32be` `bit`（位域，LSB 在前）。

字节偏移**可以是负数**，从帧尾往前数——尾部带姿态字节的协议靠这个定位。

## schema 覆盖不到的地方

这里的缺口是**现在就存在的**，写清楚是为了让二开的人知道什么时候必须写代码、什么时候填配置就够：

| 缺口 | 挡住了谁 | 要补什么 |
| :--- | :--- | :--- |
| `decoding` 只能声明**一种** `valueType`，整帧平铺 | 整包 274（压力 uint8 + IMU float32LE）、262（压力 + 姿态）、bigBed（数据 + 标志字节） | `decoding` 改成字段数组：`[{name, valueType, byteOffset, valueCount}]` |
| 没有**跨帧组装**的概念，一帧进一帧出 | 双包手套（两包拼一帧）、bigBed（两片拼一张矩阵） | 加 `assembly: {key, byteOffset, chunkCount}` 之类的分片声明 |
| 只能按字节解，没有**文本协议**入口 | 敏枕（ASCII，靠正则找帧头、按键名取值） | 加 `framing.type: "text"` + 字段正则映射 |

在这些补上之前，对应协议仍然走 `backend/sensors/runtime/` 下的手写处理器，不是配置能表达的。

## 加自己的协议

打包之后不需要重新构建，往可写目录里丢 JSON 就行：

```
<userData>/serial-protocols/my-sensor.json
```

`<userData>` 是 `serverPathConfig` 里的 `runtimeWritableRoot`（开发态就是项目根目录）。
加载器会把这个目录和本目录一起扫，**同 id 时用户目录覆盖内置**，所以可以直接改内置预设的波特率而不动源码。
JSON 校验不通过的文件不会让接口挂掉，它会带着错误原因出现在响应的 `invalid` 里。

看加载结果：`GET /api/serial/protocols`。
