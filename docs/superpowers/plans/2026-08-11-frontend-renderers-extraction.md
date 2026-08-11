# Frontend Renderers Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all five existing frontend renderer implementation families into `sdk/frontend/renderers/` while preserving existing package imports, renderer behavior, and lazy-loaded chunks.

**Architecture:** `sdk/frontend/core/` and `sdk/frontend/react/` retain renderer-independent infrastructure only. Each renderer becomes a vertical slice under `renderers/<id>/{core,react}`, shared Three/WebGL helpers move to `renderers/shared`, and `package.json.exports` maps both old and new public subpaths to the new files.

**Tech Stack:** JavaScript ESM, React 18, Three.js, Vitest 2, Vite 5, pnpm/npm, PowerShell.

## Global Constraints

- Do not change rendered pixels, normalized parameters, frame formats, renderer ids, methods, capabilities, or preset values.
- Keep `core/` loadable in bare Node without React, Three.js, DOM, or `localStorage` shims.
- Keep `RendererHost` free of static imports of renderer implementations.
- Keep all five built-in implementations behind static-analyzable `load: () => import('literal')` calls.
- Preserve existing `@shroom/frontend/core/*` and `@shroom/frontend/react/*` imports through `package.json.exports`.
- Add canonical `@shroom/frontend/renderers` and `@shroom/frontend/renderers/<id>/{core,react}` exports.
- Do not add a model UV heatmap implementation; `handPoints` remains the existing hand-model point-cloud renderer.
- Do not delete client compatibility facades under `client/src`.
- Update the root `ARCHITECTURE.md` after code migration.

---

## File Map

**Create or move into:**

- `sdk/frontend/renderers/builtins.js`: built-in descriptor registration and lazy imports.
- `sdk/frontend/renderers/index.js`: canonical renderer package entry.
- `sdk/frontend/renderers/structure.test.js`: package paths and directory boundary contract.
- `sdk/frontend/renderers/shared/three/*`: `SelectionHelper.js`, `pointPick.js`, `circle.png`.
- `sdk/frontend/renderers/shared/webgl/glUtil.js`: shared WebGL resource helpers.
- `sdk/frontend/renderers/numMatrix/core/*`: all current `core/numMatrix` files and tests.
- `sdk/frontend/renderers/numMatrix/react/*`: renderer and three backends.
- `sdk/frontend/renderers/pointGrid/core/*` and `react/*`.
- `sdk/frontend/renderers/handPoints/core/*` and `react/*`.
- `sdk/frontend/renderers/webglHeatmap/core/*` and `react/*`.
- `sdk/frontend/renderers/blobHeatmap/core/*` and `react/*`.

**Modify:**

- `sdk/frontend/package.json`: old/new exports and packed files.
- `sdk/frontend/vitest.config.js`: include colocated renderer tests.
- `sdk/frontend/core/index.js`: re-export renderer core APIs from new paths.
- `sdk/frontend/core/matrixDisplayModes.js`: import renderer parameter modules from new paths.
- `sdk/frontend/react/RendererHost.jsx`: import `registerBuiltinRenderers` from `../renderers/builtins.js`.
- `sdk/frontend/react/index.js`: re-export built-ins from the new canonical entry.
- `sdk/frontend/scripts/smoke-core.mjs`: update renderer-core relative imports.
- `sdk/frontend/README.md`: document new directory and canonical exports.
- `ARCHITECTURE.md`: append migration architecture and verification record.

**Delete after successful moves:**

- `sdk/frontend/core/{numMatrix,pointGrid,handPoints,webglHeatmap,blobHeatmap}/`.
- `sdk/frontend/react/{numMatrix,pointGrid,handPoints,webglHeatmap,blobHeatmap,three,webgl}/`.
- `sdk/frontend/react/builtins.js`.

---

### Task 1: Lock the Renderer Directory and Export Contract

**Files:**
- Create: `sdk/frontend/renderers/structure.test.js`
- Modify: `sdk/frontend/vitest.config.js`

**Interfaces:**
- Consumes: Node `fs`, `path`, and current `sdk/frontend/package.json`.
- Produces: structural contract requiring five vertical slices, no renderer implementation directories under legacy layers, and old/new package exports.

- [ ] **Step 1: Write the failing structure test**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rendererIds = ['numMatrix', 'pointGrid', 'handPoints', 'webglHeatmap', 'blobHeatmap'];
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

describe('renderer directory boundary', () => {
  it.each(rendererIds)('%s lives in one vertical renderer slice', (rendererId) => {
    expect(fs.existsSync(path.join(packageRoot, 'renderers', rendererId, 'core'))).toBe(true);
    expect(fs.existsSync(path.join(packageRoot, 'renderers', rendererId, 'react'))).toBe(true);
    expect(fs.existsSync(path.join(packageRoot, 'core', rendererId))).toBe(false);
    expect(fs.existsSync(path.join(packageRoot, 'react', rendererId))).toBe(false);
  });

  it('maps legacy and canonical public paths to renderer slices', () => {
    expect(packageJson.exports['./renderers']).toBe('./renderers/index.js');
    expect(packageJson.exports['./core/numMatrix']).toBe('./renderers/numMatrix/core/index.js');
    expect(packageJson.exports['./react/numMatrix/*']).toBe('./renderers/numMatrix/react/*');
    expect(packageJson.exports['./renderers/numMatrix/core']).toBe('./renderers/numMatrix/core/index.js');
  });
});
```

Add `'renderers/**/*.{test,spec}.{js,jsx}'` to `vitest.config.js` and keep the current core/react/docs globs.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run renderers/structure.test.js`

Expected: FAIL because `renderers/numMatrix/core` and the new package exports do not exist.

- [ ] **Step 3: Commit the failing contract test**

```powershell
git add sdk/frontend/renderers/structure.test.js sdk/frontend/vitest.config.js
git commit -m "test: define frontend renderer directory boundary"
```

---

### Task 2: Move Renderer Core Modules into Vertical Slices

**Files:**
- Move: `sdk/frontend/core/numMatrix/*` -> `sdk/frontend/renderers/numMatrix/core/*`
- Move: `sdk/frontend/core/pointGrid/*` -> `sdk/frontend/renderers/pointGrid/core/*`
- Move: `sdk/frontend/core/handPoints/*` -> `sdk/frontend/renderers/handPoints/core/*`
- Move: `sdk/frontend/core/webglHeatmap/*` -> `sdk/frontend/renderers/webglHeatmap/core/*`
- Move: `sdk/frontend/core/blobHeatmap/*` -> `sdk/frontend/renderers/blobHeatmap/core/*`
- Modify: `sdk/frontend/core/index.js`
- Modify: `sdk/frontend/core/matrixDisplayModes.js`
- Modify: `sdk/frontend/scripts/smoke-core.mjs`
- Modify: `sdk/frontend/package.json`

**Interfaces:**
- Consumes: shared `core/frameMath.js`, `core/colormaps.js`, `core/greyLadder.js`, and the five existing renderer core APIs.
- Produces: unchanged `LEGACY_PRESETS`, normalize functions, pipelines, layouts, shaders, and namespace exports at new physical paths.

- [ ] **Step 1: Create destination parents and move complete core directories**

Resolve and verify all sources start with `E:\shroom1\sdk\frontend\core\` and all destinations start with `E:\shroom1\sdk\frontend\renderers\` before moving. Then use PowerShell `Move-Item -LiteralPath` within the same filesystem.

```powershell
$ids = 'numMatrix','pointGrid','handPoints','webglHeatmap','blobHeatmap'
foreach ($id in $ids) {
  New-Item -ItemType Directory -Force -Path "sdk/frontend/renderers/$id" | Out-Null
  Move-Item -LiteralPath "sdk/frontend/core/$id" -Destination "sdk/frontend/renderers/$id/core"
}
```

- [ ] **Step 2: Update renderer-core imports to shared core**

Use these exact path rules:

```text
renderers/<id>/core/*.js -> shared core module: ../../../core/<module>.js
renderers/<id>/core/*.test.js -> shared core module: ../../../core/<module>.js
same renderer core sibling: ./<module>.js
```

Examples:

```js
import { addSide, gaussBlur_1, interpSmall } from '../../../core/frameMath.js';
import { glslStopLadder, HEAT_BLOB_STOPS } from '../../../core/colormaps.js';
```

- [ ] **Step 3: Update core aggregators and compatibility exports**

Change `core/index.js` renderer exports from `./numMatrix/...` to
`../renderers/numMatrix/core/...`, and apply the same pattern to all five ids.

Change `core/matrixDisplayModes.js` parameter imports to
`../renderers/<id>/core/params.js`.

In `package.json.exports`, point these existing paths at new files:

```json
"./core/numMatrix": "./renderers/numMatrix/core/index.js",
"./core/numMatrix/*": "./renderers/numMatrix/core/*",
"./core/pointGrid": "./renderers/pointGrid/core/index.js",
"./core/pointGrid/*": "./renderers/pointGrid/core/*",
"./core/handPoints": "./renderers/handPoints/core/index.js",
"./core/handPoints/*": "./renderers/handPoints/core/*",
"./core/webglHeatmap": "./renderers/webglHeatmap/core/index.js",
"./core/webglHeatmap/*": "./renderers/webglHeatmap/core/*",
"./core/blobHeatmap": "./renderers/blobHeatmap/core/index.js",
"./core/blobHeatmap/*": "./renderers/blobHeatmap/core/*"
```

Also add `"renderers"` to the package `files` array.

- [ ] **Step 4: Update bare-Node smoke imports**

For every direct import from `../core/<rendererId>/...` in `scripts/smoke-core.mjs`, use
`../renderers/<rendererId>/core/...`. Leave shared core imports unchanged.

- [ ] **Step 5: Run core tests and smoke**

Run:

```powershell
pnpm vitest run renderers/numMatrix/core renderers/pointGrid/core renderers/handPoints/core renderers/webglHeatmap/core renderers/blobHeatmap/core
pnpm smoke
```

Expected: all moved pure tests pass and all 32 bare-Node smoke checks pass. The structure test still fails only because React slices and canonical exports are not complete.

- [ ] **Step 6: Commit the core migration**

```powershell
git add sdk/frontend/core sdk/frontend/renderers sdk/frontend/scripts/smoke-core.mjs sdk/frontend/package.json
git commit -m "refactor: colocate renderer core modules"
```

---

### Task 3: Move React Renderers, Shared Graphics Helpers, and Built-ins

**Files:**
- Move: `sdk/frontend/react/numMatrix/*` -> `sdk/frontend/renderers/numMatrix/react/*`
- Move: `sdk/frontend/react/pointGrid/*` -> `sdk/frontend/renderers/pointGrid/react/*`
- Move: `sdk/frontend/react/handPoints/*` -> `sdk/frontend/renderers/handPoints/react/*`
- Move: `sdk/frontend/react/webglHeatmap/*` -> `sdk/frontend/renderers/webglHeatmap/react/*`
- Move: `sdk/frontend/react/blobHeatmap/*` -> `sdk/frontend/renderers/blobHeatmap/react/*`
- Move: `sdk/frontend/react/three/*` -> `sdk/frontend/renderers/shared/three/*`
- Move: `sdk/frontend/react/webgl/*` -> `sdk/frontend/renderers/shared/webgl/*`
- Move: `sdk/frontend/react/builtins.js` -> `sdk/frontend/renderers/builtins.js`
- Create: `sdk/frontend/renderers/index.js`
- Modify: `sdk/frontend/react/RendererHost.jsx`
- Modify: `sdk/frontend/react/index.js`
- Modify: `sdk/frontend/package.json`

**Interfaces:**
- Consumes: renderer core slices from Task 2, shared core infrastructure, React, Three.js.
- Produces: `registerBuiltinRenderers(): number`, five unchanged renderer descriptors, and the same lazy component modules.

- [ ] **Step 1: Move renderer React directories and shared graphics helpers**

Verify resolved source and destination roots as in Task 2, then move complete directories:

```powershell
$ids = 'numMatrix','pointGrid','handPoints','webglHeatmap','blobHeatmap'
foreach ($id in $ids) {
  Move-Item -LiteralPath "sdk/frontend/react/$id" -Destination "sdk/frontend/renderers/$id/react"
}
New-Item -ItemType Directory -Force -Path 'sdk/frontend/renderers/shared' | Out-Null
Move-Item -LiteralPath 'sdk/frontend/react/three' -Destination 'sdk/frontend/renderers/shared/three'
Move-Item -LiteralPath 'sdk/frontend/react/webgl' -Destination 'sdk/frontend/renderers/shared/webgl'
Move-Item -LiteralPath 'sdk/frontend/react/builtins.js' -Destination 'sdk/frontend/renderers/builtins.js'
```

- [ ] **Step 2: Update renderer React imports**

Apply these exact rules:

```text
renderers/<id>/react/<Renderer>.jsx -> shared root core: ../../../core/<module>.js
renderers/<id>/react/<Renderer>.jsx -> own core: ../core/<module>.js
renderers/<id>/react/<Renderer>.jsx -> shared graphics: ../../shared/<kind>/<module>
renderers/numMatrix/react/backends/*.js -> shared root core: ../../../../core/<module>.js
renderers/numMatrix/react/backends/*.js -> own core: ../../core/<module>.js
```

Examples:

```js
import { DUAL_CHANNEL_DEFAULTS } from '../../../core/displayThresholds.js';
import { normalizePointGridParams } from '../core/params.js';
import { SelectionHelper } from '../../shared/three/SelectionHelper.js';
import { buildProgram } from '../../shared/webgl/glUtil.js';
```

- [ ] **Step 3: Update built-in descriptor imports and lazy paths**

In `renderers/builtins.js`:

```js
import { RENDERER_CAPABILITIES } from '../core/contract.js';
import { registerRenderer } from '../core/registry.js';
import { LEGACY_PRESETS as NUM_MATRIX_PRESETS } from './numMatrix/core/params.js';
```

Use the same path for each renderer core. Change lazy imports to:

```js
load: () => import('./numMatrix/react/NumMatrixRenderer.jsx')
load: () => import('./pointGrid/react/PointGridRenderer.jsx')
load: () => import('./handPoints/react/HandPointsRenderer.jsx')
load: () => import('./webglHeatmap/react/WebglHeatmapRenderer.jsx')
load: () => import('./blobHeatmap/react/BlobHeatmapRenderer.jsx')
```

- [ ] **Step 4: Add the canonical renderer entry**

Create `renderers/index.js`:

```js
export { registerBuiltinRenderers } from './builtins.js';
export { default } from './builtins.js';
```

Update `react/RendererHost.jsx` and `react/index.js` to import/re-export from
`../renderers/builtins.js`.

- [ ] **Step 5: Complete old and new package exports**

Add canonical exports:

```json
"./renderers": "./renderers/index.js",
"./renderers/numMatrix/core": "./renderers/numMatrix/core/index.js",
"./renderers/numMatrix/core/*": "./renderers/numMatrix/core/*",
"./renderers/numMatrix/react/*": "./renderers/numMatrix/react/*"
```

Repeat the three renderer-specific entries for `pointGrid`, `handPoints`, `webglHeatmap`, and
`blobHeatmap`. Add `./renderers/shared/*` -> `./renderers/shared/*`.

Map legacy React subpaths:

```json
"./react/numMatrix/*": "./renderers/numMatrix/react/*",
"./react/pointGrid/*": "./renderers/pointGrid/react/*",
"./react/handPoints/*": "./renderers/handPoints/react/*",
"./react/webglHeatmap/*": "./renderers/webglHeatmap/react/*",
"./react/blobHeatmap/*": "./renderers/blobHeatmap/react/*",
"./react/three/*": "./renderers/shared/three/*",
"./react/webgl/*": "./renderers/shared/webgl/*"
```

Keep general `./core/*` and `./react/*` exports after the more specific mappings.

- [ ] **Step 6: Run the structure and built-in descriptor tests**

Run:

```powershell
pnpm vitest run renderers/structure.test.js react/builtins.test.js core/registry.test.js
```

Expected: PASS. The test would fail if a renderer stayed under `core/` or `react/`, if an old public path lost its mapping, or if descriptor registration stopped resolving.

- [ ] **Step 7: Commit the React migration**

```powershell
git add sdk/frontend/react sdk/frontend/renderers sdk/frontend/package.json
git commit -m "refactor: extract frontend renderer implementations"
```

---

### Task 4: Verify Consumers and Lazy Chunk Boundaries

**Files:**
- Modify only if verification exposes stale physical paths: `sdk/frontend/docs/**`, `sdk/frontend/example/**`, `client/src/**`
- Test: existing SDK, docs, example, and client test/build commands.

**Interfaces:**
- Consumes: old compatibility exports and new canonical renderer exports from Tasks 2-3.
- Produces: proven compatibility for the main client, docs, and lab example.

- [ ] **Step 1: Run the full SDK suite**

```powershell
cd E:\shroom1\sdk\frontend
pnpm test
pnpm smoke
```

Expected: 24 or more test files pass; smoke reports all checks passed.

- [ ] **Step 2: Build and render-check the documentation**

```powershell
cd E:\shroom1
npm --prefix sdk/frontend/docs run build
cd sdk/frontend/docs
node render-check.mjs
```

Expected: Vite build succeeds and all 13 routes render.

- [ ] **Step 3: Build the standalone frontend example**

```powershell
cd E:\shroom1\sdk\frontend\example
npm run build
```

Expected: build succeeds using existing `@shroom/frontend/core` and `/react` imports.

- [ ] **Step 4: Run client renderer tests and production build**

```powershell
cd E:\shroom1\client
npx vitest run src/renderers/index.test.js
npm run build
```

Expected: all renderer descriptors load and production build succeeds.

- [ ] **Step 5: Inspect chunk output and physical boundaries**

Run:

```powershell
rg --files sdk/frontend/core sdk/frontend/react | rg "numMatrix|pointGrid|handPoints|webglHeatmap|blobHeatmap|react[\\/]three|react[\\/]webgl"
Get-ChildItem client/dist/assets | Where-Object Name -Match "NumMatrixRenderer|PointGridRenderer|HandPointsRenderer|WebglHeatmapRenderer|BlobHeatmapRenderer"
```

Expected: the first command prints nothing; the second lists separate lazy chunks for renderer implementations. If the client output directory is configured as `../build`, inspect `build/assets` instead without deleting either directory.

- [ ] **Step 6: Commit any consumer-only compatibility corrections**

Only when this task required edits:

```powershell
git add sdk/frontend/docs sdk/frontend/example client/src
git commit -m "fix: preserve renderer consumers after extraction"
```

---

### Task 5: Update Architecture and Package Documentation

**Files:**
- Modify: `sdk/frontend/README.md`
- Modify: `ARCHITECTURE.md`

**Interfaces:**
- Consumes: final verified paths and commands from Tasks 1-4.
- Produces: documented canonical import path, compatibility policy, mode-to-implementation mapping, and migration record.

- [ ] **Step 1: Update the SDK README directory and entry tables**

Document:

```text
core/       renderer-independent contracts, registry, frame bus, shared math
react/      RendererHost and useSceneFrame
renderers/  five vertical implementation slices plus shared graphics helpers
```

Add a canonical example:

```js
import { registerBuiltinRenderers } from '@shroom/frontend/renderers';
import * as numMatrix from '@shroom/frontend/renderers/numMatrix/core';
```

State that existing `/core/*` and `/react/*` imports remain compatible.

- [ ] **Step 2: Incrementally update the root architecture document**

Append a dated `2026-08-11` renderer extraction section containing:

- the five vertical slices;
- the six user modes to five implementation-family mapping;
- preserved lazy loading and compatibility exports;
- explicit note that UV model-skin heatmap is not implemented by `handPoints`;
- exact test/build verification totals observed in Task 4.

Update the document's latest-maintenance date if that field exists.

- [ ] **Step 3: Run documentation and diff checks**

```powershell
git diff --check
npm --prefix sdk/frontend/docs run build
```

Expected: no whitespace errors and documentation build succeeds.

- [ ] **Step 4: Commit documentation**

```powershell
git add sdk/frontend/README.md ARCHITECTURE.md
git commit -m "docs: describe extracted frontend renderers"
```

---

## Final Verification

- [ ] `pnpm test` in `sdk/frontend` passes.
- [ ] `pnpm smoke` in `sdk/frontend` passes.
- [ ] docs build and all route checks pass.
- [ ] frontend example build passes.
- [ ] client renderer tests and production build pass.
- [ ] five renderer chunks remain separately lazy-loaded.
- [ ] no renderer implementation directories remain under `sdk/frontend/core` or `sdk/frontend/react`.
- [ ] old imports and new canonical imports both resolve.
- [ ] `git diff --check` reports no errors.
