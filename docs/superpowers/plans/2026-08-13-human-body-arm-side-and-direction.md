# 人体全身优化左右区域与方向修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正左右手臂与左右肩的整块数据归属，并让后背、左右后腿在 3D 热力与 2D 数字中只执行一次上下翻转。

**Architecture:** `humanBodyOrientation.js` 作为优化人体渲染的唯一可视化映射边界，负责把模型点位区域解析为实物数据部位，并统一处理行、列方向。`HumanBodyOptimized.jsx` 保留模型坐标、Shader 和数字绘制职责，只调用该模块，不再为臂和后腿叠加私有翻转。

**Tech Stack:** React 18、Three.js、Vite、Vitest、ES modules

## Global Constraints

- 保留原始 1024 路帧、部位索引矩阵和 v7 `sensor_canvas_positions.json` 不变。
- 左右手臂、左右肩整块互换；臂和肩内部行列保持原样。
- 后背、左后腿、右后腿上下翻转，列方向保持。
- 3D 和 2D 共用方向规则，每项转换只执行一次。
- 不改变统计、回放、CSV 和旧版人体系统。

---

## File Structure

- Modify: `client/src/components/video/humanBodyOrientation.js`：保存模型区域到数据部位的映射，以及统一行列方向函数。
- Modify: `client/src/components/video/humanBodyOrientation.test.js`：覆盖左右区域归属、臂内方向、后背/后腿方向和未配置区域。
- Modify: `client/src/components/video/HumanBodyOptimized.jsx`：消费统一映射，移除臂/后腿的 2D 重复翻转，并纠正左右臂视角。
- Modify: `ARCHITECTURE.md`：记录最终区域归属、方向边界及验证结果。
- Modify: `build/assets/index-*.js`、`build/index.html`：由生产构建生成并纳入提交。

### Task 1: 用测试定义左右归属与统一方向

**Files:**
- Modify: `client/src/components/video/humanBodyOrientation.test.js`
- Modify: `client/src/components/video/humanBodyOrientation.js`

**Interfaces:**
- Produces: `resolveSensorPartKey(region: string, placementSide?: string): string | undefined`
- Produces: `getSourceGridPosition(partKey, targetRow, targetCol, targetRows, targetCols, sourceRows, sourceCols): { sourceRow: number, sourceCol: number }`
- Produces: `orientPartMatrix(partKey: string, rows: unknown[][]): unknown[][]`

- [ ] **Step 1: 写入失败的区域归属测试**

```js
it("左右手臂和左右肩读取对侧命名的数据部位", () => {
  expect(resolveSensorPartKey("右手臂")).toBe("leftArm");
  expect(resolveSensorPartKey("左手臂")).toBe("rightArm");
  expect(resolveSensorPartKey("右肩")).toBe("leftShoulder");
  expect(resolveSensorPartKey("左肩")).toBe("rightShoulder");
});
```

- [ ] **Step 2: 写入失败的方向测试**

```js
it("手臂和肩内部行列保持原样", () => {
  expect(orientPartMatrix("rightArm", [[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  expect(orientPartMatrix("leftShoulder", [[5, 6], [7, 8]])).toEqual([[5, 6], [7, 8]]);
});

it.each(["back", "backPantsLeft", "backPantsRight"])("%s 上下翻转且列方向保持", (partKey) => {
  expect(orientPartMatrix(partKey, [[1, 2], [3, 4]])).toEqual([[3, 4], [1, 2]]);
});
```

同时更新 3D 四角断言：`back`、`backPantsLeft`、`backPantsRight` 的首行映射到源末行；`leftArm`、`rightArm` 和肩部首行首列保持不变。

- [ ] **Step 3: 运行专项测试并确认先失败**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js`（工作目录 `client`）

Expected: FAIL，提示 `resolveSensorPartKey` / `orientPartMatrix` 未导出，且旧右臂上下翻转断言不符合新要求。

- [ ] **Step 4: 实现最小统一映射模块**

```js
const REGION_TO_DATA_PART_KEY = Object.freeze({
  前胸: "chest",
  后背: "back",
  右肩: "leftShoulder",
  右手臂: "leftArm",
  左肩: "rightShoulder",
  左手臂: "rightArm",
});

const PART_ORIENTATION = Object.freeze({
  back: Object.freeze({ flipRow: true }),
  backPantsLeft: Object.freeze({ flipRow: true }),
  backPantsRight: Object.freeze({ flipRow: true }),
});
```

`resolveSensorPartKey()` 对前裤、后裤继续按 `placementSide` 返回对应左右腿；其它区域读取上述表。`getSourceGridPosition()` 分别按 `flipRow`、`flipCol` 计算源行列；`orientPartMatrix()` 先翻行再翻列，未配置部位返回等价矩阵且不改变输入数组。

- [ ] **Step 5: 运行专项测试并确认通过**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js`（工作目录 `client`）

Expected: PASS，所有区域归属和四角方向断言通过。

### Task 2: 接入 3D、2D 与左右视角

**Files:**
- Modify: `client/src/components/video/HumanBodyOptimized.jsx`
- Test: `client/src/components/video/humanBodyOrientation.test.js`

**Interfaces:**
- Consumes: Task 1 的 `resolveSensorPartKey()`、`getSourceGridPosition()`、`orientPartMatrix()`。
- Produces: 3D 点位采样、2D 数字矩阵和视角按钮使用一致的实物左右语义。

- [ ] **Step 1: 让组件使用统一的区域解析函数**

将导入改为：

```js
import {
  getSourceGridPosition,
  orientPartMatrix,
  resolveSensorPartKey,
} from "./humanBodyOrientation";
```

删除组件内 `REGION_TO_PART_KEY` 和 `resolvePartKey()`，在 `buildSensorLayout()` 中使用：

```js
const partKey = resolveSensorPartKey(sensor.region, sensor.placementSide);
```

- [ ] **Step 2: 移除 2D 臂/腿重复方向补偿**

保留未被实物反馈否定的前胸、后背横向数字布局：

```js
const NUMBER_HORIZONTAL_FLIP_PARTS = new Set(["back", "chest"]);
```

删除 `NUMBER_VERTICAL_FLIP_PARTS`。`getOrientedPartValues()` 先调用 `orientPartMatrix(part.key, rows)`，之后仅应用上述历史数字布局；不再为手臂、肩或后腿额外反转。

- [ ] **Step 3: 纠正左右臂视角的模型空间目标**

```js
leftArm: { label: "左臂", position: [5, 5.5, 4], target: [2.5, 5.5, 0] },
rightArm: { label: "右臂", position: [-5, 5.5, 4], target: [-2.5, 5.5, 0] },
```

这样“右臂”按钮跟随真实右臂数据交换后所在的模型负 X 一侧，2D 面板仍读取 `rightShoulder`、`rightArm`。

- [ ] **Step 4: 运行专项回归测试**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js`（工作目录 `client`）

Expected: PASS。

- [ ] **Step 5: 检查静态差异**

Run: `git diff --check`

Expected: 无空白错误；组件中不存在 `NUMBER_VERTICAL_FLIP_PARTS`，不存在右臂 `flipRow`。

### Task 3: 架构文档、构建与提交

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `build/index.html`
- Modify: `build/assets/index-*.js`

**Interfaces:**
- Consumes: Task 1、Task 2 的最终映射行为。
- Produces: 可审计的架构说明、生产构建和 Git 提交。

- [ ] **Step 1: 更新架构文档**

在人体全身优化章节和变更记录写明：点位“左手臂/左肩”读取实物 `rightArm/rightShoulder`，点位“右手臂/右肩”读取 `leftArm/leftShoulder`；臂内不翻转；后背与左右后腿上下翻转；变换只在可视化读取层执行一次，不修改原始帧、点位、统计、回放或 CSV。

- [ ] **Step 2: 运行专项测试**

Run: `npm test -- --run src/components/video/humanBodyOrientation.test.js`（工作目录 `client`）

Expected: PASS。

- [ ] **Step 3: 运行前端生产构建**

Run: `npm run build`（工作目录 `client`）

Expected: exit code 0；`E:/shroom1/build` 更新为新哈希资源。允许记录项目现有构建警告，但不得出现构建错误。

- [ ] **Step 4: 执行提交前验证**

Run: `git diff --check`

Run: `git status --short`

Expected: 只包含本计划列出的源文件、测试、文档和构建产物。

- [ ] **Step 5: 提交代码**

```powershell
git add -- ARCHITECTURE.md client/src/components/video/HumanBodyOptimized.jsx client/src/components/video/humanBodyOrientation.js client/src/components/video/humanBodyOrientation.test.js build/index.html build/assets
git commit -m "修正人体左右区域与后腿映射方向"
```
