# small-bed-12b-manifest-demo

> 最后更新：2026-08-29

**迁移模板，不是可用配置。** `metadata.migrationTemplate: true`。

对应的硬编码实现是 `../../built-in-sensors/smallBed12BRuntime.js`（由 `metadata.sourceRuntime` 指明）。

## 本目录文件

| 文件 | 内容 |
| --- | --- |
| `display-system.json` | schemaVersion **1**，传感器类型 `smallBed12B`，**32×32** 矩阵，占 `sit` 串口角色。`display` 只有 `views: ["heatmap"]` |
| `line-order.json` | `order: [1, 2, 3, 4, 5, 6, 7, 8]` —— 8 个 |
| `point-order.json` | 声明 32×32，但 `points` 只有 **8** 个（`[0,0]`–`[0,3]`、`[1,0]`–`[1,3]`） |
| `algorithm-data.json` | `{"scale": 1, "zeroBelow": 0}` —— 四个模板里最简的，连 `max` 都没写 |

## 三处没写完

1. **没有 `protocol` 段** —— 解帧还走 `smallBed12BRuntime.js`。
2. **点序 8 个点，矩阵 1024 个** —— 骨架，展示 2×4 的映射样式而已。
3. **`algorithm-data.json` 没有量程** —— 缺 `min` / `max`，归一化会用默认值。小床的实际量程要从 `smallBed12BRuntime.js` 的压力标定逻辑里取。

## 小床 12B 的特殊之处

这个传感器的分帧和其他不一样：帧分隔符是 12 字节，`kernel/serial/serialRuntimeFactory.js` 专门为它注入了第二个分隔符（普通帧一个、小床 12B 一个）。

所以迁移它比迁 jqbed 麻烦——`protocol.framing` 得能表达这种非定长分帧。写之前先确认 `@shroom/backend/protocol/displaySystemProtocol.js` 支持的 framing 类型里有对得上的。

另外 `smallBed12BRuntime.js` 里有压力值标定（不只是线序和零点），这一步在声明式协议里没有直接对应的字段，可能要落到 `algorithm` 那一层用 json 参数或 js 算法表达。

## 边界

- 现状下启用它不会得到正确的小床数据。
- 12 字节分隔符属硬件协议范畴，改动影响历史数据兼容性，必须人工确认。
- schemaVersion 保持 1，需要 v1 样本验证 loader 的向后兼容。
