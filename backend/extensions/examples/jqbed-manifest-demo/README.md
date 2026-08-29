# jqbed-manifest-demo

> 最后更新：2026-08-29

**迁移模板，不是可用配置。** `metadata.runtimeMode: "template"`。

目标是把 jqbed 从硬编码实现迁到声明式 manifest，对应的硬编码实现是
`../../built-in-sensors/sit1024FrameProcessor.js`（由 `metadata.sourceRuntime` 指明）。

## 本目录文件

| 文件 | 内容 |
| --- | --- |
| `display-system.json` | schemaVersion **1**，传感器类型 `jqbed`，**32×32** 矩阵，占 `sit` 串口角色。`display` 只有 `views: ["heatmap"]` |
| `line-order.json` | `order: [1..8, 33..40]` —— 16 个 |
| `point-order.json` | 声明 32×32，但 `points` 只有 **16** 个（`[0,0]`–`[0,7]`、`[1,0]`–`[1,7]`） |
| `algorithm-data.json` | `{"scale": 1, "min": 0, "max": 4095, "zeroBelow": 0}` —— 12 位量程，恒等变换 |

## 两处明确没写完

**1. 没有 `protocol` 段。** 所以解帧还走 `sit1024FrameProcessor.js` 的硬编码路径（1024 字节 → 32×32）。这个 manifest 目前只声明了传感器身份和显示部分。

**2. 点序只有 16 个点，矩阵是 1024 个。** 这不是 bug，是骨架——前两行的映射样式写出来了，剩下 1008 个点没填。线序同理，`[1..8, 33..40]` 展示的是「每行取 8 个、行距 32」这个规律，不是完整表。

要真正迁完，得做三件事：
1. 把 `sit1024FrameProcessor.js` 里的帧长度、字节偏移翻成 `protocol.framing` / `protocol.decoding`
2. 把线序和点序补齐到 1024
3. 开 parallel 模式（`../../../extension-host/runtime/displaySystemRuntimePolicy.js`）让两边同时收同一份数据，逐帧比对

第 3 步不能省。这类迁移出错的表现是热力图镜像或点位错位——数据全程有效、不报错、能存能回放，只是位置不对。

## 边界

- 现状下启用它不会得到正确的 jqbed 数据。
- schemaVersion 保持 1，别顺手升。loader 声明支持 [1,2,3]，需要 v1 的样本来验证向后兼容。
- jqbed 的算法参数是另一套东西，在 `../../../kernel/algorithm-channel/jqbedAlgorithmConfig.js`（13 个参数，带版本号和落盘），和这里的 `algorithm-data.json` 不是一回事。
