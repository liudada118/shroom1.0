# 人体全身优化：只合并 `(7)` 左右手臂点位

## 目标

将 `C:/Users/23823/Desktop/sensor_canvas_positions (7).json` 中左右手臂的新位置合并到项目的人体全身优化点位档案，使两侧手臂点位采用用户最新调整，同时保持项目当前前胸及其他身体区域不变。

## 合并范围

目标文件为 `client/public/model/sensor_canvas_positions.json`。

- `canvases`：仅用 `(7)` 的 `右手臂`、`左手臂` 整个对象替换当前同名对象，包含 `corners` 和 `armWrap`。
- `logicalFlat`：仅复制 `region` 为 `右手臂` 或 `左手臂` 条目的 `x`、`y`、`z`。
- `flat`：仅复制 `region` 为 `右手臂` 或 `左手臂` 条目的 `x`、`y`、`z`。
- 所有条目按 `index` 对齐，不按数组当前位置盲目覆盖。

## 明确不变

- 前胸使用项目当前位置，不采用 `(7)` 中的前胸坐标和画布角点。
- 后背、肩部、前后裤及腿部保持不变。
- `version`、坐标空间、1120 个物理点、800 个逻辑点及顶层统计保持不变。
- `index`、`logicalIndex`、`region`、`placementSide`、`row`、`col`、`canvasId`、来源字段和数据映射保持不变。
- 原始 1024 数据、方向映射、2D 数字、热力值、统计、回放、CSV 和后端均不修改。

## 验收

合并后必须满足：

1. JSON 可解析，仍为 v7、1120 个物理点和 800 个逻辑点，索引唯一且完整。
2. 相对项目当前档案，`logicalFlat` 与 `flat` 都恰好只有左右手臂共 180 个条目的坐标变化。
3. 这 180 个手臂条目的坐标与 `(7)` 完全一致。
4. 前胸及其他区域的全部字段与项目当前档案完全一致。
5. 除左右手臂 `canvases` 对象外，其他画布元数据完全不变。
6. 更新 `ARCHITECTURE.md`，运行人体专项测试和前端生产构建；生产构建同步更新 `build/model/sensor_canvas_positions.json`。

