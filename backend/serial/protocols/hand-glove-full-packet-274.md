# 触觉手套整包 274 字节

**JSON 预设**：⚠️ 没有。原因见 [schema 缺口](#schema-缺口)。

一帧同时带 256 点压力和 16 字节 IMU。压力段本身可以用现有 schema 声明，
但**一帧里同时存在 uint8 和 float32LE 两种类型**，现在的 `decoding` 只能声明一种，所以不给半成品预设。

## 帧结构

```
偏移   0      1      2 ────────────── 257   258 ──────────── 273
     ┌──────┬──────┬────────────────────┬──────────────────────┐
     │ 帧号 │ 包型 │ 256 × uint8 压力    │ 16B IMU = 4×float32LE │
     └──────┴──────┴────────────────────┴──────────────────────┘
      1B     1B     256B                  16B                    = 274B
```

| 字段 | 偏移 | 长度 | 类型 | 说明 |
| :--- | ---: | ---: | :--- | :--- |
| `frameIndex` | 0 | 1 | uint8 | 帧序号，仅用于诊断，不参与解码 |
| `packetType` | 1 | 1 | uint8 | 包类型。**但左右手判定并不用它**，见下 |
| `pressureData` | 2 | 256 | uint8 × 256 | 压力点，`bytes.slice(2, 258)` |
| `imuBytes` | 258 | 16 | float32LE × 4 | 姿态，`bytes.slice(258, 274)`，经 `bytes4ToInt10` 转换 |

| 项 | 值 |
| :--- | :--- |
| 总帧长 | 274（`HAND_GLOVE_FULL_PACKET_LENGTH`，硬编码判定） |
| 默认波特率 | 921600 |
| 分帧方式 | 定长 274 |
| 校验 | 无 |

## 两个必须知道的 quirk

这两条都是代码现状，不是笔误，改之前先确认硬件端行为：

**1. `packetType` 被解出来但没被用来判左右手。**

```js
const packetType = bytes[1];
const side = fallbackSide === 'right' ? 'right' : 'left';   // ← 只看 fallbackSide
```

`parseHandGloveFullPacket()` 里 `side` 完全由调用方传入的 `fallbackSide` 决定，
`packetType` 只是原样返回。也就是说**左右手是靠哪条串口通道进来的决定的，不是靠帧内字段**。
接双手时两只手必须插在约定好的通道上，否则左右会颠倒。

**2. 有一个左右手映射函数是死代码，而且和另一个协议的约定相反。**

`getHandGloveFullPacketSide(packetType, fallbackSide)` 定义并导出了，但**全仓没有任何地方调用它**。
它的映射是 `1 → right`、`2 → left`；而[双包协议](hand-glove-double.md)的 `PACKET_SIDE_BY_TYPE`
是 `1 → left`、`2 → right`，**正好相反**。要接整包硬件时不要照着这个死函数写实现，
先在真机上确认 `packetType` 的实际含义。

## IMU 的 4 字节转换

16 字节按 4 字节一组转成 4 个数，走 `bytes4ToInt10()`（`backend/processing` 的 `mathUtils.js`）。
这是自定义的定点/浮点转换，不是标准 `readFloatLE`，所以即使 schema 支持了多字段，
`float32le` 也不一定能直接替代它 —— 迁移时要逐值比对。

## 压力段的映射链

解出 256 点之后还有两步（都不属于协议层）：

1. `mapHandGloveFullPacketPressure(pressureData, side)` → 195 点（15×13）手部展开矩阵，
   点位表在 `HAND_GLOVE_FULL_PACKET_LAYOUT`，左右手各一套，**用的是 1 基索引**。
2. `mapHandGloveFullPacketModelMatrix(mappedData)` → 旧前端要的 32×32 模型矩阵。

## schema 缺口

| 缺什么 | 具体挡在哪 |
| :--- | :--- |
| `decoding` 支持多字段 | 一帧里 `uint8`×256 和 IMU 段类型不同，单 `valueType` 表达不了 |

补法：把 `decoding` 从单对象改成字段数组，例如
`[{name:'pressure', valueType:'uint8', byteOffset:2, valueCount:256}, {name:'imu', valueType:'float32le', byteOffset:258, valueCount:4}]`。
在那之前，这个协议走手写处理器。

## 代码位置

| 想看什么 | 位置 |
| :--- | :--- |
| 帧长常量 | `backend/server/server.js` 的 `HAND_GLOVE_FULL_PACKET_LENGTH` |
| 解析和点位映射 | `backend/sensors/handGloveFullPacket.js` |
| 运行时装配 | `backend/server/handRuntimeFactory.js` |
| 传感器定义 | `backend/sensors/registry.js` 的 `HAND_GLOVE_FULL_PACKET` 条目 |
| manifest 迁移样板 | `backend/displaySystems/examples/hand-glove-manifest-demo/` |

## 排错

| 现象 | 一般原因 |
| :--- | :--- |
| 左右手反了 | 串口通道插反了（左右手不看帧内字段，见 quirk 1） |
| 压力正常但姿态不动 | IMU 段偏移或 `bytes4ToInt10` 的输入不对 |
| 一帧都收不到 | 波特率不是 921600，或硬件在发[双包](hand-glove-double.md)而不是整包 |
| 帧长是 262 | 硬件是[262 字节手套](glove-262.md)，不是整包 |
