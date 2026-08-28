# 人体全身优化渲染设置精简、折叠与缓存 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将人体全身优化设置精简为热力/水晶，限制并缓存渲染参数，修复 Shader 模型色，增加面板折叠，并让自动旋转/暂停只在全身视角生效。

**Architecture:** 新建纯函数配置模块负责版本化 localStorage 数据的默认值、逐字段规范化和安全读写，使缓存逻辑可在无 DOM 的 Vitest 环境测试。`HumanBodyOptimized.jsx` 只消费规范化设置、把模型色传入 Shader，并维护“全身用户偏好 + 临时悬停/拖动/飞行暂停”的旋转状态机；UI 只暴露热力和水晶两种模式。

**Tech Stack:** React、Three.js r127、localStorage、Vitest 2.1、Vite 5。

## Global Constraints

- 设置面板只显示 `heatmap` 和 `crystal`；线网、点云、叠加及其内部资源不删除。
- 扩散半径默认 `0.13`，范围 `0.05–0.13`，步进 `0.01`；所有入口统一钳制。
- 缓存独立于 `Home.valueConfig`，字段固定为 `mode/radius/intensity/opacity/colorScheme/bgColor/modelColor/settingsCollapsed/overviewAutoRotate` 和 `version`。
- `max`、`filter` 继续由 `Home` 控制；有效组件缓存半径不被初始 `renderOptions.size=31` 覆盖。
- 模型颜色必须同时影响热力与水晶 Shader，并继续同步内部 ghost material。
- 仅全身视角显示旋转切换；部位视角固定暂停；返回全身和重置恢复缓存偏好。
- 不修改 1024 原始数据、点位 JSON、区域方向、2D 数字、3×3 悬停值、统计、回放、CSV 或后端。

---

### Task 1: 版本化渲染设置缓存纯函数

**Files:**
- Create: `client/src/components/video/humanBodyRenderSettings.js`
- Create: `client/src/components/video/humanBodyRenderSettings.test.js`

**Interfaces:**
- Produces: `HUMAN_BODY_RENDER_SETTINGS_KEY`、`HUMAN_BODY_RENDER_SETTINGS_VERSION`、`DEFAULT_HUMAN_BODY_RENDER_SETTINGS`、`clampHumanBodyRadius(value)`、`normalizeHumanBodyRenderSettings(value)`、`readHumanBodyRenderSettings(storage)`、`writeHumanBodyRenderSettings(storage, value)`。
- Consumed by: Task 2 `HumanBodyOptimized.jsx`。

- [ ] **Step 1: 写缓存默认值与规范化失败测试**

覆盖：默认半径 `0.13`、半径 `0.05–0.13`、模式只接受两值、颜色仅接受 `#RRGGBB`、数值与布尔字段逐项回退、版本不兼容时回到默认。

- [ ] **Step 2: 运行 RED**

```powershell
npm --prefix client test -- --run src/components/video/humanBodyRenderSettings.test.js
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现最小纯函数模块**

默认对象固定为：

```js
{
  version: 1,
  mode: "heatmap",
  radius: 0.13,
  intensity: 0.8,
  opacity: 0.15,
  colorScheme: 0,
  bgColor: "#0a0a0f",
  modelColor: "#6a7a8a",
  settingsCollapsed: false,
  overviewAutoRotate: true,
}
```

`read` 捕获 `getItem/JSON.parse` 异常；`write` 捕获 `setItem` 异常并返回布尔成功状态。

- [ ] **Step 4: 运行 GREEN**

```powershell
npm --prefix client test -- --run src/components/video/humanBodyRenderSettings.test.js
```

Expected: 全部通过。

---

### Task 2: 精简面板、接入缓存并修复模型色

**Files:**
- Modify: `client/src/components/video/HumanBodyOptimized.jsx`
- Modify: `client/src/components/video/humanBodyRenderSettings.test.js`

**Interfaces:**
- Consumes: Task 1 缓存 API。
- Produces: 只显示热力/水晶的可折叠设置面板；Shader uniform `uModelColor`；缓存驱动的外观 state。

- [ ] **Step 1: 增加源码约束失败测试**

测试读取 `HumanBodyOptimized.jsx` 源码并断言：存在 `uModelColor` uniform；可见模式列表只包含热力/水晶；半径 range 使用 `min=5 max=13 step=1`；不渲染“线条 / 点云”颜色行；存在折叠按钮的 `aria-expanded`。该测试必须在生产代码修改前失败。

- [ ] **Step 2: 运行 RED**

```powershell
npm --prefix client test -- --run src/components/video/humanBodyRenderSettings.test.js
```

Expected: 至少因 `uModelColor`、半径上限或折叠控制缺失而 FAIL。

- [ ] **Step 3: 初始化规范化设置 state**

组件首次渲染通过 `readHumanBodyRenderSettings(window.localStorage)` 读取一次，并分别初始化 mode、radius、intensity、opacity、colorScheme、bgColor、modelColor、settingsCollapsed、overviewAutoRotate。SSR/无 window 时使用默认对象。

- [ ] **Step 4: 统一半径入口和缓存优先级**

`changeColor({size})` 与后续 `renderOptions.size` 使用 `clampHumanBodyRadius(Number(size)/100)`；初次 props effect 若已有有效组件缓存则不覆盖 radius。用户滑块写入 `0.05–0.13`。

- [ ] **Step 5: 用 effect 保存规范化设置**

依赖所有缓存字段，跳过初始化读之前的错误写入，调用 `writeHumanBodyRenderSettings`；缓存失败不得抛出。

- [ ] **Step 6: 修复 Shader 模型颜色**

fragment shader 增加 `uniform vec3 uModelColor`；热力无压区 `baseColor=uModelColor`；水晶 `mix(uModelColor, color, heat*0.9)` 并保留 Fresnel。创建 material 时注入 `new THREE.Color(modelColor)`，modelColor effect 同步 `material.uniforms.uModelColor.value.set(modelColor)` 与 ghost material。

- [ ] **Step 7: 精简并折叠 UI**

模式列表只渲染热力/水晶；删除可见线条/点云 ColorRow；标题栏增加折叠按钮和 `aria-expanded={!settingsCollapsed}`，折叠时只渲染标题栏，展开时渲染所有外观设置。

- [ ] **Step 8: 运行 GREEN 与既有专项回归**

```powershell
npm --prefix client test -- --run src/components/video/humanBodyRenderSettings.test.js src/components/video/humanBodyHoverData.test.js src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js
```

Expected: 全部通过。

---

### Task 3: 全身旋转偏好与部位视角状态机

**Files:**
- Modify: `client/src/components/video/HumanBodyOptimized.jsx`
- Modify: `client/src/components/video/humanBodyRenderSettings.js`
- Modify: `client/src/components/video/humanBodyRenderSettings.test.js`

**Interfaces:**
- Produces: `getHumanBodyAutoRotate({ activeRegion, overviewAutoRotate, temporarilySuspended })` 纯决策函数；组件内旋转切换、视角飞行和临时暂停统一使用该决策。

- [ ] **Step 1: 写旋转决策失败测试**

断言：只有 `activeRegion === "overview" && overviewAutoRotate === true && temporarilySuspended === false` 返回 true；部位视角、用户暂停、临时暂停都返回 false。

- [ ] **Step 2: 运行 RED**

```powershell
npm --prefix client test -- --run src/components/video/humanBodyRenderSettings.test.js
```

Expected: FAIL，缺少旋转决策函数或状态机源码约束。

- [ ] **Step 3: 接入最新状态 ref**

增加 `activeRegionRef`、`overviewAutoRotateRef`，每次 state 变化同步；Three effect 内所有延迟回调从 ref 读取最新用户偏好和当前视角，避免闭包旧值。

- [ ] **Step 4: 改造临时暂停/恢复**

悬停、拖动、飞行开始时设置临时暂停；恢复时调用纯决策函数。部位视角不恢复；全身用户暂停不恢复；全身自动旋转才恢复。保留已有 timer/RAF/listener 清理和 reset-during-drag 竞态保护。

- [ ] **Step 5: 改造 flyTo/resetView**

`flyTo(regionKey)` 在任意视角飞行期间停止旋转；飞行结束时：全身按缓存偏好恢复，其他视角保持 false。`resetView()` 调用 `flyTo("overview")`，不再无条件 schedule true。

- [ ] **Step 6: 添加全身旋转按钮**

只在 `activeRegion === "overview"` 时显示一个按钮；根据状态显示“暂停”或“自动旋转”，点击只更新 `overviewAutoRotate` 并立即更新 controls。部位视角无该按钮。

- [ ] **Step 7: 运行全套专项测试**

```powershell
npm --prefix client test -- --run src/components/video/humanBodyRenderSettings.test.js src/components/video/humanBodyHoverData.test.js src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js
```

Expected: 新缓存/源码约束/旋转决策测试与既有 31 项全部通过。

---

### Task 4: 架构、生产构建和真实浏览器验收

**Files:**
- Modify: `ARCHITECTURE.md`
- Regenerate: `build/index.html`
- Regenerate: `build/assets/index-*.js`

**Interfaces:**
- Consumes: Task 1-3 完整实现。
- Produces: 最新架构记录、生产资源和浏览器证据。

- [ ] **Step 1: 更新架构文档**

记录模式精简、半径范围、Shader 模型色、独立版本缓存、折叠面板、仅全身旋转偏好和部位暂停；明确数据链路与点位不变。

- [ ] **Step 2: 运行生产构建**

```powershell
npm --prefix client run build
```

Expected: exit 0；记录既有 duplicate-key、Sass、eval、empty-chunk、large-chunk 警告。

- [ ] **Step 3: Chromium WebGL 验收**

在真实 WebGL 页面验证：只见热力/水晶；折叠后仅标题栏；半径最大 0.13；两模式模型色可见；刷新恢复缓存；全身按钮切换旋转；部位视角暂停；返回全身恢复偏好；hover/drag 后恢复逻辑正确。检查无新增 console/page error。

- [ ] **Step 4: 最终差异检查**

```powershell
git status --short
git diff --check
```

Expected: 只有源实现/测试/ARCH/生产入口资产，临时 WS 或日志不进入 Git。

---

### Task 5: 独立审查与提交

**Files:**
- Review: all changes since `727b736`
- Commit: validated files only

- [ ] **Step 1: 请求只读代码审查**

重点检查缓存损坏/优先级、Shader uniform、半径钳制、隐藏模式、折叠、全身/部位/hover/drag/reset/unmount 旋转竞态，以及数据范围未扩张。

- [ ] **Step 2: 修复 Critical/Important 并重复验证**

任何修复均重新运行专项测试、生产构建和相关浏览器步骤。

- [ ] **Step 3: 精确暂存并提交**

```powershell
git add -- ARCHITECTURE.md client/src/components/video/HumanBodyOptimized.jsx client/src/components/video/humanBodyRenderSettings.js client/src/components/video/humanBodyRenderSettings.test.js build/index.html build/assets/index-*.js docs/superpowers/plans/2026-08-13-human-body-render-controls-cache.md
git commit -m "优化人体渲染设置与全身旋转"
```

- [ ] **Step 4: 提交后确认**

```powershell
git status --short --branch
git log -1 --oneline
```

Expected: 工作区干净，保留在 `Revise`，不推送。

