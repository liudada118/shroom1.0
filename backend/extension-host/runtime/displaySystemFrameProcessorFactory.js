const fs = require('fs');
const {
  executeConfiguredMapping,
  loadJsonDefinition: defaultLoadJsonDefinition,
} = require('@shroom/backend/processing/configMappingExecutor.js');
const { decodeProtocolValues, validateFrame } = require('@shroom/backend/protocol/displaySystemProtocol.js');
const {
  createJavaScriptAlgorithmRunner,
  createPythonAlgorithmRunner,
} = require('../../kernel/algorithm-channel/displaySystemAlgorithmRunner');

/**
 * 读一份可选的 JSON 定义文件；没声明路径就返回 null。
 *
 * 这层薄包装的意义是让三个 getter（线序/点位/算法数据）都不用各自写 `if (!path)`
 * —— 三份文件里只有线序和点位是 manifest 必填的，算法数据是可选的，而三个 getter
 * 的缓存写法要求「没有」也是一个可缓存的值（见 getAlgorithmData）。
 *
 * @param {string|null|undefined} filePath JSON 绝对路径。
 * @param {object} fsLike 文件系统适配器（测试注入）。
 * @returns {object|null} 解析后的 JSON；未声明为 null。
 */
function loadOptionalJson(filePath, fsLike) {
  if (!filePath) return null;
  return defaultLoadJsonDefinition(filePath, fsLike);
}

/**
 * 从一帧里取出原始数值数组。
 *
 * 接受五种形状是迁移期的现实：新链路给的是裸数组或 `{data}`，而
 * `sitData`/`backData`/`headData` 是旧前端和旧解析器留下的字段名（同一组名字在
 * getChannelDataField 里还要再用一次，那边是往外发，这边是往里收）。
 *
 * 都不匹配时**抛错而不是返回空数组**：这一步失败说明上游给的帧结构不对，返回 `[]`
 * 会让画面变成一片零值、看起来像「传感器没压力」，是最难查的一类现象。抛错是安全的
 * 因为调用方（绑定层的 handleFrame）对每帧单独 try/catch，一帧坏掉不会停掉整条链路。
 *
 * @param {Array|object} frame 原始帧。
 * @returns {number[]} 原始数值数组。
 * @throws {Error} 帧既不是数组也不含上述四个字段。
 */
function getFrameValues(frame) {
  if (Array.isArray(frame)) return frame;
  if (Array.isArray(frame?.data)) return frame.data;
  if (Array.isArray(frame?.sitData)) return frame.sitData;
  if (Array.isArray(frame?.backData)) return frame.backData;
  if (Array.isArray(frame?.headData)) return frame.headData;
  throw new Error('display system frame must be an array or contain data/sitData/backData/headData');
}

/**
 * 按算法数据定义跑一遍声明式数值变换链。
 *
 * 这是 `algorithm.type === 'json'` 那条路的全部实现 —— 不写代码、只写 JSON 就能做
 * 缩放/偏移/限幅/阈值归零，是二开门槛最低的一层。
 *
 * 两条顺序约定都是**行为契约，改动会静默改掉所有既有配置的输出**：
 * 1. 扁平字段（`scale`/`offset`/`min`/`max`/`zeroBelow`）先被翻成 implicitOperations，
 *    **整体排在显式 `operations` 数组之前**。所以 JSON 里同时写了两种写法时，扁平的
 *    那几个先生效。
 * 2. implicit 之间的顺序固定为 缩放 → 偏移 → 限幅 → 阈值归零，**与 JSON 里键的书写
 *    顺序无关**（对象键序不该影响数值结果）。
 *
 * 每个操作用 `map` 产出新数组、不原地改：`values` 传进来时是 mapped 的那一份，而
 * mapped 之后还要作为 `normalizedData` 一起发出去（见 buildProcessedFrame）。就地
 * 修改会让 normalizedData 和 data 变成同一份被算法改过的数据。
 *
 * 未知的 `operation.type` 原样返回 `nextValues`（跳过）。合法类型的白名单在
 * displaySystemConfigFileValidator 的 `ALGORITHM_OPERATION_TYPES` 里，保存时就会
 * 被拒；这里不重复校验，只保证运行期不炸。
 *
 * @param {number[]} values 输入数值。
 * @param {object} [config] 算法数据定义（algorithm-data.json）。
 * @returns {number[]} 变换后的新数组。
 */
function applyNumericConfig(values, config = {}) {
  const operations = Array.isArray(config.operations) ? config.operations : [];
  const implicitOperations = [];

  if (typeof config.scale === 'number') implicitOperations.push({ type: 'scale', value: config.scale });
  if (typeof config.offset === 'number') implicitOperations.push({ type: 'offset', value: config.offset });
  if (typeof config.min === 'number' || typeof config.max === 'number') {
    implicitOperations.push({ type: 'clamp', min: config.min, max: config.max });
  }
  if (typeof config.zeroBelow === 'number') {
    implicitOperations.push({ type: 'zeroBelow', value: config.zeroBelow });
  }

  return [...implicitOperations, ...operations].reduce((nextValues, operation) => {
    if (operation.type === 'scale') {
      return nextValues.map((value) => value * Number(operation.value ?? 1));
    }
    if (operation.type === 'offset') {
      return nextValues.map((value) => value + Number(operation.value ?? 0));
    }
    if (operation.type === 'clamp') {
      const min = typeof operation.min === 'number' ? operation.min : -Infinity;
      const max = typeof operation.max === 'number' ? operation.max : Infinity;
      return nextValues.map((value) => Math.min(max, Math.max(min, value)));
    }
    if (operation.type === 'zeroBelow') {
      const threshold = Number(operation.value ?? 0);
      return nextValues.map((value) => (value < threshold ? 0 : value));
    }
    return nextValues;
  }, values);
}

/**
 * 解析实时帧里承载数据的字段名。
 *
 * sit/back/head/default 沿用旧的三个字段名，legacy 前端依赖它们。
 * 其余通道用 `${通道名}Data`，避免多个传感器在同一个 sitData 字段上互相覆盖。
 *
 * @param {string} outputChannel 输出通道名。
 * @returns {string} 字段名。
 */
function getChannelDataField(outputChannel) {
  if (outputChannel === 'back') return 'backData';
  if (outputChannel === 'head') return 'headData';
  if (outputChannel === 'sit' || outputChannel === 'default' || !outputChannel) return 'sitData';
  return `${outputChannel}Data`;
}

/**
 * 求一路通道的 canonical sensorId。
 *
 * canonical channelId 的形状是 `${displaySystemId}:${sensorId}`，而实时 WebSocket 的
 * 订阅键正是 `displaySystemId:sensorId` —— 所以这里必须还原出**恰好那一段**，取错
 * 前端就订阅不到自己那一路。
 *
 * 切出来的 sensorId 里还含 `:` 时判为不可信并走兜底：那说明 id 里有多余的分隔符，
 * 拿它拼订阅键会产生歧义（无法判断分界在哪一个冒号）。
 *
 * 兜底顺序 `sensorId` → `serialRole` → `sensor.id` 是按可信度排的，最后一档最不可信
 * —— 旧 builder 结构里 `sensor.id` 存的是**展示系统 id**（见 buildProcessedFrame 那处
 * 行内注释），只在实在没别的可用时才用。
 *
 * @param {object} [runtimeChannel] runtime channel plan。
 * @returns {string|undefined} sensorId；全都取不到时 undefined。
 */
function getCanonicalSensorId(runtimeChannel = {}) {
  const channelId = String(runtimeChannel.id || '').trim();
  const displaySystemId = String(runtimeChannel.displaySystemId || '').trim();
  const prefix = `${displaySystemId}:`;
  if (displaySystemId && channelId.startsWith(prefix)) {
    const sensorId = channelId.slice(prefix.length);
    if (sensorId && !sensorId.includes(':')) return sensorId;
  }
  return runtimeChannel.sensorId
    || runtimeChannel.serialRole
    || runtimeChannel.sensor?.id;
}

/**
 * 算四个内置压力指标（总和/最大/均值/非零点数）。
 *
 * 每帧都算、每帧都发，侧栏读数和两条曲线直接用它，所以三条防御都不是可选的：
 * - `filter(Number.isFinite)` 先剔掉 NaN/Infinity。一个 NaN 参与求和会让
 *   totalPressure 和 averagePressure 全变 NaN，侧栏四个数一起变空 —— 一个坏点污染
 *   整屏读数。
 * - 空数组时 `maxPressure` 给 0 而不是 `Math.max()` 的 `-Infinity`（后者会被
 *   JSON.stringify 变成 null，前端拿到 null 又是另一种现象）。
 * - `nonZeroCount` 用严格 `> 0`：负值（扣零之后可能出现）不计入「有压力的点」。
 *
 * ⚠️ `Math.max(...numeric)` 是展开调用，点数极大（十万级）时会撞栈上限。当前最大的
 * 矩阵是 4096 点，安全；真要支持更大的矩阵得改成 reduce。
 *
 * @param {Array<number|string>} values 数值数组（允许字符串，内部转 Number）。
 * @returns {{totalPressure: number, maxPressure: number, averagePressure: number,
 *   nonZeroCount: number}} 指标对象。
 */
function buildPressureMetrics(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  const totalPressure = numeric.reduce((sum, value) => sum + value, 0);
  return {
    totalPressure,
    maxPressure: numeric.length ? Math.max(...numeric) : 0,
    averagePressure: numeric.length ? totalPressure / numeric.length : 0,
    nonZeroCount: numeric.filter((value) => value > 0).length,
  };
}

/**
 * 按一条指标声明算出一个数。
 *
 * 这是 manifest 里 `algorithm-data.json` 的 `metrics[]` 的执行端，和
 * displaySystemConfigFileValidator 的 `ALGORITHM_METRIC_OPERATION_TYPES` 白名单一一
 * 对应 —— **新增一种聚合必须同时改两边**，只改这里保存时会被拒，只改那边运行时会
 * 静默落到 sum 分支。
 *
 * 未知 operation 落到 else 的 sum，和缺省值一致：宁可给一个可解释的和，也不要 NaN。
 *
 * `scale`/`offset` 用 `??` 而不是 `||`，所以 `scale: 0`（把这条指标压成常量偏移）和
 * `offset: 0` 都能如实生效。这两个在**聚合之后**才乘加，也就是「先聚合再线性变换」，
 * 不是对每个点先变换 —— 对 sum 两者结果不同，配置时要按这个语义写。
 *
 * `threshold` 只被 activeCount / activeRatio 用（严格大于），其余 operation 忽略它。
 *
 * @param {Array<number|string>} values 数值数组。
 * @param {object} [definition] 单条指标声明。
 * @returns {number} 指标值。
 */
function calculateConfiguredMetric(values, definition = {}) {
  const numeric = values.map(Number).filter(Number.isFinite);
  const operation = definition.operation || 'sum';
  const threshold = Number(definition.threshold || 0);
  let result = 0;

  if (operation === 'average') {
    result = numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
  } else if (operation === 'max') {
    result = numeric.length ? Math.max(...numeric) : 0;
  } else if (operation === 'min') {
    result = numeric.length ? Math.min(...numeric) : 0;
  } else if (operation === 'activeCount') {
    result = numeric.filter((value) => value > threshold).length;
  } else if (operation === 'activeRatio') {
    result = numeric.length
      ? numeric.filter((value) => value > threshold).length / numeric.length
      : 0;
  } else {
    result = numeric.reduce((sum, value) => sum + value, 0);
  }

  return result * Number(definition.scale ?? 1) + Number(definition.offset ?? 0);
}

/**
 * 批量算出所有声明式指标，得到 `{id: 值}`。
 *
 * 两条过滤：
 * - 没有 `id` 的跳过（`Object.fromEntries` 会把 undefined 键变成字符串 "undefined"，
 *   一条无名指标就会占掉这个键位）。
 * - **`operation === 'external'` 跳过**。external 的语义是「这条指标不由本地聚合算，
 *   由用户算法（js/python）返回」，它只是让指标在 manifest 里被声明出来供前端展示。
 *   在这里算它等于用错误的本地值覆盖算法的真值。
 *
 * @param {Array<number|string>} values 数值数组。
 * @param {object[]} [definitions] 指标声明列表。
 * @returns {Record<string, number>} 指标字典。
 */
function calculateConfiguredMetrics(values, definitions = []) {
  return Object.fromEntries(
    (Array.isArray(definitions) ? definitions : [])
      .filter((definition) => definition?.id && definition.operation !== 'external')
      .map((definition) => [definition.id, calculateConfiguredMetric(values, definition)]),
  );
}

/**
 * 过滤用户算法返回的 metrics —— **这是用户代码到实时链路的信任边界**。
 *
 * 上游是 js/python 算法，也就是二开者自己写的代码，返回值不可预期。它的输出会直接
 * 进入 WebSocket payload 发给所有订阅者，所以这里只放行两类东西：
 * - 键必须匹配 `/^[A-Za-z][A-Za-z0-9._-]*$/`（与校验器的 `SAFE_METRIC_ID` 同一条
 *   规则，两处各写一份是因为一处在保存时、一处在运行时，运行期不能依赖「保存时校验
 *   过」—— 算法是代码，它可以返回任何键）。这条规则同时排除了 `__proto__` 这类键。
 * - 值只允许**有限**数字、字符串、布尔。挡掉的具体是：NaN/Infinity（JSON.stringify
 *   会变成 null，前端曲线断点）、对象和数组（体积不可控，一帧几十毫秒一发）、
 *   函数和 undefined（序列化后直接消失，看起来像指标丢了）。
 *
 * 不合法的项**静默丢弃**而不是报错：一条指标写错不该让整帧数据发不出去。代价是算法
 * 作者可能纳闷「我返回了指标怎么没出来」—— 排查时先核对键名和值类型这两条。
 *
 * @param {*} metrics 算法返回的 metrics（任意值）。
 * @returns {Record<string, number|string|boolean>} 过滤后的指标；非对象输入返回 {}。
 */
function sanitizeAlgorithmMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return {};
  return Object.fromEntries(Object.entries(metrics).filter(([key, value]) => (
    /^[A-Za-z][A-Za-z0-9._-]*$/.test(key)
    && (
      (typeof value === 'number' && Number.isFinite(value))
      || typeof value === 'string'
      || typeof value === 'boolean'
    )
  )));
}

/**
 * 把用户算法的返回值归一成 `{data, metrics}`。
 *
 * 允许三种写法，从简到繁：裸数组（最常见，只改数据）、`{data}` 或 `{values}`（两个
 * 键名都收，历史上两种都写过）、`{metrics}` 而不带数据（只算指标、不改画面 —— 这种
 * 情况 `data` 退回 `fallbackValues`，也就是算法执行前那份，画面照常显示）。
 *
 * 其余一律**抛错**。返回一个字符串或数字通常是算法里漏了 return 的结果，静默兜底会
 * 让画面停在旧值上，看起来像串口断了。
 *
 * `Array.from(data)` 是必须的拷贝：算法返回的数组可能是它自己持有的长期引用（模块级
 * 缓冲区是算法作者常见的写法），不拷贝就等于把实时 payload 的内容交给用户代码在下一
 * 帧随手改掉。
 *
 * @param {*} result 算法返回值。
 * @param {number[]} fallbackValues 算法执行前的数据，用于只返回 metrics 的情形。
 * @returns {{data: number[], metrics: Record<string, number|string|boolean>}} 归一结果。
 * @throws {Error} 返回值既不是数组也不是对象。
 */
function normalizeAlgorithmResult(result, fallbackValues) {
  if (Array.isArray(result)) return { data: result, metrics: {} };
  if (!result || typeof result !== 'object') {
    throw new Error('display system algorithm must return an array or { data, metrics }');
  }
  const data = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.values)
      ? result.values
      : fallbackValues;
  return {
    data: Array.from(data),
    metrics: sanitizeAlgorithmMetrics(result.metrics),
  };
}

/**
 * 执行一路通道的算法，返回 `{data, metrics}`。
 *
 * 三条互斥的路：
 * 1. 未启用或 `type === 'none'` → 原样透传（**同一个数组引用**，不拷贝，热路径上每帧
 *    都走这里，绝大多数展示系统没有算法）。
 * 2. `type === 'json'` → 声明式路径，本模块自己实现（applyNumericConfig +
 *    calculateConfiguredMetrics），不涉及任何用户代码执行。
 * 3. 其余（js/python）→ 查注入的 runner。
 *
 * **runner 没注册时抛错而不是透传**：透传的现象是「算法配了但看不出效果」，是最难查
 * 的一类；抛错会被上层按帧捕获并记进丢帧统计，能定位到「哪一路的哪种 runner 缺了」。
 *
 * 传给用户代码的 `rawData` 和 `normalizedData` 都是 `[...]` 拷贝，而且 `rawData` 拷了
 * **两份**（位置参数一份、context 里一份）—— 用户改了哪一份都不影响另一份，也不影响
 * 本函数之后要用到的原数组。这点和 normalizeAlgorithmResult 的拷贝是同一个理由：跨过
 * 用户代码边界的数据不共享引用。
 *
 * 返回值可能是 Promise（python runner 是异步的），这里用 thenable 探测而不是
 * `async`/`await`：同步路径必须保持同步返回，否则每帧都要多排一次微任务，而调用方
 * processFrame 也是按这个双形态设计的。
 *
 * @param {number[]} values 已完成线序/点位映射的数据。
 * @param {object} algorithm 通道的算法绑定（type/enabled/entry/timeoutMs）。
 * @param {object|null} algorithmData 算法数据定义（json 路径用）。
 * @param {Record<string, Function>} [algorithmRunners] 按 type 注册的执行器。
 * @param {{rawData?: number[], matrix?: object|null}} [executionContext] 执行上下文。
 * @returns {{data: number[], metrics: object}|Promise<{data: number[], metrics: object}>} 结果。
 * @throws {Error} 对应 type 的 runner 未注册。
 */
function executeAlgorithmResult(
  values,
  algorithm,
  algorithmData,
  algorithmRunners = {},
  executionContext = {},
) {
  const type = algorithm?.type || 'none';
  if (!algorithm?.enabled || type === 'none') return { data: values, metrics: {} };
  if (type === 'json') {
    const data = applyNumericConfig(values, algorithmData || {});
    return {
      data,
      metrics: calculateConfiguredMetrics(data, algorithmData?.metrics),
    };
  }

  const runner = algorithmRunners[type];
  if (typeof runner !== 'function') {
    throw new Error(`display system algorithm runner is not registered: ${type}`);
  }
  const rawData = Array.isArray(executionContext.rawData)
    ? executionContext.rawData
    : values;
  const result = runner([...rawData], {
    algorithm,
    data: algorithmData,
    rawData: [...rawData],
    normalizedData: [...values],
    matrix: executionContext.matrix || null,
  });
  if (result && typeof result.then === 'function') {
    return result.then((resolved) => normalizeAlgorithmResult(resolved, values));
  }
  return normalizeAlgorithmResult(result, values);
}

/**
 * executeAlgorithmResult 的「只要数据」旧签名包装。
 *
 * 在 metrics 出现之前，算法只改数据，这就是当时的入口。现在**本仓已无调用方**（只在
 * module.exports 里导出），保留纯粹是为了不破坏可能引用它的二开代码 —— 属于公开面，
 * 删它是 breaking change。
 *
 * ⚠️ 两条限制，用它之前要知道：
 * - **丢掉 metrics**，指标一个都拿不到。
 * - **不 await**。同步 runner（js）正常；异步 runner（python）会返回
 *   `Promise.data`，也就是 `undefined`。要支持异步就直接用 executeAlgorithmResult。
 *
 * @param {number[]} values 输入数据。
 * @param {object} algorithm 算法绑定。
 * @param {object|null} algorithmData 算法数据定义。
 * @param {Record<string, Function>} [algorithmRunners] 执行器表。
 * @returns {number[]|undefined} 算法输出数据；异步 runner 下为 undefined。
 */
function executeAlgorithm(values, algorithm, algorithmData, algorithmRunners = {}) {
  return executeAlgorithmResult(values, algorithm, algorithmData, algorithmRunners).data;
}

/**
 * 创建 Display System 通用帧处理器。
 *
 * 处理器按 manifest 生成的 runtime channel plan 读取 JSON 配置：
 * line-order.json 决定原始值顺序，point-order.json 决定展示矩阵落点，
 * algorithm-data.json 只承载可配置的数值后处理，不再为每个传感器写死函数。
 *
 * @param {object} options 创建参数。
 * @param {object} options.runtimeChannel runtime channel plan。
 * @param {object} [options.fsLike] 文件系统适配器，测试可注入。
 * @param {object} [options.zeroStateStore] 按 channelId 隔离的零点状态仓库。
 * @returns {{ processFrame: Function }} 帧处理器。
 */
function createDisplaySystemFrameProcessor({
  runtimeChannel,
  fsLike = fs,
  algorithmRunners = {},
  zeroStateStore = null,
}) {
  if (!runtimeChannel) {
    throw new Error('runtimeChannel is required');
  }

  let cachedLineOrder;
  let cachedPointOrder;
  let cachedAlgorithmData;
  let droppedFrames = 0;
  let lastDropReason = null;
  const resolvedAlgorithmRunners = { ...algorithmRunners };
  const algorithmBinding = runtimeChannel.processing?.algorithm || {};
  if (
    algorithmBinding.type === 'js'
    && !resolvedAlgorithmRunners.js
    && algorithmBinding.entry
  ) {
    resolvedAlgorithmRunners.js = createJavaScriptAlgorithmRunner({
      entry: algorithmBinding.entry,
      timeoutMs: algorithmBinding.timeoutMs,
      fsLike,
    });
  }
  if (
    algorithmBinding.type === 'python'
    && !resolvedAlgorithmRunners.python
    && algorithmBinding.entry
  ) {
    resolvedAlgorithmRunners.python = createPythonAlgorithmRunner({
      entry: algorithmBinding.entry,
      timeoutMs: algorithmBinding.timeoutMs,
    });
  }

  /**
   * 取线序定义，首次读盘后缓存在处理器实例上。
   *
   * 三个 getter 共用同一套缓存约定，写在这里一次：
   * - 判 `!== undefined` 而不是判真值。这样 `null`（文件未声明）也算「已缓存」，
   *   否则每帧都会重跑一次 loadOptionalJson。以 30Hz 计，每秒三次无谓调用。
   * - **懒加载而不是构造时读**：处理器是在绑定时按通道批量创建的，此时不该为一个可能
   *   永远不收帧的通道去读盘。
   * - **缓存不失效**。文件改了必须重建处理器才生效 —— 这正是所有写路径保存后都调
   *   `reloadDisplaySystems()`（重新发现 + 重新绑定）的原因：重新绑定会造出新的处理器，
   *   于是缓存自然作废。改成带失效的缓存反而会掩盖「保存了没重绑」这个真问题。
   *
   * @returns {object|null} 线序定义；未声明为 null。
   */
  function getLineOrderDefinition() {
    if (cachedLineOrder !== undefined) return cachedLineOrder;
    cachedLineOrder = loadOptionalJson(runtimeChannel.processing?.lineOrder?.source, fsLike);
    return cachedLineOrder;
  }

  /**
   * 取点位表定义，缓存约定同 getLineOrderDefinition。
   *
   * @returns {object|null} 点位表定义；未声明为 null。
   */
  function getPointOrderDefinition() {
    if (cachedPointOrder !== undefined) return cachedPointOrder;
    cachedPointOrder = loadOptionalJson(runtimeChannel.processing?.pointOrder?.source, fsLike);
    return cachedPointOrder;
  }

  /**
   * 取算法数据定义，缓存约定同 getLineOrderDefinition。
   *
   * 这一份是真正可选的（没算法的展示系统就没有 dataFile），也是 `!== undefined` 判定
   * 最划算的一处 —— 大多数通道这里恒为 null。
   *
   * @returns {object|null} 算法数据定义；未声明为 null。
   */
  function getAlgorithmData() {
    if (cachedAlgorithmData !== undefined) return cachedAlgorithmData;
    cachedAlgorithmData = loadOptionalJson(runtimeChannel.processing?.algorithm?.dataFile, fsLike);
    return cachedAlgorithmData;
  }

  /**
   * 处理一帧：取值 → 校验 → 解码 → 线序/点位映射 → 算法 → 扣零 → 组装输出。
   *
   * 这是整条实时链路的核心一步，顺序本身就是设计：
   * - **校验在解码之前**。帧头或校验和不对的帧，其字节位置本来就不可信，解码它只会
   *   产出一屏看似合理的错值。丢帧不抛错，而是返回一个带 `dropped: true` 的独立形状，
   *   携带累计 `droppedFrames` 与 `lastDropReason` —— 通信质量是可观测量，不是异常。
   * - **算法在扣零之前**。算法看到的是「设备原始物理量」，零点是展示侧的偏置；反过来
   *   会让算法的阈值随用户何时按了归零而漂移。
   *
   * 返回值是同步对象或 Promise（跟随算法 runner），调用方必须两种都处理。
   *
   * @param {Array|object} frame 原始帧。
   * @returns {object|Promise<object>} 处理后的帧，或丢帧结果。
   */
  function processFrame(frame) {
    const frameValues = getFrameValues(frame);

    // 帧校验在解码之前：帧头或校验和不对的帧直接丢弃，不进入线序映射和算法。
    // 未声明 protocol.validation 时 validateFrame 恒为 ok，既有 manifest 无影响。
    if (runtimeChannel.protocol) {
      const frameValidation = validateFrame(frameValues, runtimeChannel.protocol);
      if (!frameValidation.ok) {
        droppedFrames += 1;
        lastDropReason = frameValidation.detail || frameValidation.reason;
        return {
          channelId: runtimeChannel.id,
          displaySystemId: runtimeChannel.displaySystemId,
          runtimeSource: 'display-system',
          outputChannel: runtimeChannel.outputChannel || runtimeChannel.serialRole,
          dropped: true,
          dropReason: frameValidation.reason,
          dropDetail: frameValidation.detail || null,
          metrics: { droppedFrames, lastDropReason },
        };
      }
    }

    const values = runtimeChannel.protocol
      ? decodeProtocolValues(frameValues, runtimeChannel.protocol)
      : frameValues;
    const mapped = executeConfiguredMapping(values, {
      lineOrder: getLineOrderDefinition(),
      pointOrder: getPointOrderDefinition(),
    });
    const algorithmData = getAlgorithmData();
    const algorithmResultOrPromise = executeAlgorithmResult(
      mapped,
      runtimeChannel.processing?.algorithm,
      algorithmData,
      resolvedAlgorithmRunners,
      {
        rawData: values,
        matrix: runtimeChannel.display?.matrix || runtimeChannel.sensor?.matrix || null,
      },
    );

    /**
     * 拿到算法结果后组装最终 payload。
     *
     * 抽成独立闭包是为了让同步和异步两条路（算法可能返回 Promise）共用同一段组装逻辑
     * —— 两边各写一份必然漂移。
     *
     * 输出里有三处刻意的冗余，都不能省：
     * - `data` 与 `[channelDataField]` 是**同一份数据的两个键**。前者是新链路，后者是
     *   legacy 前端认的 `sitData`/`backData`/... 字段名（见 getChannelDataField）。
     * - `rawData` / `normalizedData` / `data` 三级都发：三种展示形式分别取不同的一级
     *   （裸数据视图要 rawData，热力图要 data），也是「画面不对时对着哪一级出错」的
     *   唯一诊断依据。
     * - `metrics` 里的算法指标嵌在 `.algorithm` 下、且**只在非空时才嵌**：内置压力指标
     *   的键名是固定的，用户算法可以返回任意键名，不隔开就有互相覆盖的可能；空时不嵌
     *   是为了让前端 `metrics.algorithm` 的存在性直接等于「这一路有算法指标」。
     *   `algorithmMetrics` 顶层再发一份是给不想穿透 metrics 的消费者。
     *
     * @param {{data: number[], metrics: object}} algorithmResult 算法结果。
     * @returns {object} 实时 payload。
     */
    const buildProcessedFrame = (algorithmResult) => {
      const outputChannel = runtimeChannel.outputChannel || runtimeChannel.serialRole;
      const channelDataField = getChannelDataField(outputChannel);
      const processedSource = Array.from(algorithmResult.data);
      const identity = {
        channelId: runtimeChannel.id,
        displaySystemId: runtimeChannel.displaySystemId,
        // sensorDefinition.id 在旧 builder 结构中是展示系统 ID，不是
        // runtime channel 的 sensorId。以 canonical channelId 后半段为准。
        sensorId: getCanonicalSensorId(runtimeChannel),
        sensorType: runtimeChannel.sensor?.type
          || runtimeChannel.parserChannel?.sensorType
          || null,
        outputChannel,
      };

      // 零点源始终记录算法完成、尚未扣零的帧。这里没有独立的 mapped 输出，
      // 因此只记录 decoded / normalized / processed，避免把 normalized 基准
      // 当成 mapped 基准后在兼容链路里重复扣零。
      if (typeof zeroStateStore?.updateSources === 'function') {
        zeroStateStore.updateSources(runtimeChannel.id, {
          decoded: values,
          normalized: mapped,
          processed: processedSource,
        }, identity);
      }

      let processed = processedSource;
      if (typeof zeroStateStore?.apply === 'function') {
        const zeroed = zeroStateStore.apply(
          runtimeChannel.id,
          'processed',
          [...processedSource],
        );
        // 仓库在基准长度不匹配时应返回原帧；处理器再做一层边界保护，
        // 防止错误长度污染实时 payload 和压力指标。
        if (Array.isArray(zeroed) && zeroed.length === processedSource.length) {
          processed = Array.from(zeroed);
        }
      }

      return {
        channelId: runtimeChannel.id,
        displaySystemId: runtimeChannel.displaySystemId,
        runtimeSource: 'display-system',
        outputChannel,
        rawData: values,
        normalizedData: mapped,
        data: processed,
        [channelDataField]: processed,
        metrics: Object.keys(algorithmResult.metrics).length
          ? { ...buildPressureMetrics(processed), algorithm: algorithmResult.metrics }
          : buildPressureMetrics(processed),
        algorithmMetrics: algorithmResult.metrics,
        metadata: runtimeChannel.display,
      };
    };
    return algorithmResultOrPromise && typeof algorithmResultOrPromise.then === 'function'
      ? algorithmResultOrPromise.then(buildProcessedFrame)
      : buildProcessedFrame(algorithmResultOrPromise);
  }

  return {
    processFrame,
  };
}

module.exports = {
  applyNumericConfig,
  buildPressureMetrics,
  calculateConfiguredMetric,
  calculateConfiguredMetrics,
  createDisplaySystemFrameProcessor,
  executeAlgorithm,
  executeAlgorithmResult,
  getChannelDataField,
  getFrameValues,
  normalizeAlgorithmResult,
  sanitizeAlgorithmMetrics,
};
