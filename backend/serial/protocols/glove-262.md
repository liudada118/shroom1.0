# 262 字节手套帧

**JSON 预设**：⚠️ 没有。压力段可以声明，尾部 6 字节姿态不能，见 [schema 缺口](#schema-缺口)。

最简单的一种手套协议：256 点压力 + 尾部 6 字节姿态，一帧一包，不用拼。

## 帧结构

```
偏移   0 ──────────────────────── 255   256 ─────── 261
     ┌────────────────────────────────┬────────────────┐
     │ 256 × uint8 压力                │ 6B rotate 姿态  │
     └────────────────────────────────┴────────────────┘
      256B                              6B               = 262B
```

| 字段 | 偏移 | 长度 | 类型 | 说明 |
| :--- | ---: | ---: | :--- | :--- |
| 压力 | 0 | 256 | uint8 × 256 | 剥掉尾部 6 字节后剩下的全部 |
| `rotate` | **-6**（帧尾往前数 6） | 6 | uint8 × 6 | 姿态，原样透传给前端，后端不解释 |

| 项 | 值 |
| :--- | :--- |
| 总帧长 | 262（硬编码判定 `buffer.length !== 262`） |
| 默认波特率 | 921600 |
| 分帧方式 | 定长 262 |
| 校验 | 无 |

代码里是先切尾巴再处理压力：

```js
const rotate = pointArr.splice(pointArr.length - 6, pointArr.length);
```

（`splice` 的第二个参数传的是 `pointArr.length` 而不是 `6`，超出部分被忽略，结果一样是取最后 6 个。）

## rotate 段后端不解释

6 个字节原样放进 payload 的 `rotate` 字段发给前端，后端不做任何数值转换。
和[整包 274](hand-glove-full-packet-274.md) 的 IMU 不同 —— 那个要过 `bytes4ToInt10`，这个不用。
想知道这 6 个字节的物理含义，得看前端怎么用它，协议层管不到。

## 压力段的映射链

解出 256 点之后走两步（不属于协议层）：`gloves0123Res(pointArr)` 整理原始点位 → `gloves0123(pointArr)` 映射到展示点位。
点位表在 `backend/processing/lineOrderDefinitions/gloves.js`。

## schema 缺口

| 缺什么 | 具体挡在哪 |
| :--- | :--- |
| `decoding` 支持多字段 | 压力段和 rotate 段要分开取，单 `valueType` + 单 `byteOffset` 只能取一段 |

严格说这个协议**离能配置化最近**：两段都是 `uint8`，只是需要两条 `decoding` 规则。
现有 schema 的负偏移能力（`byteOffset: -6`）本来就是为这种尾部字段准备的，
只差「一帧里声明多个字段」这一步。

## 代码位置

| 想看什么 | 位置 |
| :--- | :--- |
| 帧处理 | `backend/sensors/runtime/legacyGloveFrameProcessor.js` 的 `processSit262Frame` |
| 长度分发 | `backend/sensors/runtime/legacySerialFrameRuntime.js`（`buffer.length === 262` 分支） |
| 点位表 | `backend/processing/lineOrderDefinitions/gloves.js` |
| 回归测试 | `backend/tests/sensors/runtime/legacyGloveFrameProcessor.test.js` |

## 排错

| 现象 | 一般原因 |
| :--- | :--- |
| 一帧都收不到 | 波特率不对，或硬件其实在发 274 / 130+146 |
| 压力矩阵最后几个点是姿态值 | 没剥尾部 6 字节 |
| 姿态数字看不懂 | 正常 —— 后端不解释这 6 字节，看前端的用法 |
