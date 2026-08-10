# 小床 12B（1024 × uint16LE）

**JSON 预设**：[`small-bed-12b.json`](small-bed-12b.json) ✅ 系统可直接加载

小床 12B 是唯一一个用**双字节 ADC** 的压力协议，也是唯一用独立八字节帧尾的。
它的分隔符看起来像标准帧的每个字节后面插了个 `00`，但那是巧合，别当成同一个协议。

## 帧结构

```
┌────────────────────────────────┬──────────────────────────┐
│ 2048 字节 payload              │ AA 00 55 00 03 00 99 00  │
│ = 1024 × uint16 (little-endian)│ 帧尾 8B                  │
└────────────────────────────────┴──────────────────────────┘
```

| 项 | 值 |
| :--- | :--- |
| 帧尾 | `AA 00 55 00 03 00 99 00`（十进制 `170 0 85 0 3 0 153 0`） |
| 分帧方式 | 按帧尾切分，帧尾不保留 |
| 有效载荷 | **2048** 字节 |
| 数据类型 | `uint16le` —— 低字节在前 |
| 点数 | 1024（2048 ÷ 2） |
| 默认波特率 | 1500000 |
| 校验 | 无。载荷长度必须**严格等于** 2048，否则整帧丢弃 |

## 字节序：这里最容易搞错

每个点占两字节，**低字节在前**：

```
payload[0] = 0x34, payload[1] = 0x12  →  第 0 个点 = 0x1234 = 4660
```

写成大端（`uint16be`）会得到毫无规律的跳变值，看起来像干扰而不像配置错误，所以特别注意。
源码里就是 `source.readUInt16LE(index * 2)`。

## 取值范围

12 位 ADC，理论范围 0~4095，但后端不裁剪，读出来是什么就是什么。
后续还有零点扣除、压强标定、16×16 降采样三步，都不属于协议层。

## 代码位置

| 想看什么 | 位置 |
| :--- | :--- |
| 帧尾常量 / 载荷长度 | `backend/sensors/smallBed12B.js` 的 `FRAME_TAIL`、`PAYLOAD_LENGTH` |
| ADC 帧读取 | 同文件 `readAdcFrame()` |
| parser 通道 | `backend/serial/serialParserManager.js` 的 `SMALL_BED_12B` |
| 运行时装配 | `backend/server/smallBedRuntimeFactory.js`、`backend/sensors/runtime/smallBed12BRuntime.js` |
| manifest 迁移样板 | `backend/displaySystems/examples/small-bed-12b-manifest-demo/` |
| 固定坏列修补 | `backend/processing/matrixTransforms.js` 的 `smallBedZero` |

## 排错

| 现象 | 一般原因 |
| :--- | :--- |
| 完全无帧 | 波特率不是 1500000，或帧尾配成了标准帧的 4 字节版本 |
| 数值大幅乱跳、没有物理规律 | 字节序配成了 `uint16be` |
| 帧被静默丢弃 | 载荷不是 2048 字节（`readAdcFrame` 返回 `null`，不报错） |
| 点数只有 512 或 2048 | `valueCount` 填错了，应为 1024 而不是字节数 |
