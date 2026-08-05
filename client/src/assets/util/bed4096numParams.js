/**
 * bed4096numParams.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/bed4096numParams.js`。
 *
 * ⚠️ 这个模块导出的是一个**模块级共享可变对象**：`three/4096.jsx` 与数字矩阵
 * 渲染器读写的是同一份，所以「切换展示形式时调过的参数不重置」。经这个壳与经
 * 包名拿到的必须是同一个对象引用 —— symlink 安装下成立，理由同 `runtime/frameBus.js`。
 */

export * from '@shroom/frontend/core/bed4096numParams.js';
