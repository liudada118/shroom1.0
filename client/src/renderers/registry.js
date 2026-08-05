/**
 * registry.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/registry.js`。
 *
 * ⚠️ 注册表是**模块级单例**（`Map` 挂在模块作用域）。主应用注册 `pointGrid`、
 * SDK 注册 `numMatrix`，两边必须落进同一个 Map，否则 `listRenderers()` 只看得见
 * 一半。symlink 安装下这条成立，理由同 `runtime/frameBus.js`。
 *
 * 与 `sdk/frontend/src/display/DisplayRegistry.js` 不是一回事：那个管「展示系统」
 * （设备定义），这个管「把一帧画出来的实现」。见本文件搬走后的头部注释。
 */

export * from '@shroom/frontend/core/registry.js';
