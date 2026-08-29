# byte-matrix-demo

> 最后更新：2026-08-29

**唯一一个完整可跑的样例。** 其余三个是迁移模板（见 `../README.md`）。

只有 2×3 六个点，小到可以手算——喂 6 个字节进去，按线序点序推一遍，结果对不对一眼看得出来。这是它的用途，不是它的局限。

## 本目录文件

| 文件 | 内容 |
| --- | --- |
| `display-system.json` | schemaVersion **2**，id `byte-matrix-demo`，传感器类型 `byteMatrixDemo`，2×3 矩阵，占 `sit` 一个串口角色 |
| `line-order.json` | `{"order": [4, 2, 1]}` |
| `point-order.json` | 2×3 矩阵，`points: [[0,0], [1,1], [1,2]]` |
| `algorithm-data.json` | `{"scale": 2, "max": 70, "zeroBelow": 30}` |

## manifest 各段实际写了什么

```
protocol   921600 波特率 / framing: fixedLength 6 字节 / decoding: uint8, byteOffset 0, valueCount 6
algorithm  type "json"，参数从 algorithm-data.json 读
display    2 个 view（heatmap / pressureStats）
           2 个 widget（columnSpan 8 + 4，grid 12 列）
           3 种 renderer（heatmap / matrix / raw2d）
           4 种可视化算法（identity / normalize max=100 / threshold=20 / smooth radius=1）
           3 个 profile（压力总览 / 接触区域 / 数值分析）
           6 个控件开关全开（serial / capture / replay / download / threshold / color）
           defaultView "heatmap"，defaultProfile "pressure-overview"
metadata   { demo: true }
```

## 想照着写自己的系统，看这几处

- **`protocol.framing` + `protocol.decoding`** 是替代硬编码解帧的关键。定长 6 字节、uint8、从 offset 0 取 6 个值——这三行等价于 `built-in-sensors/` 里几十行字节读取代码。
- **`display.profiles`** 是「一套数据、多种看法」的表达方式：同一份帧，`identity` 看原始、`threshold` 看接触区域、`normalize` 看数值。profile 切换不重新采集。
- **`algorithm.type: "json"`** 是最轻的算法形式，只做数值变换（scale / max / zeroBelow），不需要写代码。要真算法才用 `js` 或 `python`。

## 边界

- 这是样例，不要直接改成生产配置。要新建就 duplicate 一份（`extension-host/workspace/` 的 `duplicate`）。
- `sensor.type: "byteMatrixDemo"` 不对应任何真实硬件。接真设备要改成实际类型。
