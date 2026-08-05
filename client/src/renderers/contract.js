/**
 * contract.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/contract.js`。
 *
 * ⚠️ `RENDERER_PROPS` / `RENDERER_METHODS` 现在是**包的公开面**。往里补一个 prop
 * （像上轮补 `colormap` / `coordinateMap`）对包外就是 breaking change，而前端契约
 * 目前**没有版本号**（后端那边有 `SDK_CONTRACT_VERSION` 与「纯追加不升版本」的
 * 规矩，前端一个都没有）。改这两个对象前先读 `sdk/frontend/README.md` 的契约一节。
 */

export * from '@shroom/frontend/core/contract.js';
