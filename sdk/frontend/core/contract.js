/**
 * contract.js - 渲染器插件契约
 *
 * 这份契约不是新发明的，而是把 Home.jsx 中 55 个场景组件已经在用的
 * 事实约定形式化下来，便于渲染器插件化后做静态校验与文档化。
 *
 * 契约来源（统计自 Home.jsx 的实际调用）：
 * - 声明式 props：7 个，跨场景高度一致
 * - 命令式方法：通过 useImperativeHandle 暴露，Home 侧按需调用
 *
 * 参数化渲染器必须同时满足两点，缺一不可：
 * 1. 实现下面的 props / 命令式方法子集；
 * 2. 不持有模块级可变状态——所有运行期状态必须在实例作用域内，
 *    否则同一渲染器无法多实例挂载，也无法在切换时安全释放。
 */

/**
 * 渲染器声明式 props 契约。
 *
 * 键为 prop 名，值为用途说明。渲染器可只实现其中一部分，
 * 但不得引入契约之外的 prop——需要额外输入时走 params 通道。
 */
export const RENDERER_PROPS = {
  data: '可变数据源引用（ref），高频帧数据经由它读取，绕开 setState',
  local: '国际化标记，true 表示由外层托管图表回调',
  params: '渲染器参数对象，来自 manifest 的 display.renderers[].params',
  handleChartsBody: '主图表数据回调',
  handleChartsBody1: '副图表数据回调',
  changeStateData: '向上回写状态',
  changeSelect: '选区变更回调',
  // 这两个原先漏在契约外，但它们是既有的事实约定，不是新加的口子：
  // `ManifestDisplayRenderer` 把 activeProfile 的配色透传给各 widget 与场景，
  // `hand.jsx` / `NumThreeColor1024.jsx` 已经在读。契约取的是"已经在用的
  // 约定"，所以补进来。`RendererHost` 通过 `...contractProps` 原样转发。
  colormap: '配色方案 { id, reverse }，缺省即 classic；换配色由外层整场重建',
  coordinateMap: '物理坐标表，有则按实际点位布局，无则退回规则矩阵',
};

/**
 * 渲染器命令式方法契约。
 *
 * 值为该方法在 Home.jsx 中通过 ref 调用的次数，用于判断迁移优先级：
 * 调用点越多的方法，越应当在参数化渲染器中优先支持。
 *
 * 值为 0 表示场景组件在 useImperativeHandle 中暴露了该方法，但当前宿主
 * 没有调用它。这类方法仍属于契约的一部分——契约取的是"暴露面的并集"
 * 而非"当前调用点的集合"，否则换一个宿主就会误判为契约外方法。
 *
 * **计数只统计了 Home.jsx，漏掉了 `page/home/util.js`。** 那 5,564 行里的
 * `that.com.current?.xxx(...)` 用的是同一个 ref（`that` 就是 Home 实例），
 * 只是调用点写在 util.js 侧。`changeWsDataRaw` 因此一度被误判为"契约外方法"
 * ——它有 11 个真实调用点。补齐这一项时没有回头重算其余各项，所以下面的
 * 数字应当读作"至少这么多次"，别当成精确统计。
 */
export const RENDERER_METHODS = {
  changeWsData147: 21,
  changePointRotation: 15,
  changeWsData147R: 14,
  changeGroupRotate: 14,
  changeWsData256: 8,
  reset: 5,
  sitData: 3,
  sitValue: 2,
  setFrontView: 2,
  changeWsDatapalm: 2,
  changeWsDatafinger: 2,
  changeHumanBodyData: 2,
  backValue: 2,
  sensorData: 1,
  resetHand: 1,
  headData: 1,
  changeWsData: 1,
  changeSelectFlag: 1,
  // 计数来自 page/home/util.js 而非 Home.jsx，见上文说明。
  changeWsDataRaw: 11,
  // 以下方法由场景组件暴露，Home.jsx 目前未经 ref 调用
  backData: 0,
  sitRenew: 0,
  changeDataFlag: 0,
};

/**
 * 渲染器能力标记。
 *
 * 供注册表与 Builder 过滤：manifest 声明所需能力后，
 * 只有同时具备这些能力的渲染器才会出现在可选列表里。
 */
export const RENDERER_CAPABILITIES = {
  /** 支持 sit 通道 */
  SIT: 'sit',
  /** 支持 back 通道 */
  BACK: 'back',
  /** 支持 head 通道 */
  HEAD: 'head',
  /** 支持框选交互 */
  BOX_SELECT: 'boxSelect',
  /** 支持点位拾取 */
  POINT_PICK: 'pointPick',
  /** 支持视角旋转 */
  ROTATE: 'rotate',
  /** 需要外部 3D 模型文件 */
  MODEL: 'model',
};

/**
 * 校验渲染器描述符是否满足契约。
 *
 * 仅做结构校验，不加载渲染器本体——注册阶段就能拦下明显错误的插件，
 * 避免坏插件在运行期才暴露问题。
 *
 * @param {object} descriptor 渲染器描述符。
 * @returns {{ valid: boolean, errors: string[] }} 校验结果。
 */
export function validateRendererDescriptor(descriptor) {
  const errors = [];

  if (!descriptor || typeof descriptor !== 'object') {
    return { valid: false, errors: ['渲染器描述符必须是对象'] };
  }

  if (!descriptor.id || typeof descriptor.id !== 'string') {
    errors.push('缺少 id 或 id 不是字符串');
  }

  if (typeof descriptor.load !== 'function') {
    errors.push('缺少 load，必须是返回动态 import() 的函数');
  }

  if (descriptor.capabilities !== undefined) {
    if (!Array.isArray(descriptor.capabilities)) {
      errors.push('capabilities 必须是数组');
    } else {
      const known = new Set(Object.values(RENDERER_CAPABILITIES));
      descriptor.capabilities
        .filter((capability) => !known.has(capability))
        .forEach((capability) => errors.push(`未知能力标记: ${capability}`));
    }
  }

  if (descriptor.methods !== undefined) {
    if (!Array.isArray(descriptor.methods)) {
      errors.push('methods 必须是数组');
    } else {
      descriptor.methods
        .filter((method) => !(method in RENDERER_METHODS))
        .forEach((method) => errors.push(`契约外的命令式方法: ${method}`));
    }
  }

  if (descriptor.normalizeParams !== undefined
    && typeof descriptor.normalizeParams !== 'function') {
    errors.push('normalizeParams 必须是函数');
  }

  return { valid: errors.length === 0, errors };
}
