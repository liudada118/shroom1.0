# 人体全身优化模型列方向与前腿数字标题修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅在 3D 热力采样中左右翻转指定右侧区域，并只交换前腿 2D 数字块的标题文字。

**Architecture:** `humanBodyOrientation.js` 将模型采样方向与数字矩阵方向拆成显式通道；`getSourceGridPosition()` 读取 3D 模型通道，`orientPartMatrix()` 读取 2D 数字通道。`HumanBodyOptimized.jsx` 继续负责面板绘制，仅调整前腿标题映射，不改变数字块顺序和数据。

**Tech Stack:** React 18、Three.js、Vite、Vitest、ES modules

## Global Constraints

- `frontPantsRight`、`backPantsLeft`、`rightArm`、`rightShoulder` 只在 3D 模型采样中左右翻转。
- `backPantsLeft` 在 3D 同时上下和左右翻转；`backPantsRight` 仍只上下翻转。
- 2D 数字不应用本次 3D 专用左右翻转。
- 前腿 2D 数字块顺序和数据不变，仅将 `frontPantsLeft` 标题改为“右前腿”、`frontPantsRight` 标题改为“左前腿”。
- 不修改原始 1024 路数据、索引矩阵、点位 JSON、统计、回放或 CSV。

---

## File Structure

- Modify: `client/src/components/video/humanBodyOrientation.js`：维护按渲染通道区分的方向规则。
- Modify: `client/src/components/video/humanBodyOrientation.test.js`：验证 3D 列方向和 2D 隔离。
- Create: `client/src/components/video/humanBodyNumberLabels.js`：保存可独立测试的 2D 数字标题映射。
- Create: `client/src/components/video/humanBodyNumberLabels.test.js`：验证前腿标题互换且其它标题保持。
- Modify: `client/src/components/video/HumanBodyOptimized.jsx`：消费数字标题映射。
- Modify: `ARCHITECTURE.md`：记录 3D/2D 通道边界和最终方向。
- Modify: `build/index.html`、`build/assets/index-*.js`：生产构建产物。

### Task 1: 用测试定义 3D 专用列翻转

**Files:**
- Modify: `client/src/components/video/humanBodyOrientation.test.js`
- Modify: `client/src/components/video/humanBodyOrientation.js`

**Interfaces:**
- Consumes: 现有 `getSourceGridPosition(...)` 与 `orientPartMatrix(partKey, rows)`。
- Produces: `getSourceGridPosition()` 使用模型通道；`orientPartMatrix()` 使用数字通道。

- [ ] **Step 1: 写入失败的 3D 首尾列测试**

```js
it.each(["frontPantsRight", "rightArm", "rightShoulder"])("%s 的3D首尾列左右翻转", (partKey) => {
  expect(getSourceGridPosition(partKey, 1, 1, 6, 15, 6, 7)).toEqual({
    sourceRow: 0,
    sourceCol: 6,
  });
});

it("左后腿3D同时上下和左右翻转", () => {
  expect(getSourceGridPosition("backPantsLeft", 1, 1, 32, 5, 8, 5)).toEqual({
    sourceRow: 7,
    sourceCol: 4,
  });
});
```

为 `frontPantsRight` 使用其真实 `8×5` 尺寸另加末列断言；手臂/肩分别用自己的源列数断言，期望值必须为手工字面量。

- [ ] **Step 2: 写入 2D 不跟随列翻转的回归测试**

```js
it.each(["frontPantsRight", "backPantsLeft", "rightArm", "rightShoulder"])(
  "%s 的2D数字不应用3D专用左右翻转",
  (partKey) => {
    expect(orientPartMatrix(partKey, [[1, 2], [3, 4]])[0]).toEqual(
      partKey === "backPantsLeft" ? [3, 4] : [1, 2],
    );
  },
);
```

- [ ] **Step 3: 运行专项测试并确认失败**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js`（工作目录 `client`）

Expected: FAIL；四个部位的 `sourceCol` 尚未互换，2D 旧行为断言继续证明隔离要求。

- [ ] **Step 4: 实现按通道区分的最小配置**

```js
const PART_ORIENTATION = Object.freeze({
  back: Object.freeze({ model: Object.freeze({ flipRow: true }), number: Object.freeze({ flipRow: true }) }),
  backPantsLeft: Object.freeze({ model: Object.freeze({ flipRow: true, flipCol: true }), number: Object.freeze({ flipRow: true }) }),
  backPantsRight: Object.freeze({ model: Object.freeze({ flipRow: true }), number: Object.freeze({ flipRow: true }) }),
  frontPantsRight: Object.freeze({ model: Object.freeze({ flipCol: true }) }),
  rightArm: Object.freeze({ model: Object.freeze({ flipCol: true }) }),
  rightShoulder: Object.freeze({ model: Object.freeze({ flipCol: true }) }),
});
```

`getSourceGridPosition()` 读取 `PART_ORIENTATION[partKey]?.model`；`orientPartMatrix()` 读取 `PART_ORIENTATION[partKey]?.number`。保留先翻行、再翻列的确定顺序。

- [ ] **Step 5: 运行专项测试并确认通过**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js`（工作目录 `client`）

Expected: PASS。

### Task 2: 用测试定义前腿数字标题

**Files:**
- Create: `client/src/components/video/humanBodyNumberLabels.test.js`
- Create: `client/src/components/video/humanBodyNumberLabels.js`
- Modify: `client/src/components/video/HumanBodyOptimized.jsx`

**Interfaces:**
- Produces: `HUMAN_BODY_NUMBER_PART_LABELS: Readonly<Record<string, string>>`。
- Consumes: `HumanBodyOptimized.jsx` 用部位键读取标题，不改变 `NUMBER_VIEW_PARTS.frontLegs`。

- [ ] **Step 1: 写入失败的标题测试**

```js
import { HUMAN_BODY_NUMBER_PART_LABELS } from "./humanBodyNumberLabels";

it("前腿数字块只交换标题", () => {
  expect(HUMAN_BODY_NUMBER_PART_LABELS.frontPantsLeft).toBe("右前腿");
  expect(HUMAN_BODY_NUMBER_PART_LABELS.frontPantsRight).toBe("左前腿");
});

it("后腿和右臂标题保持原语义", () => {
  expect(HUMAN_BODY_NUMBER_PART_LABELS.backPantsLeft).toBe("左后腿");
  expect(HUMAN_BODY_NUMBER_PART_LABELS.backPantsRight).toBe("右后腿");
  expect(HUMAN_BODY_NUMBER_PART_LABELS.rightArm).toBe("右手臂");
});
```

- [ ] **Step 2: 运行标题测试并确认失败**

Run: `npm test -- --run src/components/video/humanBodyNumberLabels.test.js`（工作目录 `client`）

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 创建标题映射并接入组件**

```js
export const HUMAN_BODY_NUMBER_PART_LABELS = Object.freeze({
  chest: "前胸",
  back: "后背",
  leftShoulder: "左肩",
  leftArm: "左手臂",
  rightShoulder: "右肩",
  rightArm: "右手臂",
  frontPantsLeft: "右前腿",
  frontPantsRight: "左前腿",
  backPantsLeft: "左后腿",
  backPantsRight: "右后腿",
});
```

从 `HumanBodyOptimized.jsx` 删除本地 `NUMBER_PART_LABELS`，改为导入 `HUMAN_BODY_NUMBER_PART_LABELS`。保持 `NUMBER_VIEW_PARTS.frontLegs` 为 `['frontPantsLeft', 'frontPantsRight']`。

- [ ] **Step 4: 运行两个专项测试文件**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js src/components/video/humanBodyNumberLabels.test.js`（工作目录 `client`）

Expected: PASS。

### Task 3: 文档、构建与提交

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `build/index.html`
- Modify: `build/assets/index-*.js`

**Interfaces:**
- Consumes: Task 1 和 Task 2 的最终行为。
- Produces: 架构记录、可部署构建和 Git 提交。

- [ ] **Step 1: 增量更新架构文档**

记录 `frontPantsRight`、`backPantsLeft`、`rightArm`、`rightShoulder` 仅在 3D 模型通道使用 `flipCol`；2D 不继承该列翻转；前腿数字标题在不交换数据块的情况下互换。

- [ ] **Step 2: 运行专项测试**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js src/components/video/humanBodyNumberLabels.test.js`（工作目录 `client`）

Expected: PASS。

- [ ] **Step 3: 运行前端生产构建**

Run: `npm run build`（工作目录 `client`）

Expected: exit code 0，并更新 `E:/shroom1/build` 哈希资源。现有无关警告可以记录，但不得出现构建错误。

- [ ] **Step 4: 执行提交前验证**

Run: `git diff --check`

Run: `git status --short`

Expected: 只包含本计划列出的源文件、测试、架构文档和构建产物。

- [ ] **Step 5: 提交实现**

```powershell
git add -- ARCHITECTURE.md client/src/components/video/HumanBodyOptimized.jsx client/src/components/video/humanBodyOrientation.js client/src/components/video/humanBodyOrientation.test.js client/src/components/video/humanBodyNumberLabels.js client/src/components/video/humanBodyNumberLabels.test.js build/index.html build/assets
git commit -m "修正人体右侧模型列方向与前腿标题"
```
