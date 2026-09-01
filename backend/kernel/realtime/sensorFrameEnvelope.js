/**
 * WebSocket 传感器帧信封的唯一构造处。
 *
 * **后端与所有前端之间唯一的实时数据线格式**，位于「存储之后、发送之前」，所以改这里不影响串口
 * 协议、线序表、算法和历史数据格式；反过来，前端拿到的每个字段都只能从这里来。
 *
 * ⚠️ **输出是白名单投影**：无论传进来的是 legacy 帧（顶层一堆 `sitData`/`newArr147` 之类历史字段）
 * 还是已成形的 `sensor.frame`，输出都重新拼成固定形状 —— 旧字段无法夹带上线，否则二开者会依赖上
 * 一个下一版就消失的字段，而后端根本不知道它被用了。
 *
 * ⚠️ **未知阶段返回 null 而不是猜**：`stages.decoded/normalized/calibrated` 缺就是 null，绝不把
 * 「算完的结果」冒充成原始数据 —— 拿 raw 去做自己算法时收到一份已处理数据是最难发现的错误。
 */

const { multiSensorStableContract } = require('@shroom/backend/contract');
const { resolveSensorIdentity } = require('@shroom/backend/identity');

// 线格式的类型标签与版本号由共享稳定契约提供。升版必须新建契约版本，不能在 v1 上改语义。
const SENSOR_FRAME_TYPE = multiSensorStableContract.frame.type;
const SENSOR_FRAME_SCHEMA_VERSION = multiSensorStableContract.frame.schemaVersion;

/**
 * 把入参归一成一个帧对象：已经是对象就直接用，是 JSON 字符串/Buffer 就解析。
 *
 * 调用方形态不一是历史原因（采集链路里有的传对象，有的早就 `JSON.stringify` 过了），在这里统一比
 * 让每个调用点各自判断少出错。解析分支额外挡掉数组 —— 顶层是数组的 JSON 不可能是帧。
 *
 * ⚠️ `!Buffer.isBuffer` 不能省：Buffer 的 `typeof` 也是 `'object'`，不排除就会把二进制帧当帧对象
 * 往下传、所有字段读成 undefined 而**不报错**，现象是「帧被静默丢弃」。排除后它落到
 * `String(payload)`（Buffer 默认按 utf8 转），正是想要的。
 *
 * @param {object|string|Buffer} payload 原始帧数据。
 * @returns {object|null} 帧对象；无法解析或不是对象时 null。
 */
function parseFramePayload(payload) {
  if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
    return payload;
  }
  try {
    const parsed = JSON.parse(String(payload));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 把一个字段转成数字数组，转不了返回 null。
 *
 * 同样接受 JSON 字符串：历史字段里有一批是以字符串形式存的（尤其从数据库回放时）。
 *
 * 非数字元素显式写成 null。这样内存 ChannelBus 与 JSON WebSocket 看到的是同一份值，
 * 不再依赖 JSON.stringify 把 NaN 隐式改成 null；单点损坏也不会导致整帧丢弃。
 *
 * @param {*} value 原始字段值（数组或数组的 JSON 字符串）。
 * @returns {number[]|null} 数字数组；不是数组时 null。
 */
function toNumericArray(value) {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(candidate)) return null;
  return candidate.map((item) => {
    const numeric = Number(item);
    return Number.isFinite(numeric) ? numeric : null;
  });
}

/**
 * 依次尝试若干候选字段，取第一个能转成数字数组的。
 *
 * **参数顺序就是优先级**，这是整个 legacy 映射的核心机制：同一份数据在不同型号里叫
 * `data` / `sitData` / `pressureData` / `value`，谁在前面谁赢。所以调整下面
 * `firstArray(...)` 各处的参数顺序会**改变前端看到的数据**，不是无害的整理。
 *
 * ⚠️ 空数组 `[]` 也算「转成功」并直接胜出，后面的候选不会再试。真出现这种情况说明上游
 * 给了个空帧，此时输出一个空的 `value` 比悄悄用另一个字段的数据更诚实 —— 后者会让
 * 「上游坏了」表现成「数据看着对但对不上」。
 *
 * @param {...*} values 候选字段值，按优先级排列。
 * @returns {number[]|null} 第一个成功转换的数组；全部失败时 null。
 */
function firstArray(...values) {
  for (const value of values) {
    const array = toNumericArray(value);
    if (array) return array;
  }
  return null;
}

/**
 * 把 legacy 自动生成的兜底标识清洗成只含 `A-Za-z0-9._-` 的安全形式。
 *
 * 它只用在旧帧没提供任何身份字段时，从 sensorType/outputChannel 生成兼容兜底。
 * 调用方显式提供的 channelId/displaySystemId/sensorId 不会经过这个函数改写，
 * 而是交给 `@shroom/backend/identity` 严格校验，冲突或多冒号直接丢帧。
 *
 * 连续非法字符压成一个 `-`（而不是逐字符替换）：避免「传感器 A」这种名字变成一串横线。
 *
 * 洗完为空时回落到 `fallback`（通常是 `'sensor'`/`'legacy'`）：宁可用一个通用名字，
 * 也不要让 channelId 出现空段 —— 空段会让订阅字符串变成 `:sit` 这种前端匹配不上的形状。
 *
 * @param {*} value 原始标识片段。
 * @param {string} fallback 清洗结果为空时的兜底值。
 * @returns {string} 安全的标识片段。
 */
function normalizeIdentityPart(value, fallback) {
  const normalized = String(value || fallback || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized || fallback;
}

/**
 * 给一个通道名找它在 legacy 帧里对应的数据字段名。
 *
 * 这四个字段名是老前端约定的（`sitData`/`backData`/`headData`/`sensorData`），
 * 不是这里能改的 —— 数据库里存的历史帧也是这套字段，改名会让历史回放读不出数据。
 *
 * **默认回落到 `sitData`** 而不是返回 null：sit 是主压力通道，绝大多数型号只有它，
 * 而且 `${channel}Data` 那条动态规则（见调用处）已经先试过一次了，这里是最后兜底。
 *
 * @param {string} channel 输出通道名。
 * @returns {string} legacy 数据字段名。
 */
function getLegacyDataField(channel) {
  if (channel === 'back') return 'backData';
  if (channel === 'head') return 'headData';
  if (channel === 'sensor') return 'sensorData';
  return 'sitData';
}

/**
 * 解析矩阵尺寸，顺便算出 `total`。
 *
 * 三个来源按优先级：`metadata.matrix`（manifest 路径）→ `matrix`（已成形帧）→
 * 顶层 `matrixHeight`/`matrixWidth`（legacy 字段）。
 *
 * 校验是**正整数**而不是「有值就行」：前端拿这个尺寸去分配纹理/画网格，
 * 一个 0 或小数会让渲染器要么画空白要么抛在 WebGL 里 —— 那时候错误现场离这里很远。
 * 宁可返回 null（前端有「尺寸未知」的分支），也不要送一个坏尺寸出去。
 *
 * `total` 在这里算好而不是让前端乘：它被多个渲染器和曲线组件用到，
 * 算一次比每处各算一次少一个出错点。
 *
 * @param {object} [data] 帧数据。
 * @returns {{rows: number, cols: number, total: number}|null} 矩阵尺寸；不可用时 null。
 */
function extractMatrix(data = {}) {
  const source = data.metadata?.matrix || data.matrix || null;
  const rows = Number(source?.rows ?? data.matrixHeight);
  const cols = Number(source?.cols ?? data.matrixWidth);
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
    return null;
  }
  return { rows, cols, total: rows * cols };
}

/**
 * 去掉对象里所有 undefined/null 的键；**全空时返回 null 而不是 `{}`**。
 *
 * 返回 null 的那一条是关键：`status`/`temperature`/`protocol`/`history` 这四段都是
 * **可选**的，前端按 `if (payload.status)` 判断「这个型号有没有这类信息」。返回 `{}` 会
 * 让判断为真，前端于是去读里面的字段并全部拿到 undefined —— 现象是界面上多出一块空的
 * 状态区。返回 null 让「没有」这件事在线格式上是显式的。
 *
 * 同时它也在压缩线格式：这些字段大多数型号都用不上，每帧带四个空对象在 20~125ms 的
 * 帧率下是纯浪费。
 *
 * @param {Record<string, *>} value 待压缩的对象。
 * @returns {object|null} 压缩后的新对象；没有任何有效键时 null。
 */
function compactObject(value) {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null);
  return entries.length ? Object.fromEntries(entries) : null;
}

/**
 * 将回放诊断信息投影为稳定 history 契约。
 *
 * 回放服务已经按时间戳计算 `sourceIndex/alignedAt/skewMs`，这里是 WebSocket 白名单
 * 的最后出口，必须显式保留它们；同时丢弃未登记字段，避免调用方绕过冻结契约扩散私有键。
 */
function normalizeHistoryMetadata(history = {}, fallback = {}) {
  const declared = history && typeof history === 'object' && !Array.isArray(history)
    ? history
    : {};
  return compactObject({
    index: declared.index ?? fallback.index,
    sourceIndex: declared.sourceIndex ?? fallback.sourceIndex,
    recordedAt: declared.recordedAt ?? fallback.recordedAt,
    alignedAt: declared.alignedAt ?? fallback.alignedAt,
    skewMs: declared.skewMs ?? fallback.skewMs,
  });
}

/**
 * 将运行时串口状态投影为可安全下发的稳定字段。
 * channelId 用于长期寻址；path/状态只代表当前连接快照，二者不能互相替代。
 *
 * @param {object} data 内部帧或已成形的 sensor.frame。
 * @returns {object|null} 串口快照；没有串口信息时为 null。
 */
function normalizeSerialMetadata(data = {}) {
  const serial = data.serial && typeof data.serial === 'object' ? data.serial : {};
  const rawParser = serial.parserChannel ?? data.parserChannel;
  const parserChannel = rawParser && typeof rawParser === 'object'
    ? (rawParser.id || rawParser.role || null)
    : rawParser;
  const baudRate = Number(serial.baudRate ?? data.baudRate);
  const openedAt = Number(serial.openedAt);

  return compactObject({
    role: serial.role || data.serialRole,
    portId: serial.portId || data.portId,
    path: serial.path || data.serialPortPath,
    baudRate: Number.isFinite(baudRate) && baudRate > 0 ? baudRate : undefined,
    parserChannel: parserChannel == null ? undefined : String(parserChannel),
    status: typeof serial.status === 'string' ? serial.status : undefined,
    isOpen: typeof serial.isOpen === 'boolean' ? serial.isOpen : undefined,
    openedAt: Number.isFinite(openedAt) && openedAt > 0 ? openedAt : undefined,
  });
}

/**
 * 把内部 legacy/manifest 帧转成唯一的 WebSocket 传感器帧契约（v1 信封）。
 *
 * 分两支但出口形状完全相同：入参已是 `sensor.frame` v1 时仍逐字段重投影一遍（这是白名单
 * 生效的地方 —— 调用方在成形帧上顺手挂的顶层字段会在这里被丢掉）；是 legacy 帧时按各处
 * `firstArray` 的参数顺序映射到五个 stage 与四个可选段。
 *
 * `timestamp` 优先级是「调用方显式传的 > 帧自带的 > `Date.now()`」：回放历史必须用帧里的
 * 原始时间，否则前端曲线的横轴会变成回放时刻。`sequence` 由调用方递增维护，本模块是无状态
 * 纯函数（无状态是它能被测试和被复用的前提）。
 *
 * ⚠️ **返回 null 表示「这一帧不发」而不是出错**（解析不出对象 / 没有通道标识 / 找不到任何
 * 数据数组）：采集期出现空帧是常态（串口刚打开、算法还没就绪），调用方直接跳过即可。
 *
 * @param {object} options 参数。
 * @param {string} options.channel 通道名（legacy 路径用作 outputChannel 兜底）。
 * @param {object|string|Buffer} options.payload 原始帧。
 * @param {string} options.sensorType 当前传感器型号，帧里没带时用它。
 * @param {string} [options.source='realtime'] 数据来源标记（realtime/playback 等）。
 * @param {number} [options.sequence=0] 帧序号。
 * @param {number} [options.timestamp] 显式时间戳，优先于帧内时间。
 * @returns {object|null} `sensor.frame` v1 信封；这一帧不该发时 null。
 */
function buildSensorFrameEnvelope({
  channel,
  payload,
  sensorType,
  source = 'realtime',
  sequence = 0,
  timestamp,
} = {}) {
  const data = parseFramePayload(payload);
  if (!data) return null;
  if (data.type === SENSOR_FRAME_TYPE) {
    // 一旦声明为标准帧，就不能再降级走 legacy 猜字段。未知版本必须由显式适配器升级，
    // 否则这里把 v2 当 legacy 重投影成 v1，会掩盖真实的不兼容并污染稳定契约。
    if (data.schemaVersion !== SENSOR_FRAME_SCHEMA_VERSION) return null;

    const framePayload = data.payload && typeof data.payload === 'object'
      ? data.payload
      : {};
    const frameStages = framePayload.stages && typeof framePayload.stages === 'object'
      ? framePayload.stages
      : {};
    const value = firstArray(framePayload.value, frameStages.processed);
    const identity = resolveSensorIdentity({
      channelId: data.channelId,
      displaySystemId: data.displaySystemId,
      sensorId: data.sensorId,
    });
    if (!identity || !value) return null;

    const normalizedSensorType = normalizeIdentityPart(data.sensorType || sensorType, 'legacy');
    const hasDeclaredOutputChannel = data.outputChannel !== undefined
      && data.outputChannel !== null;
    if (
      hasDeclaredOutputChannel
      && (
        typeof data.outputChannel !== 'string'
        || !data.outputChannel.trim()
        || data.outputChannel !== data.outputChannel.trim()
      )
    ) {
      return null;
    }
    const outputChannel = hasDeclaredOutputChannel
      ? data.outputChannel
      : identity.sensorId;
    const resolvedTimestamp = Number(timestamp ?? data.timestamp);

    // 即使内部调用方已经传入 sensor.frame，也只投影白名单字段。
    // 这样顶层 sitData/*Data 等旧字段无法夹带到 WebSocket wire。
    return {
      type: SENSOR_FRAME_TYPE,
      schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
      ...identity,
      sensorLabel: String(data.sensorLabel || identity.sensorId).trim(),
      sensorType: normalizedSensorType,
      outputChannel,
      source: data.source || source,
      sequence: Number(sequence) || 0,
      timestamp: Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : Date.now(),
      quality: typeof data.quality === 'string' ? data.quality : 'good',
      serial: normalizeSerialMetadata(data),
      payload: {
        value,
        stages: {
          decoded: firstArray(frameStages.decoded),
          normalized: firstArray(frameStages.normalized),
          calibrated: firstArray(frameStages.calibrated),
          processed: firstArray(frameStages.processed),
          mapped: firstArray(frameStages.mapped),
        },
        metrics: framePayload.metrics && typeof framePayload.metrics === 'object'
          ? framePayload.metrics
          : {},
        algorithmMetrics: framePayload.algorithmMetrics
          && typeof framePayload.algorithmMetrics === 'object'
          ? framePayload.algorithmMetrics
          : {},
        matrix: extractMatrix({ matrix: framePayload.matrix }),
        orientation: firstArray(framePayload.orientation),
        status: framePayload.status && typeof framePayload.status === 'object'
          ? framePayload.status
          : null,
        temperature: framePayload.temperature && typeof framePayload.temperature === 'object'
          ? framePayload.temperature
          : null,
        protocol: framePayload.protocol && typeof framePayload.protocol === 'object'
          ? framePayload.protocol
          : null,
        history: normalizeHistoryMetadata(framePayload.history),
      },
    };
  }

  const outputChannel = String(data.outputChannel || channel || '').trim();
  if (!outputChannel) return null;
  const legacyDataField = getLegacyDataField(outputChannel);
  const dynamicDataField = `${outputChannel}Data`;
  const processed = firstArray(
    data.data,
    data[dynamicDataField],
    data[legacyDataField],
    data.pressureData,
    data.value,
  );
  const mapped = firstArray(data.mappedData, data.mappedArr195, data.newArr147, data.newArr);
  const value = processed || mapped;
  if (!value) return null;

  const normalizedSensorType = normalizeIdentityPart(
    data.sensorType || sensorType,
    'legacy',
  );
  const identity = String(data.channelId || '').trim()
    ? resolveSensorIdentity({
      channelId: data.channelId,
      displaySystemId: data.displaySystemId,
      sensorId: data.sensorId,
    }, { allowDerived: true })
    : resolveSensorIdentity({
      displaySystemId: data.displaySystemId || normalizedSensorType,
      sensorId: data.sensorId || normalizeIdentityPart(outputChannel, 'sensor'),
    }, { allowDerived: true });
  if (!identity) return null;
  const resolvedTimestamp = Number(timestamp ?? data.timestamp ?? data.time);

  const decoded = firstArray(data.rawData, data.realArr, data.rawSitData);
  const normalized = firstArray(data.normalizedData);
  const calibrated = firstArray(data.calibratedData, data.rawPressureData);
  const orientation = firstArray(data.orientation, data.rotate);
  const matrix = extractMatrix(data);
  const status = compactObject({
    primaryConnected: typeof data.sitFlag === 'boolean' ? data.sitFlag : undefined,
    secondaryConnected: typeof data.backFlag === 'boolean' ? data.backFlag : undefined,
    rateHz: Number.isFinite(Number(data.hz)) ? Number(data.hz) : undefined,
  });
  const temperature = compactObject({
    raw: firstArray(data.temperatureRawData),
    values: firstArray(data.temperatureData),
    average: Number.isFinite(Number(data.temperatureAvg)) ? Number(data.temperatureAvg) : undefined,
    coefficient: Number.isFinite(Number(data.temperatureK)) ? Number(data.temperatureK) : undefined,
    threshold: Number.isFinite(Number(data.pressureThreshold))
      ? Number(data.pressureThreshold)
      : undefined,
  });
  const protocol = compactObject({
    frameIndex: data.frameIndex,
    packetType: data.packetType,
    handSide: data.handSide,
    outputSide: data.outputSide,
    packetSourcePort: data.packetSourcePort,
  });
  const history = normalizeHistoryMetadata(data.history, {
    index: data.index,
    recordedAt: data.time,
  });

  return {
    type: SENSOR_FRAME_TYPE,
    schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
    ...identity,
    sensorLabel: String(data.sensorLabel || identity.sensorId).trim(),
    sensorType: normalizedSensorType,
    outputChannel,
    source,
    sequence: Number(sequence) || 0,
    timestamp: Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : Date.now(),
    quality: 'good',
    serial: normalizeSerialMetadata(data),
    payload: {
      value,
      stages: {
        decoded,
        normalized,
        calibrated,
        processed,
        mapped,
      },
      metrics: data.metrics && typeof data.metrics === 'object' ? data.metrics : {},
      algorithmMetrics: data.algorithmMetrics && typeof data.algorithmMetrics === 'object'
        ? data.algorithmMetrics
        : (data.metrics?.algorithm || {}),
      matrix,
      orientation,
      status,
      temperature,
      protocol,
      history,
    },
  };
}

module.exports = {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  buildSensorFrameEnvelope,
  normalizeHistoryMetadata,
  normalizeSerialMetadata,
  parseFramePayload,
  toNumericArray,
};
