# hand-glove-manifest-demo

> 最后更新：2026-08-29

**迁移模板，不是可用配置。** `metadata.runtimeMode: "template"`。

对应的硬编码实现是 `../../built-in-sensors/handPacketRuntime.js`（由 `metadata.sourceRuntime` 指明）。

## 本目录文件

| 文件 | 内容 |
| --- | --- |
| `display-system.json` | schemaVersion **1**，传感器类型 `hand0205`，**16×16** 矩阵，占 **`sit` 和 `back` 两个**串口角色。`display.views: ["heatmap", "model"]`，`defaultView: "model"` |
| `line-order.json` | `order: [1..4, 17..20, 33..36, 49..52]` —— 16 个，行距 16 |
| `point-order.json` | 16×16 矩阵，`points` **16** 个（`[0,0]`–`[3,3]` 的 4×4 块） |
| `algorithm-data.json` | `{"scale": 1, "min": 0, "max": 1023, "zeroBelow": 0}` —— 10 位量程 |

## 四个模板里唯一占两个串口的

`ports: ["sit", "back"]` —— 双通道，因为是**左右手两只手套**。这带来两个别的模板没有的问题：

**1. 会和其他样例撞角色。** 同时启用它和另一个占 `sit` 的样例，两者抢同一个串口。

**2. 左右手路由不在 manifest 里。** `handPacketRuntime.js` 负责分包解析、左右手路由、映射矩阵生成。声明式协议目前只能表达「这个系统用两个串口」，表达不了「第一个口是左手、第二个是右手、并且分包要按 XX 规则合并」。

所以这个模板是四个里最难迁完的。`defaultView: "model"`（3D 手模型而不是热力图）也意味着显示侧还要有对应的渲染器支持。

## 没写完的部分

- **没有 `protocol` 段** —— 分包解析还走 `handPacketRuntime.js`。
- **点序 16 个点，矩阵 256 个** —— 只有左上 4×4 块，剩下 240 个没填。
- **左右手的通道语义没表达** —— 见上面。

## 边界

- 现状下启用它不会得到正确的手套数据。
- 手套分包协议（`handGloveFullPacket` / `handGloveDouble`）属硬件协议范畴，改动影响历史数据兼容性，必须人工确认。
- 占两个串口角色，启用前先确认没和别的系统冲突（冲突判定见 `../../../extension-host/runtime/displaySystemRuntimeDiscovery.js`）。
