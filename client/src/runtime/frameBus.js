/**
 * frameBus.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/frameBus.js`。
 *
 * ⚠️ 总线是**模块级单例**（订阅者集合 + 最后一帧都挂在模块作用域），全应用必须
 * 只有一份。`file:` 装进来的包是 symlink，这个壳的裸 `@shroom/frontend/...`
 * 与 SDK 内部的相对 import 会解析到同一个真实文件，所以单例成立。
 * 若哪天改成 copy 式安装或出现第二份包，这条性质会静默失效 —— 表现是
 * 「发布了帧但订阅者收不到」。`client/vite.config.js` 的 `resolve.dedupe` 守着它。
 */

export * from '@shroom/frontend/core/frameBus.js';
