# 人体区域上下方向修正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将人体全身优化的后背和右手臂上下翻转，并确保3D Shader与2D数字面板使用同一方向规则。

**Architecture:** 新建纯函数模块集中维护区域方向和矩阵方向转换，避免测试加载 Three.js/GLB/React 渲染组件。`HumanBodyOptimized.jsx` 的3D双线性采样和2D数字矩阵都调用该模块；原始1024帧、点位XYZ、统计和CSV不变。

**Tech Stack:** JavaScript ES modules、React、Three.js、Vitest、Vite

## Global Constraints

- 只有 `back` 和 `rightArm` 设置 `flipRow: true`。
- 方向转换只发生在可视化区域采样层，不修改原始1024路帧。
- 3D与2D必须读取同一份方向配置。
- 现有胸背/手臂横向2D显示规则和后裤纵向2D显示规则保持不变。
- 左侧统计、实时、回放和CSV数据口径保持不变。

---

### Task 1: 共享区域方向并接入3D与2D

**Files:**
- Create: `client/src/components/video/humanBodyOrientation.js`
- Create: `client/src/components/video/humanBodyOrientation.test.js`
- Modify: `client/src/components/video/HumanBodyOptimized.jsx:107-202,268-287`
- Modify: `ARCHITECTURE.md`

**Interfaces:**
- Produces: `getSourceGridPosition(partKey, targetRow, targetCol, targetRows, targetCols, sourceRows, sourceCols): { sourceRow, sourceCol }`
- Produces: `orientPartRows(partKey, rows): Array<Array<number>>`
- Consumes: `part.key`、模型点位行列、原始索引矩阵尺寸。

- [ ] **Step 1: 写失败测试**

创建 `humanBodyOrientation.test.js`，使用手工推导的字面量验证：

```js
import { describe, expect, it } from "vitest";
import { getSourceGridPosition, orientPartRows } from "./humanBodyOrientation";

describe("人体区域方向", () => {
  it.each(["back", "rightArm"])("%s 的3D首尾行上下翻转", (partKey) => {
    expect(getSourceGridPosition(partKey, 1, 1, 12, 10, 6, 10).sourceRow).toBe(5);
    expect(getSourceGridPosition(partKey, 12, 1, 12, 10, 6, 10).sourceRow).toBe(0);
  });

  it("未配置区域保持原行方向", () => {
    expect(getSourceGridPosition("chest", 1, 1, 12, 10, 6, 10).sourceRow).toBe(0);
    expect(getSourceGridPosition("chest", 12, 1, 12, 10, 6, 10).sourceRow).toBe(5);
  });

  it("2D后背和右手臂读取相同的上下翻转规则", () => {
    expect(orientPartRows("back", [[1, 2], [3, 4]])).toEqual([[3, 4], [1, 2]]);
    expect(orientPartRows("rightArm", [[5], [6]])).toEqual([[6], [5]]);
    expect(orientPartRows("chest", [[1], [2]])).toEqual([[1], [2]]);
  });
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

运行：`npm test -- --run src/components/video/humanBodyOrientation.test.js`

预期：FAIL，原因是 `humanBodyOrientation.js` 或导出函数尚不存在。

- [ ] **Step 3: 实现最小共享方向模块**

在 `humanBodyOrientation.js` 中定义：

```js
const PART_ORIENTATION = Object.freeze({
  back: Object.freeze({ flipRow: true }),
  rightArm: Object.freeze({ flipRow: true }),
});

export function getSourceGridPosition(partKey, targetRow, targetCol, targetRows, targetCols, sourceRows, sourceCols) {
  const normalizedRow = targetRows > 1 ? (targetRow - 1) / (targetRows - 1) : 0;
  const normalizedCol = targetCols > 1 ? (targetCol - 1) / (targetCols - 1) : 0;
  return {
    sourceRow: (PART_ORIENTATION[partKey]?.flipRow ? 1 - normalizedRow : normalizedRow) * (sourceRows - 1),
    sourceCol: normalizedCol * (sourceCols - 1),
  };
}

export function orientPartRows(partKey, rows) {
  return PART_ORIENTATION[partKey]?.flipRow ? [...rows].reverse() : rows;
}
```

- [ ] **Step 4: 接入3D和2D路径**

在 `HumanBodyOptimized.jsx`：

1. 导入 `getSourceGridPosition` 和 `orientPartRows`。
2. `buildSample()` 使用 `getSourceGridPosition()` 计算 `sourceRow/sourceCol`。
3. `getOrientedPartValues()` 生成原始行后先调用 `orientPartRows(part.key, rows)`，再保留现有横翻与后裤显示规则。

- [ ] **Step 5: 运行方向测试确认通过**

运行：`npm test -- --run src/components/video/humanBodyOrientation.test.js`

预期：3项测试全部 PASS。

- [ ] **Step 6: 更新架构文档**

在 `ARCHITECTURE.md`：

- 项目进度追加“后背/右臂上下方向修正”。
- 更新日志追加 `2026-08-13 | Revise | 修复缺陷`。
- 人体全身优化章节说明共享方向配置只影响3D和2D显示。
- 顶部最后更新日期改为 `2026-08-13`。

- [ ] **Step 7: 完整验证**

运行：

```powershell
npm test -- --run src/components/video/humanBodyOrientation.test.js
npm run build
git diff --check
```

预期：方向测试通过、生产构建退出码0；`git diff --check` 只允许构建器既有生成文件提示，不允许源文件或文档格式错误。

- [ ] **Step 8: 提交实现**

```powershell
git add client/src/components/video/humanBodyOrientation.js client/src/components/video/humanBodyOrientation.test.js client/src/components/video/HumanBodyOptimized.jsx ARCHITECTURE.md build
git commit -m "修正后背和右臂上下映射方向"
```

