# Task 2 Report: Human-body hover magnifier data model

## Scope

Implemented only the pure data-model layer required by Task 2. `HumanBodyOptimized.jsx` and all Task 1 files were left untouched.

## TDD evidence

### RED

Command:

```powershell
npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js
```

Key output before production code existed:

```text
FAIL src/components/video/humanBodyHoverData.test.js
Error: Failed to load url ./humanBodyHoverData ... Does the file exist?
```

This was the expected missing-module failure.

### GREEN

Command:

```powershell
npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js
```

Key output:

```text
Test Files  1 passed (1)
Tests       8 passed (8)
```

Nearest lookup uses the required strict inclusive comparison: `distanceSquared <= maxDistance ** 2`.

## Files changed

- `client/src/components/video/humanBodyHoverData.js`: dependency-free exports for raw weighted sensor values, squared-distance nearest lookup, isolated neighborhood construction, and safe hover placement.
- `client/src/components/video/humanBodyHoverData.test.js`: Vitest coverage for required behavior, invalid inputs, and edge cases.
- `ARCHITECTURE.md`: documented the added hover data-model module and progress.

## Self-review

- No DOM, React, or Three.js imports.
- Weighted values retain raw units and never apply shader-only `* 10` scaling.
- Neighborhood lookup requires equal `part` and `placementSide`, preventing cross-leg/cross-region leakage.
- Missing grid cells return `{ sensor: null, value: null }`; missing centers return a stable empty 3x3 grid.
- Nearest lookup is bounded by the inclusive 0.25 default and resolves equal distances by lower numeric `index`.
- Clamp results are finite, including viewport sizes smaller than the panel.
- `git diff --check` completed cleanly.

## Concerns

None. Coordinates may be supplied either as the current `{ position: { x, y, z } }` model shape or directly as `{ x, y, z }`, allowing a later Raycaster adapter to remain thin.

## Fix round 1: strict maximum-distance boundary

### Change

- Removed the `Number.EPSILON` distance tolerance from `findNearestHumanBodySensor`.
- The comparison is now strictly `distanceSquared > maximumDistanceSquared` for rejection, which keeps exact-boundary sensors and rejects every representable value beyond the limit.

### Regression coverage

- `findNearestHumanBodySensor > returns null outside the threshold or for invalid inputs` now includes a sensor at `x = 0.2500000000000002`, which must return `null` with the default `0.25` maximum distance.

### RED

```powershell
npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js
```

Key output before the fix:

```text
1 failed | 7 passed
expected { index: 9, position: { … } } to be null
```

### GREEN

```powershell
npm --prefix client test -- --run src/components/video/humanBodyHoverData.test.js
```

Key output after the fix:

```text
Test Files  1 passed (1)
Tests       8 passed (8)
```
