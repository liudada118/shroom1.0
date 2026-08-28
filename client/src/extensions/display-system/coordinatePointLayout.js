/**
 * coordinatePointLayout.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/coordinatePointLayout.js`（原本就零 import）。
 *
 * ⚠️ 这个壳有一个不寻常的消费者：`backend/tests/sdk/displayProfileRuntime.test.js`
 * **用裸 Node ESM 按文件路径**加载它（不经打包器）。所以下面这个裸包名必须能被
 * Node 自己解析出来 —— 依赖 `client/node_modules/@shroom/frontend` 这个
 * `file:` symlink 存在（`client/package.json` 里声明）。
 *
 * 也就是说：**跑后端测试前 `client/` 必须先 `npm i`**。壳里若改成相对路径
 * （`../../../../sdk/frontend/core/...`）能免掉这个前提，代价是把 monorepo 的目录
 * 布局写进了业务代码。这里选了前者，与另外 12 个壳保持一致。
 */

export * from '@shroom/frontend/core/coordinatePointLayout.js';
