# 人体左右手臂点位 `(7)` 定向合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只把桌面 `(7)` 档案的左右手臂位置合并到人体全身优化点位资源，并证明前胸及所有其他映射均未改变。

**Architecture:** 以项目当前 JSON 为基底，按 `index` 将 `(7)` 中 `右手臂`、`左手臂` 条目的 `x/y/z` 定向覆盖到 `logicalFlat` 与 `flat`，并整体替换两个同名 `canvases` 对象。使用一次性校验脚本先对当前档案得到预期 RED，再执行机械合并并得到 GREEN；生产构建负责把 public 资源同步到 `build/model`。

**Tech Stack:** Node.js、JSON v7 点位档案、Vite、Vitest、Git。

## Global Constraints

- 源文件固定为 `C:/Users/23823/Desktop/sensor_canvas_positions (7).json`。
- 目标源资源固定为 `client/public/model/sensor_canvas_positions.json`。
- 只允许左右手臂共 180 个 `logicalFlat` 条目和 180 个 `flat` 条目的坐标变化。
- 前胸及其他区域全部字段保持目标文件修改前的值。
- `version=7`、`totalPhysicalSensors=1120`、`totalLogicalSensors=800`，索引、行列和映射字段不变。
- 不修改原始 1024 数据、方向映射、2D 数字、统计、回放、CSV 或后端。

---

### Task 1: 建立定向合并校验门槛

**Files:**
- Create temporarily: `.superpowers/sdd/2026-08-13-human-body-arm-layout-v7-merge/merge-and-verify.cjs`
- Read: `client/public/model/sensor_canvas_positions.json`
- Read: `C:/Users/23823/Desktop/sensor_canvas_positions (7).json`

**Interfaces:**
- Consumes: 当前项目档案与 `(7)` 档案。
- Produces: `verify(target, baseline, source)`，校验结构、180 个手臂坐标、非手臂完全不变和两个手臂画布对象。

- [ ] **Step 1: 用 `apply_patch` 创建一次性合并/校验脚本**

脚本必须在内存中保留 `baseline`，按 `index` 比较 `logicalFlat`/`flat`，拒绝缺失索引、重复索引、任何非坐标字段变化，以及任何非手臂字段变化。`merge()` 只覆盖规格允许的字段。

- [ ] **Step 2: 运行 RED 校验**

Run:

```powershell
node .superpowers/sdd/2026-08-13-human-body-arm-layout-v7-merge/merge-and-verify.cjs --verify-only
```

Expected: exit 1，并明确报告项目当前左右手臂坐标尚未与 `(7)` 一致；不得因 JSON 解析错误失败。

---

### Task 2: 合并左右手臂并验证数据边界

**Files:**
- Modify: `client/public/model/sensor_canvas_positions.json`
- Use temporarily: `.superpowers/sdd/2026-08-13-human-body-arm-layout-v7-merge/merge-and-verify.cjs`

**Interfaces:**
- Consumes: Task 1 的 `merge()` 与 `verify()`。
- Produces: 以当前档案为基底、只采用 `(7)` 左右手臂位置的 v7 JSON。

- [ ] **Step 1: 执行机械合并**

Run:

```powershell
node .superpowers/sdd/2026-08-13-human-body-arm-layout-v7-merge/merge-and-verify.cjs --merge
```

脚本按 `index` 覆盖两个数组中手臂条目的 `x/y/z`，并替换 `canvases.右手臂`、`canvases.左手臂`；不得覆盖整个 `(7)` 文件。

- [ ] **Step 2: 运行 GREEN 校验**

Run:

```powershell
node .superpowers/sdd/2026-08-13-human-body-arm-layout-v7-merge/merge-and-verify.cjs --verify-only
```

Expected: exit 0，报告 `logicalFlat=180`、`flat=180`，两个手臂与 `(7)` 一致，非手臂与 baseline 一致，v7/1120/800/唯一索引通过。

- [ ] **Step 3: 审计 Git 差异范围**

Run:

```powershell
git status --short
git diff --numstat -- client/public/model/sensor_canvas_positions.json
```

Expected: 源点位档案是唯一运行资源变化；临时脚本受本地 exclude 忽略。

---

### Task 3: 更新架构文档和生产资源

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `build/model/sensor_canvas_positions.json`
- Possibly regenerate unchanged-hash entries under: `build/`

**Interfaces:**
- Consumes: Task 2 已验证的源点位档案。
- Produces: 记录“仅左右手臂”的架构变更，以及与源资源完全一致的生产点位副本。

- [ ] **Step 1: 用 `apply_patch` 增量更新架构文档**

在人体全身优化专章、项目进度和更新日志中记录：采用 `(7)` 的左右手臂 180 个物理/逻辑坐标和两侧 `armWrap`，前胸与其他区域不变，数据映射和 1024 原始帧不变。

- [ ] **Step 2: 运行人体专项回归**

Run:

```powershell
npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js src/components/video/humanBodyNumberViews.test.js src/components/video/humanBodyNumberLabels.test.js src/components/video/humanBodyOrientation.test.js
```

Expected: 4 files、31 tests passed。

- [ ] **Step 3: 运行生产构建**

Run:

```powershell
npm --prefix client run build
```

Expected: exit 0；既有 duplicate-key、Sass、eval、empty-chunk 和 large-chunk 警告可记录，但无新增失败。

- [ ] **Step 4: 验证生产点位副本**

Run:

```powershell
Get-FileHash client/public/model/sensor_canvas_positions.json,build/model/sensor_canvas_positions.json
```

Expected: 两个 SHA256 完全一致；`build/index.html` 引用的入口 bundle 文件存在。

- [ ] **Step 5: 检查最终差异**

Run:

```powershell
git status --short
git diff --check
```

Expected: 只有规格、源点位 JSON、生产点位 JSON、ARCHITECTURE 及构建真正改变的入口资产；无临时脚本、桌面文件或日志进入 Git。

---

### Task 4: 审查并提交

**Files:**
- Review: all changes since `af736c2`
- Commit: only validated repository files

**Interfaces:**
- Consumes: Task 1-3 的数据和验证证据。
- Produces: Revise 分支上的已审查提交。

- [ ] **Step 1: 请求只读代码/数据审查**

审查重点：是否严格只合并左右手臂、是否有前胸漂移、源/生产副本是否一致、架构记录是否准确、无临时文件进入提交。

- [ ] **Step 2: 处理所有 Critical/Important 意见并重新验证**

若有修正，重新运行 Task 2 GREEN、31 项专项测试、生产构建和哈希校验。

- [ ] **Step 3: 精确暂存并提交**

```powershell
git add -- ARCHITECTURE.md client/public/model/sensor_canvas_positions.json build/model/sensor_canvas_positions.json build/index.html build/assets/index-*.js docs/superpowers/plans/2026-08-13-human-body-arm-layout-v7-merge.md
git commit -m "更新人体左右手臂传感器点位"
```

- [ ] **Step 4: 提交后确认**

Run:

```powershell
git status --short --branch
git log -1 --oneline
```

Expected: 工作区干净，HEAD 为本次手臂点位提交；不推送远端。

