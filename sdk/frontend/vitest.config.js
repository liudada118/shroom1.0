import { defineConfig } from 'vitest/config';

/**
 * SDK 自己的测试配置。
 *
 * ## 为什么没有 setupFiles
 *
 * 主应用有一个 `client/vitest.setup.js`，专门给 `localStorage` 打 Map 垫片 ——
 * 那是因为 `util.js` 在**模块顶层**就读 `localStorage`（`initValue`），
 * 环境里没有它连 import 都过不去。
 *
 * 搬进 `core/` 的模块没有这个毛病：`displayThresholds.js` 用
 * `globalThis.localStorage?.` 在调用时才读，它的测试自己用
 * `vi.stubGlobal('localStorage', ...)` 在 `beforeEach` 里造一个 Map 后端、
 * `afterEach` 里 `vi.unstubAllGlobals()` 收掉。所以这里不需要全局垫片 ——
 * 这正是「零依赖层」这条线换来的东西，不是省事。
 *
 * 同一条性质由 `scripts/smoke-core.mjs` 在裸 Node 里再验一次（无 vitest、
 * 无垫片、无打包器）。两者验的是同一件事的两端。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'core/**/*.{test,spec}.{js,jsx}',
      'react/**/*.{test,spec}.{js,jsx}',
      'renderers/**/*.{test,spec}.{js,jsx}',
      'docs/src/lib/**/*.{test,spec}.{js,jsx}',
    ],
  },
});
