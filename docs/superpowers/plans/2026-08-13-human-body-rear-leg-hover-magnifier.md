# 人体后腿数字交换与悬停放大镜实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保持后腿 2D 标题槽位不动并交换左右矩阵数据，同时为人体全身优化 3D 模型加入克制型鼠标跟随 `3×3` 数据放大镜。

**Architecture:** 将数字面板的显示部位与数据部位解耦；将最近传感点、区域邻域和加权取值放入独立纯函数模块，Three.js 组件只负责 Raycaster、悬停生命周期与浮层绘制。实时帧继续存入 ref，悬停数值原位刷新，不让 10Hz 数据触发整个场景重渲染。

**Tech Stack:** React 19、Three.js r127、Canvas/DOM、Vitest 2.1、Vite 5。

## Global Constraints

- 后腿标题和屏幕槽位保持“左后腿 / 右后腿”不动，只交叉读取 `backPantsRight / backPantsLeft`。
- 后腿交换仅影响 3D 场景随视角显示的 2D 数字面板；不修改 `numoriginal`。
- 放大镜固定为同一 `region + placementSide` 内的 `3×3`；边缘缺格显示 `—`。
- 最近点最大距离固定为 `0.25`，超出后隐藏。
- 数字使用 `Σ(rawFrame[index] × sample.weight)`，不包含 Shader 着色专用的 `×10`。
- 悬停延迟 `150ms`、鼠标偏移 `18px`；拖动时隐藏并正确恢复自动旋转。
- 不修改原始帧、点位坐标、3D 方向、统计、回放、数据库、CSV 或模型资源。

---

## 文件结构

- 新建 `client/src/components/video/humanBodyNumberViews.js`：定义各视角显示槽位与数据部位的关系。
- 新建 `client/src/components/video/humanBodyNumberViews.test.js`：锁定后腿交叉数据源和其它区域不变。
- 新建 `client/src/components/video/humanBodyHoverData.js`：最近点、3×3 邻域、加权值和浮层位置纯函数。
- 新建 `client/src/components/video/humanBodyHoverData.test.js`：覆盖距离、区域隔离、边界和数值。
- 修改 `client/src/components/video/HumanBodyOptimized.jsx`：消费纯函数并接入 Raycaster 与悬停浮层。
- 修改 `ARCHITECTURE.md`：记录数据边界、交互和验证结果。
- 更新 `build/`：由生产构建生成与源码一致的 Electron 前端产物。

### Task 1: 解耦 2D 标题槽位和矩阵数据源

**Files:**
- Create: `client/src/components/video/humanBodyNumberViews.js`
- Create: `client/src/components/video/humanBodyNumberViews.test.js`
- Modify: `client/src/components/video/HumanBodyOptimized.jsx:236-338`

**Interfaces:**
- Produces: `getHumanBodyNumberViewSlots(viewKey): Array<{ displayPartKey: string, dataPartKey: string }>`。
- Consumes: `HUMAN_BODY_SENSOR_PARTS` 和 `HUMAN_BODY_NUMBER_PART_LABELS` 的现有 key。

- [ ] **Step 1: 写失败测试**

```js
import { describe, expect, it } from "vitest";
import { getHumanBodyNumberViewSlots } from "./humanBodyNumberViews";

describe("人体部位2D数字槽位", () => {
  it("后腿标题槽位不动但交换矩阵数据源", () => {
    expect(getHumanBodyNumberViewSlots("backLegs")).toEqual([
      { displayPartKey: "backPantsLeft", dataPartKey: "backPantsRight" },
      { displayPartKey: "backPantsRight", dataPartKey: "backPantsLeft" },
    ]);
  });

  it("其它部位继续显示自身矩阵", () => {
    expect(getHumanBodyNumberViewSlots("leftArm")).toEqual([
      { displayPartKey: "leftShoulder", dataPartKey: "leftShoulder" },
      { displayPartKey: "leftArm", dataPartKey: "leftArm" },
    ]);
    expect(getHumanBodyNumberViewSlots("unknown")).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm --prefix client test -- --run src/components/video/humanBodyNumberViews.test.js`

Expected: FAIL，模块或导出尚不存在。

- [ ] **Step 3: 实现最小视角配置**

```js
const VIEW_SLOTS = Object.freeze({
  chest: ["chest"],
  back: ["back"],
  leftArm: ["leftShoulder", "leftArm"],
  rightArm: ["rightShoulder", "rightArm"],
  frontLegs: ["frontPantsLeft", "frontPantsRight"],
  backLegs: [
    { displayPartKey: "backPantsLeft", dataPartKey: "backPantsRight" },
    { displayPartKey: "backPantsRight", dataPartKey: "backPantsLeft" },
  ],
});

export function getHumanBodyNumberViewSlots(viewKey) {
  return (VIEW_SLOTS[viewKey] || []).map((slot) => (
    typeof slot === "string"
      ? { displayPartKey: slot, dataPartKey: slot }
      : { ...slot }
  ));
}
```

在 `RegionNumberPanel` 中以 `displayPart` 决定标题、宽高和槽位，以 `dataPart` 决定 `getOrientedPartValues()` 的索引与方向；两者尺寸不一致时跳过该槽并保持组件可用。

- [ ] **Step 4: 运行数字专项测试确认 GREEN**

Run: `npm --prefix client test -- --run src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js`

Expected: 3 个文件全部通过，现有 19 项方向/标题测试不回归。

- [ ] **Step 5: 提交**

```powershell
git add -- client/src/components/video/humanBodyNumberViews.js client/src/components/video/humanBodyNumberViews.test.js client/src/components/video/HumanBodyOptimized.jsx
git commit -m "修正人体后腿二维矩阵数据归属"
```

### Task 2: 建立放大镜纯数据模型

**Files:**
- Create: `client/src/components/video/humanBodyHoverData.js`
- Create: `client/src/components/video/humanBodyHoverData.test.js`

**Interfaces:**
- Produces: `HOVER_MAX_DISTANCE = 0.25`。
- Produces: `getHumanBodySensorValue(sensor, frame): number`。
- Produces: `findNearestHumanBodySensor(point, sensors, maxDistance = HOVER_MAX_DISTANCE): sensor | null`。
- Produces: `buildHumanBodySensorNeighborhood(center, sensors, frame, radius = 1): Array<{ sensor: object | null, value: number | null, rowOffset: number, colOffset: number }>`。
- Produces: `clampHumanBodyHoverPosition(pointer, panelSize, viewportSize, offset = 18, margin = 8): { left: number, top: number }`。

- [ ] **Step 1: 写加权值与最近点失败测试**

```js
it("按现有 sample 权重读取原始量纲值", () => {
  const sensor = { sample: [{ index: 0, weight: 0.25 }, { index: 1, weight: 0.75 }] };
  expect(getHumanBodySensorValue(sensor, [20, 40])).toBe(35);
  expect(getHumanBodySensorValue(sensor, [Number.NaN])).toBe(0);
});

it("只返回阈值内最近点且同距时按 index 稳定选择", () => {
  const sensors = [
    { index: 2, position: { x: 0.1, y: 0, z: 0 } },
    { index: 1, position: { x: -0.1, y: 0, z: 0 } },
  ];
  expect(findNearestHumanBodySensor({ x: 0, y: 0, z: 0 }, sensors)?.index).toBe(1);
  expect(findNearestHumanBodySensor({ x: 1, y: 0, z: 0 }, sensors)).toBeNull();
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js`

Expected: FAIL，模块或导出尚不存在。

- [ ] **Step 3: 实现加权值与最近点最小代码**

```js
export const HOVER_MAX_DISTANCE = 0.25;

export function getHumanBodySensorValue(sensor, frame) {
  return (sensor?.sample || []).reduce((sum, item) => (
    sum + (Number(frame?.[item.index]) || 0) * (Number(item.weight) || 0)
  ), 0);
}

export function findNearestHumanBodySensor(point, sensors, maxDistance = HOVER_MAX_DISTANCE) {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;
  for (const sensor of sensors || []) {
    const dx = Number(sensor.position?.x) - Number(point?.x);
    const dy = Number(sensor.position?.y) - Number(point?.y);
    const dz = Number(sensor.position?.z) - Number(point?.z);
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq < nearestDistanceSq || (distanceSq === nearestDistanceSq && Number(sensor.index) < Number(nearest?.index))) {
      nearest = sensor;
      nearestDistanceSq = distanceSq;
    }
  }
  return nearest;
}
```

- [ ] **Step 4: 写 3×3 邻域与边缘失败测试**

```js
it("3×3 只读取同 region 和 placementSide，边缘固定补空", () => {
  const center = makeSensor({ index: 5, row: 0, col: 0, part: "后裤", placementSide: "negative-x" });
  const right = makeSensor({ index: 6, row: 0, col: 1, part: "后裤", placementSide: "negative-x" });
  const otherSide = makeSensor({ index: 7, row: 1, col: 0, part: "后裤", placementSide: "positive-x" });
  const cells = buildHumanBodySensorNeighborhood(center, [center, right, otherSide], [5, 6, 7]);
  expect(cells).toHaveLength(9);
  expect(cells[4].sensor.index).toBe(5);
  expect(cells[5].sensor.index).toBe(6);
  expect(cells[7].sensor).toBeNull();
});
```

- [ ] **Step 5: 实现固定邻域和浮层边界位置**

邻域先用 `${part}::${placementSide}` 过滤，再以 `${row},${col}` 建表，循环 `rowOffset/colOffset = -1..1` 固定返回 9 格；浮层优先放在指针右下，右侧或底部空间不足时改放左侧或上侧，并把最终坐标限制在 `margin..viewport-panel-margin`。

- [ ] **Step 6: 运行纯函数测试确认 GREEN**

Run: `npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js`

Expected: 加权、最近点、距离阈值、3×3、区域隔离、空值和位置钳制全部通过。

- [ ] **Step 7: 提交**

```powershell
git add -- client/src/components/video/humanBodyHoverData.js client/src/components/video/humanBodyHoverData.test.js
git commit -m "新增人体悬停局部数据计算"
```

### Task 3: 接入 Three.js Raycaster 和克制型跟随浮层

**Files:**
- Modify: `client/src/components/video/HumanBodyOptimized.jsx:364-758`

**Interfaces:**
- Consumes: Task 2 的四个纯函数及 `HOVER_MAX_DISTANCE`。
- Produces: 仅组件内部的 `HoverDataPanel` ref 接口：`show({ sensor, cells, left, top })`、`refresh(frame)`、`hide()`。

- [ ] **Step 1: 新建紧凑浮层组件**

在 `HumanBodyOptimized.jsx` 内新增 `HoverDataPanel`，保持面板尺寸稳定：标题显示人体区域和 `R{row + 1} C{col + 1}`；九格显示四舍五入值，中心格使用强调色，空格显示 `—`。根元素设置 `position: fixed`、`zIndex: 6`、`pointerEvents: none`、`opacity/transform 150ms` 过渡。

- [ ] **Step 2: 接入 Raycaster 与 150ms 稳定悬停**

在 Three.js effect 中创建一个 `THREE.Raycaster` 和 `THREE.Vector2`。`pointermove` 经单个 `requestAnimationFrame` 节流后：

1. 用 `renderer.domElement.getBoundingClientRect()` 换算 NDC。
2. 调用 `raycaster.intersectObjects(bodyMeshesRef.current, false)`。
3. 用命中世界坐标查 `findNearestHumanBodySensor()`。
4. 命中点 key 改变时取消旧的 150ms timer 并隐藏；稳定后显示。
5. 同 key 移动不改变浮层锚点，避免面板追着每个像素抖动。

- [ ] **Step 3: 处理 OrbitControls 和自动旋转状态**

监听 controls 的 `start/end`：`start` 设置 dragging ref、取消 timer、隐藏浮层；有效悬停首次显示时保存 `controls.autoRotate` 后设为 false；离开/无效/拖动时恢复保存状态。不能 `preventDefault()` 或 `stopPropagation()`，不得破坏 OrbitControls。

- [ ] **Step 4: 让静止鼠标下的数字随实时帧刷新**

`sitData()` 更新 `rawFrameRef` 和 Shader 后，若当前存在 hovered sensor，则重新构造该 sensor 的 3×3 并调用面板 `refresh()`；位置和 React 场景状态不变。

- [ ] **Step 5: 完整清理**

effect cleanup 中移除 `pointermove/pointerleave` 和 controls `start/end`，取消 hover timer 与 pointer RAF，恢复自动旋转，清空 hover ref，并隐藏面板；原有 renderer/material/texture dispose 顺序保持可用。

- [ ] **Step 6: 运行所有人体纯函数测试**

Run: `npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js`

Expected: 所有测试通过，无未处理异常。

- [ ] **Step 7: 提交**

```powershell
git add -- client/src/components/video/HumanBodyOptimized.jsx
git commit -m "新增人体模型悬停数据放大镜"
```

### Task 4: 架构文档、生产构建和交互验收

**Files:**
- Modify: `ARCHITECTURE.md:1134-1191`
- Modify: `build/index.html`
- Create/Delete: `build/assets/index-*.js`（Vite 哈希产物）

**Interfaces:**
- Consumes: Tasks 1-3 的最终行为。
- Produces: Electron 可加载的同步生产产物和可追溯架构说明。

- [ ] **Step 1: 更新架构文档**

在人体全身优化专章记录：后腿固定标题槽位交叉读取矩阵；Raycaster 世界坐标链路；`3×3` 区域隔离；原始量纲；`0.25` 阈值；150ms 跟随/拖动隐藏/实时刷新。追加 `2026-08-13 | Revise | 新增功能/修复缺陷` 变更记录，并保持其它累计记录不动。

- [ ] **Step 2: 运行完整专项测试**

Run: `npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js`

Expected: 全部通过。

- [ ] **Step 3: 运行前端生产构建**

Run: `npm --prefix client run build`

Expected: Vite 退出码 0，`build/index.html` 指向新的哈希 bundle；若只有既有 chunk 警告，记录但不视为失败。

- [ ] **Step 4: 检查构建差异与语法**

Run: `git diff --check`

Expected: 无空白错误；`git status --short` 仅包含本计划代码、测试、架构文档与对应 build 产物。

- [ ] **Step 5: Chromium WebGL 交互验收**

启动现有应用或 Vite 页面并逐项核对：胸/背/左右臂/前后腿；头手脚不弹；五种渲染模式；四边位置限制；拖动隐藏；自动旋转恢复；鼠标静止时模拟帧更新；切换视角/卸载无残留。记录无法自动化的项目和实际结果。

- [ ] **Step 6: 最终提交**

```powershell
git add -- ARCHITECTURE.md build client/src/components/video
git commit -m "完成人体后腿数字与悬停数据优化"
```

### Task 5: 独立代码审查与最终验证

**Files:**
- Review: Tasks 1-4 的全部 diff。

**Interfaces:**
- Consumes: 基准提交 `87ad27f` 到最终实现提交的 diff。
- Produces: Critical/Important/Minor 审查结论及必要修复。

- [ ] **Step 1: 请求独立审查**

审查重点：2D 标题/数据源是否真正解耦；放大镜数值是否误乘 10；世界坐标与距离阈值；监听/timer/RAF 清理；自动旋转状态恢复；实时更新性能；数据边界是否越界到统计/回放/CSV。

- [ ] **Step 2: 处理 Critical/Important 问题**

每个有效问题先补失败测试或最小复现，再修改并重跑 Task 4 的完整专项测试和构建。Minor 问题仅在不扩大范围时处理。

- [ ] **Step 3: 最终新鲜验证**

Run: `npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js`

Run: `npm --prefix client run build`

Run: `git diff --check HEAD~1..HEAD`

Expected: 测试和构建均退出码 0，diff check 无错误，工作区无未计划修改。
