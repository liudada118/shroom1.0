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
 * 三个 getter（线序/点位/算法数据）共用它，省掉各自的 `if (!path)`。
 * 返回 null 而不是抛错，因为 getter 的缓存写法要求「没有」也是一个可缓存的值。
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
 * 接受五种形状是迁移期的现实：新链路给裸数组或 `{data}`，`sitData`/`backData`/`headData`
 * 是旧前端留下的字段名（getChannelDataField 是同一组名字的反向）。
 *
 * ⚠️ 都不匹配时**抛错而不是返回 `[]`**：返回空数组会让画面变成一片零值、看起来像
 * 「传感器没压力」，是最难查的一类现象。抛错安全，因为绑定层的 handleFrame 对每帧单独
 * try/catch，一帧坏掉不停链路。
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
 * 缩放/偏移/限幅/阈值归零，是二开门槛最低的一层。未知 `operation.type` 跳过（白名单在
 * 校验器的 `ALGORITHM_OPERATION_TYPES`，保存时就拒了）。
 *
 * ⚠️ 两条顺序是**行为契约，改了会静默改掉所有既有配置的输出**：① 扁平字段
 * （`scale`/`offset`/`min`/`max`/`zeroBelow`）整体排在显式 `operations` 之前；
 * ② implicit 之间固定为 缩放 → 偏移 → 限幅 → 阈值归零，与 JSON 键序无关。
 *
 * 每步用 `map` 出新数组、不原地改 —— 传进来的 `values` 就是 mapped，之后还要作为
 * `normalizedData` 一起发出去（见 buildProcessedFrame）。
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
 * ⚠️ 实时 WebSocket 的订阅键就是 `displaySystemId:sensorId`，所以必须从 canonical
 * channelId（形状 `${displaySystemId}:${sensorId}`）里还原出**恰好那一段** —— 取错前端
 * 订阅不到自己那一路。切出来还含 `:` 判为不可信（分界在哪个冒号有歧义），走兜底。
 *
 * 兜底顺序 `sensorId` → `serialRole` → `sensor.id` 按可信度排；最后一档最不可信 ——
 * 旧 builder 结构里 `sensor.id` 存的是**展示系统 id**。
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
 * 每帧都算、每帧都发，侧栏读数和两条曲线直接用它，所以三条防御不可省：先
 * `filter(Number.isFinite)`（一个 NaN 会让 total/average 全变 NaN、侧栏四个数一起变空）；
 * 空数组时 `maxPressure` 给 0 而不是 `-Infinity`（后者被 JSON.stringify 变成 null）；
 * `nonZeroCount` 严格 `> 0`，扣零后的负值不算「有压力的点」。
 *
 * ⚠️ `Math.max(...numeric)` 是展开调用，十万级点数会撞栈上限。当前最大矩阵 4096 点安全，
 * 要支持更大的得改成 reduce。
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
 * ⚠️ 与校验器的 `ALGORITHM_METRIC_OPERATION_TYPES` 白名单一一对应，**新增一种聚合必须
 * 同时改两边**：只改这里保存时会被拒，只改那边运行时静默落到 sum。
 *
 * `scale`/`offset` 在**聚合之后**才乘加（先聚合再线性变换，对 sum 与逐点变换结果不同）；
 * 用 `??` 所以 `scale: 0` / `offset: 0` 如实生效。`threshold` 只被
 * activeCount / activeRatio 用（严格大于）。未知 operation 落到 sum，不给 NaN。
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
 * 两条过滤：没有 `id` 的跳过（否则 `Object.fromEntries` 把 undefined 键变成字符串
 * "undefined"，一条无名指标占掉这个键位）；⚠️ **`operation === 'external'` 跳过** ——
 * external 的语义是「由用户算法返回，这里只声明供前端展示」，算它等于用本地值覆盖真值。
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
 * 上游是二开者写的 js/python 算法，返回值不可预期，而输出直接进 WebSocket payload。
 * 键必须匹配 `/^[A-Za-z][A-Za-z0-9._-]*$/`（顺带排除 `__proto__`）；值只允许**有限**
 * 数字、字符串、布尔 —— 挡掉 NaN/Infinity（变 null，前端曲线断点）、对象数组（体积不可控，
 * 几十毫秒一发）、函数与 undefined（序列化后消失，像指标丢了）。
 *
 * 不合法的项**静默丢弃**，一条写错不该让整帧发不出去。代价是算法作者会纳闷「指标怎么
 * 没出来」—— 排查先核对键名和值类型。校验器的 `SAFE_METRIC_ID` 是同一条规则，但那是
 * 保存时，运行期不能依赖它（算法是代码，可以返回任何键）。
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
 * 允许三种写法：裸数组（最常见）、`{data}` 或 `{values}`（两个键名都收，历史上都写过）、
 * 只给 `{metrics}`（不改画面，`data` 退回 `fallbackValues`）。其余**抛错** —— 返回字符串
 * 或数字通常是漏了 return，静默兜底会让画面停在旧值、看起来像串口断了。
 *
 * `Array.from(data)` 的拷贝不能省：算法返回的可能是它自己持有的模块级缓冲区，不拷贝等于
 * 把实时 payload 的内容交给用户代码下一帧随手改掉。
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
 * 三条互斥的路：① 未启用或 `none` → 原样透传（**同一个数组引用**，不拷贝，热路径）；
 * ② `json` → 本模块的声明式实现，不执行用户代码；③ js/python → 查注入的 runner。
 *
 * ⚠️ **runner 没注册时抛错而不是透传**：透传的现象是「算法配了但看不出效果」，最难查；
 * 抛错会被上层按帧捕获记进丢帧统计，能定位到哪一路缺哪种 runner。
 *
 * 传给用户代码的 `rawData`（拷两份：位置参数 + context）和 `normalizedData` 全是拷贝 ——
 * 跨用户代码边界的数据不共享引用。返回值用 thenable 探测而不是 `async`，因为同步路径
 * 必须保持同步返回（否则每帧多排一次微任务），调用方 processFrame 按双形态设计。
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
 * **本仓已无调用方**，保留只为不破坏可能引用它的二开代码 —— 属于公开面，删它是
 * breaking change。
 *
 * ⚠️ 两条限制：**丢掉 metrics**；**不 await** —— 异步 runner（python）下取到的是
 * `Promise.data`，也就是 `undefined`。要支持异步就直接用 executeAlgorithmResult。
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
   * 三个 getter 共用同一套缓存约定，写在这里一次：判 `!== undefined` 而不是判真值，
   * 好让 `null`（未声明）也算已缓存，否则每帧重跑一次 loadOptionalJson；懒加载而不是
   * 构造时读，处理器是按通道批量创建的，不该为可能永远不收帧的通道读盘。
   *
   * ⚠️ **缓存不失效**，文件改了必须重建处理器 —— 这正是所有写路径保存后都调
   * `reloadDisplaySystems()`（重新发现 + 重新绑定造出新处理器）的原因。加失效逻辑反而会
   * 掩盖「保存了没重绑」这个真问题。
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
   * 最划算的一处：大多数通道这里恒为 null。
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
   * 返回值是同步对象或 Promise（跟随算法 runner），调用方必须两种都处理。
   *
   * ⚠️ 上面那个顺序本身就是设计，别调：**校验在解码之前**（帧头/校验和不对的帧字节位置
   * 本就不可信，解码只会产出一屏看似合理的错值）；**算法在扣零之前**（算法看到的是设备
   * 原始物理量，零点是展示侧偏置，反过来会让算法阈值随用户何时按归零而漂移）。
   * 丢帧不抛错，返回带 `dropped: true` 的独立形状 —— 通信质量是可观测量，不是异常。
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
     * 抽成闭包是为了让同步和异步两条路（算法可能返回 Promise）共用同一段组装逻辑。
     *
     * ⚠️ 输出里三处冗余都是刻意的，别精简：`data` 与 `[channelDataField]` 是同一份数据的
     * 两个键（后者是 legacy 前端认的 `sitData`/`backData`/…）；`rawData`/`normalizedData`/
     * `data` 三级都发，因为不同展示形式各取一级，也是「画面不对时是哪一级错」的唯一诊断
     * 依据；算法指标嵌在 `metrics.algorithm` 下**且只在非空时才嵌** —— 隔开是防用户算法的
     * 任意键名覆盖内置压力指标，空时不嵌是让前端用它的存在性判断「这一路有算法指标」。
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
        sensorId: identity.sensorId,
        sensorLabel: runtimeChannel.label || identity.sensorId,
        sensorType: identity.sensorType,
        runtimeSource: 'display-system',
        stored: runtimeChannel.stored !== false,
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
