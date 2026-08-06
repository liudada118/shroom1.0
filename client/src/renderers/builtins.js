/**
 * builtins.js - 壳文件：两个内置渲染器现在都由 `@shroom/frontend` 注册
 *
 * 第一轮（2026-08-03）搬走 `numMatrix`，第二轮（2026-08-05）搬走 `pointGrid`，
 * 于是这里一份描述符都不剩了。描述符与 `load` 路径都在包里
 * （`sdk/frontend/react/builtins.js`）—— **主应用不再抄一份**，抄一份就会漂移。
 *
 * 那为什么还留着这个文件？
 *
 * - `client/src/renderers/index.js`、`RendererHost` 与 `index.test.js` 都在
 *   import 它。删掉就是一次纯粹为了少一个文件的连锁改名。
 * - 它是主应用注册自己私有渲染器的**正式挂点**。将来有一个只属于主应用、
 *   不该进包的渲染器（比如绑死某台设备的），就加在下面那个数组里，
 *   和包里的那两个一起注册进同一个 Map。
 *
 * 注册幂等、按 id 覆盖，所以谁先谁后都一样。
 */

import { registerBuiltinRenderers as registerSdkBuiltins } from '@shroom/frontend/react';

/**
 * 注册全部内置渲染器。
 *
 * 幂等：重复调用不会产生副作用，注册表按 id 覆盖。
 *
 * @returns {number} 成功注册的渲染器数量。
 */
export function registerBuiltinRenderers() {
  // 主应用私有的渲染器加在这里；目前一个都没有，两个内置的都在包里。
  const results = [];

  return results.filter(Boolean).length + registerSdkBuiltins();
}
