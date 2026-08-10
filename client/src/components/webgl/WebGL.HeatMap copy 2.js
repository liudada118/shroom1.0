/**
 * WebGL.HeatMap copy 2.js - 壳
 *
 * 实现搬进了 `@shroom/frontend/react/webglHeatmap/blobs.js`（第四轮，2026-08-10）。
 * 这里留壳而不是删掉，是因为原路径还有**五个**引用方，且它们都不是展示形式、
 * 本轮不动：
 *
 * - `components/video/hand.jsx:21`
 * - `components/video/humanBody.jsx:6`
 * - `components/video/robotLCF.jsx:27`
 * - `components/video/robotSY.jsx:27`
 * - `page/home/Home.jsx:100`
 *
 * 五处都是 `import { WebGLCanvas } from "…/WebGL.HeatMap copy 2"`，所以 `export *`
 * 够了（原文件的 `export default` 全仓没人用）。
 *
 * ⚠️ 它们还都在调 `render(cfg, data, 'dynamic')` —— 那个第三参数在原实现里只出现在
 * 注释掉的代码里，包里的新签名不再声明它。JS 会忽略多余实参，所以这五处一个字
 * 都不用改。
 *
 * 搬家时删掉的 5 个死导出（约 250 行）、修掉的每帧 GL 泄漏、以及为什么那张共享
 * 画布必须继续共享，全部记在包里那个文件的头部。
 */

export * from '@shroom/frontend/react/webglHeatmap/blobs.js';
