const fs = require('fs');
const path = require('path');
const {
  validateDisplaySystemConfig,
} = require('../manifest/displaySystemConfigValidator');
const {
  validateAlgorithmDataDefinition,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
} = require('../manifest/displaySystemConfigFileValidator');
const {
  normalizePointDefinition,
} = require('@shroom/backend/processing/configMappingExecutor.js');
const {
  canonicalizeCoordinateMapDefinition,
  normalizeCoordinateMapDefinition,
  validateCoordinateMapDefinition,
} = require('../manifest/displaySystemCoordinateMap');
const {
  PROTOCOL_CHECKSUM_TYPES,
  PROTOCOL_VALUE_TYPES,
  PROTOCOL_VALUE_TYPE_WIDTHS,
} = require('@shroom/backend/protocol/displaySystemProtocol.js');
const {
  CANVAS_COLORMAPS,
  CANVAS_OVERLAYS,
  CHART_OVERLAYS,
  DISPLAY_CHART_CARD_LIMIT,
} = require('../manifest/displaySystemCanvasCatalog');
const {
  normalizeCanvasConfig,
  normalizeChartAppearanceConfig,
  normalizeChartCardsConfig,
  validateDisplayConfig,
} = require('../manifest/displaySystemPage');

const SAFE_DISPLAY_SYSTEM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BUILDER_ALGORITHM_TYPES = new Set(['none', 'json', 'js', 'python']);
const CODE_ALGORITHM_TYPES = new Set(['js', 'python']);

const DEFAULT_ALGORITHM_SOURCES = Object.freeze({
  js: `module.exports = function calculate(rawData, context) {
  // rawData: 串口解码后的原始一维数据。
  // context.normalizedData: 完成线序和点位映射后的矩阵数据。
  return {
    data: context.normalizedData,
    metrics: {},
  };
};
`,
  python: `def calculate(raw_data, context):
    # raw_data: 串口解码后的原始一维数据。
    # context["normalized_data"]: 完成线序和点位映射后的矩阵数据。
    return {
        "data": context["normalized_data"],
        "metrics": {},
    }
`,
});

/**
 * 按矩阵尺寸生成「恒等」的线序表和点位表。
 *
 * 新建传感器时用它垫底：用户还没有真实的线序/点位文件，但这两个文件是必填的
 * （见 displaySystemConfigValidator 的 `files.lineOrder is required`），没有它们
 * manifest 存下去就是不合法的。恒等映射的效果是「按行优先原样铺开」——出的图大概率
 * 不对，但**能出图**，用户可以先看到东西再去调线序，而不是先面对一个存不下去的表单。
 *
 * ⚠️ 两张表的基数不同，这里必须与两个校验器的约定严格对齐：
 * `lineOrder.order` 是 **1 基**（`index + 1`），`pointOrder.points` 是 **0 基**
 * （`[floor(i/cols), i%cols]`）。写错任一侧的表现是「新建的传感器一保存就报越界」。
 *
 * 尺寸为 0 时返回空的两张表（不抛错）：Builder 里矩阵尺寸是用户边填边算的，
 * 中间态很正常。
 *
 * @param {{rows?: number, cols?: number}} matrix 矩阵尺寸。
 * @returns {{lineOrder: {order: number[]}, pointOrder: {matrix: object, points: number[][]}}}
 *          恒等映射的两份定义。
 */
function createIdentityDefinitions(matrix) {
  const rows = Number(matrix?.rows || 0);
  const cols = Number(matrix?.cols || 0);
  const total = rows * cols;
  return {
    lineOrder: { order: Array.from({ length: total }, (_, index) => index + 1) },
    pointOrder: {
      matrix: { rows, cols },
      points: Array.from({ length: total }, (_, index) => [Math.floor(index / cols), index % cols]),
    },
  };
}

/**
 * 将用户提供的点位数据统一保存为带矩阵信息的标准结构。
 * 矩阵尺寸由点位坐标推导，避免 manifest 和点位文件分别维护尺寸。
 *
 * @param {object | number[][]} definition 原始点位定义。
 * @returns {{ matrix: { rows: number, cols: number }, points: number[][] }} 标准点位定义。
 */
function canonicalizePointDefinition(definition) {
  const normalized = normalizePointDefinition(definition);
  const extra = Array.isArray(definition) ? {} : { ...definition };
  delete extra.rows;
  delete extra.cols;
  delete extra.matrix;
  delete extra.points;
  return {
    ...extra,
    matrix: {
      ...(Array.isArray(definition) ? {} : definition.matrix),
      rows: normalized.rows,
      cols: normalized.cols,
    },
    points: normalized.points,
  };
}

/**
 * 写 JSON：先写临时文件再改名，避免读者读到写了一半的内容。
 *
 * 为什么要这么绕：保存展示系统会连写好几个文件（manifest、线序、点位、算法源码），
 * 而**写完立刻会触发 `reloadDisplaySystems()` 去重新扫描并解析这些文件**。直接
 * `writeFileSync` 覆盖原文件时，扫描可能正好读到半个 JSON，表现是「保存后展示系统
 * 短暂消失或报解析错」。先写 `.tmp-<pid>` 再 rename 让这个中间态不可见。
 *
 * ⚠️ 名字里的 atomic 只保证**内容**不会被读到半截，并不是完整的原子替换：
 * - 先 `unlinkSync` 再 `renameSync`，两步之间有一个「文件不存在」的窗口
 *   （读者此刻会当成没有这份配置）。删这一步是为了迁就 Windows 上 rename 覆盖
 *   已存在文件的行为差异，去掉它需要先在 Windows 上验。
 * - 没有 fsync，断电可能留下空文件或旧内容。
 * - 临时文件名只带 pid，同进程内并发写同一个文件会互相踩。目前保存是串行的
 *   HTTP 处理，不构成问题；要并发就得换成带随机后缀。
 *
 * 末尾补 `\n` 是为了文件对 diff 工具友好（用户的展示系统目录常被纳入版本管理）。
 *
 * @param {string} filePath 目标文件路径。
 * @param {*} value 要序列化的值。
 * @param {typeof fs} [fsLike=fs] 注入的 fs（测试用）。
 * @returns {void}
 */
function writeJsonAtomic(filePath, value, fsLike = fs) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fsLike.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (fsLike.existsSync(filePath)) fsLike.unlinkSync(filePath);
  fsLike.renameSync(temporaryPath, filePath);
}

/**
 * 写纯文本（算法源码）：同 `writeJsonAtomic` 的临时文件 + 改名策略，另加两处规范化。
 *
 * 1. **CRLF 一律转成 LF**。源码是从浏览器的 textarea 提交上来的，Windows 上很容易
 *    带 `\r\n`；而这些文件会被 Python 解释器读、也常被纳入版本管理。混用换行符
 *    会让 diff 显示成整文件改动，本仓为此专门做过一次 CRLF 清理，写入口就该统一。
 * 2. **保证以换行结尾**。Python 对缺末尾换行更敏感，diff 也会少一条
 *    「\ No newline at end of file」。
 *
 * `String(value || '')` 把 null/undefined 兜成空串：用户清空算法源码是合法操作，
 * 不该在这里抛错（内容是否必须非空由 `validateBuilderAlgorithmSource` 判断）。
 *
 * @param {string} filePath 目标文件路径。
 * @param {*} value 文本内容。
 * @param {typeof fs} [fsLike=fs] 注入的 fs（测试用）。
 * @returns {void}
 */
function writeTextAtomic(filePath, value, fsLike = fs) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  const text = String(value || '').replace(/\r\n/g, '\n');
  fsLike.writeFileSync(temporaryPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  if (fsLike.existsSync(filePath)) fsLike.unlinkSync(filePath);
  fsLike.renameSync(temporaryPath, filePath);
}

/**
 * 读 JSON；路径为空或文件不存在返回 null。
 *
 * 「不存在返回 null」是给编辑器读取路径用的：Builder 要能打开一个只写了一半的展示
 * 系统（比如声明了坐标映射但文件还没建），缺文件在编辑态是正常的，不该抛错。
 *
 * ⚠️ 但 **JSON 解析失败仍然会抛** —— 那是「文件在但内容坏了」，静默返回 null 会让
 * 用户在编辑器里看到一个空白的段，然后一保存就把原本坏但有内容的文件覆盖掉。
 * 抛出去让上层报错是有意的。
 *
 * @param {string|null} filePath 文件路径。
 * @param {typeof fs} [fsLike=fs] 注入的 fs（测试用）。
 * @returns {object|null} 解析结果；文件不存在为 null。
 */
function readJsonOptional(filePath, fsLike = fs) {
  if (!filePath || !fsLike.existsSync(filePath)) return null;
  return JSON.parse(fsLike.readFileSync(filePath, 'utf8'));
}

/**
 * 读纯文本（算法源码）；路径为空或文件不存在返回 null。
 *
 * 返回 **null 而不是空串**，好让编辑器能区分「没有算法文件」和「有一个空文件」——
 * 前者应显示默认模板（`DEFAULT_ALGORITHM_SOURCES`），后者应显示用户清空后的状态。
 * 兜成空串会让默认模板反复冒出来覆盖用户的意图。
 *
 * 读出来的内容不做换行规范化（写入侧才做）：显示时保持磁盘原样，避免编辑器一打开
 * 就显示成「有改动」。
 *
 * @param {string|null} filePath 文件路径。
 * @param {typeof fs} [fsLike=fs] 注入的 fs（测试用）。
 * @returns {string|null} 文件内容；文件不存在为 null。
 */
function readTextOptional(filePath, fsLike = fs) {
  if (!filePath || !fsLike.existsSync(filePath)) return null;
  return fsLike.readFileSync(filePath, 'utf8');
}

/**
 * 检查 Builder 提交的算法源码里有没有约定的入口。
 *
 * ⚠️ **这不是安全检查，只是一次入口形状检查。** 两条正则只确认
 * `module.exports = ...` / `def calculate(raw_data, context):` 存在，代码内部做什么
 * 完全不看 —— 真正的执行边界在别处（JS 走 `vm`、Python 走子进程）。别把它当沙箱，
 * 也别以为加正则能收紧安全。
 *
 * 它存在的理由是**把失败提前到保存时**：没有入口的算法在运行期的表现是「装好了、
 * 没报错、就是没有算法输出」，从现象倒查非常费时。保存时报一条明确的错，用户当场
 * 就知道要写什么。
 *
 * `none` 和 `json` 类型直接返回（不是代码，没有入口一说）。
 *
 * 抛错而不是返回错误列表，是因为调用方是保存流程：这一条不过就不该继续往磁盘写。
 *
 * @param {string} type 算法类型（none/json/js/python）。
 * @param {*} source 源码文本。
 * @returns {void}
 * @throws {Error} 代码类算法缺源码或缺入口时抛出。
 */
function validateBuilderAlgorithmSource(type, source) {
  if (!CODE_ALGORITHM_TYPES.has(type)) return;
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error(`${type} algorithm source is required`);
  }
  if (type === 'js' && !/module\.exports\s*=/.test(source)) {
    throw new Error('JavaScript algorithm must export calculate with module.exports');
  }
  if (type === 'python' && !/^\s*def\s+calculate\s*\(\s*raw_data\s*,\s*context\s*\)\s*:/m.test(source)) {
    throw new Error('Python algorithm must define calculate(raw_data, context)');
  }
}

const BUILDER_BAUD_RATES = Object.freeze([9600, 115200, 460800, 921600, 1000000, 1500000, 2000000]);

/**
 * 把字节数组还原成 Builder 输入框里的十六进制写法。
 *
 * Builder 的 delimiter 字段是给人看的字符串（`AA 55 03 99`），预设里存的是字节数组。
 * 大写补零两位、空格分隔 —— 和三份内置模板里已有的写法逐字一致，
 * 否则同一个协议在下拉框里会显示成两种样子。
 *
 * @param {number[]} bytes 分隔符字节。
 * @returns {string} 十六进制字符串，空数组返回空串。
 */
function formatDelimiterBytes(bytes) {
  if (!Array.isArray(bytes) || !bytes.length) return '';
  return bytes.map((byte) => Number(byte).toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * 把一份串口协议预设翻译成 Builder 的 serialTemplate。
 *
 * 预设存的是 manifest 的 `protocol` 段（跟解码器同一份 schema），Builder 表单
 * 用的是另一套扁平字段（`framingType` / `dataBits` / `bytesPerValue`）。这里做的
 * 就是这层翻译，好处是「新建传感器」的模板列表和 `GET /api/serial/protocols`
 * 永远同源 —— 用户往可写目录丢一份 JSON，下拉框里就多一项，不用改代码也不用重新构建。
 *
 * `dataBits` 是 Builder 的显示口径（只有 8/12 两档），真正决定帧长的是
 * `bytesPerValue`，所以它直接取宽度表。四字节类型在界面上会显示成 8 Bit，
 * 这是现有 Segmented 组件的表达能力上限，不是算错了。
 *
 * @param {object} preset 已归一化的预设。
 * @returns {object} serialTemplate 条目。
 */
function buildSerialTemplateFromPreset(preset) {
  const framing = preset.protocol?.framing || {};
  const decoding = preset.protocol?.decoding || {};
  const bytesPerValue = PROTOCOL_VALUE_TYPE_WIDTHS[decoding.valueType] || 1;
  const delimiter = formatDelimiterBytes(framing.delimiter);
  // 卡片下方已经有一行 baud / 分帧 / 位宽 的事实条，所以描述优先用预设自己的
  // 一句话摘要，不再把同样的参数重复一遍；没写摘要的用户预设才回落成参数拼接。
  const description = preset.summary
    ? String(preset.summary).trim().replace(/。$/, '')
    : [
      `${preset.protocol?.baudRate} baud`,
      delimiter ? `帧尾 ${delimiter}` : '不分包（固定长度）',
      `${decoding.valueType} × ${decoding.valueCount || '按点数'}`,
    ].join('，');

  return {
    id: preset.id,
    label: preset.label,
    description,
    // 预设自带的元信息，Builder 现在只用 label/description/defaults，
    // 这几项留给「查看协议文档」和矩阵形状自动填这类后续功能。
    doc: preset.doc || '',
    source: preset.source || '',
    matrix: preset.matrix || null,
    valueCount: decoding.valueCount || null,
    defaults: {
      transportType: 'binary',
      baudRate: preset.protocol?.baudRate,
      framingType: framing.type,
      delimiter,
      dataBits: bytesPerValue === 2 ? 12 : 8,
      valueType: decoding.valueType,
      byteOffset: decoding.byteOffset || 0,
      bytesPerValue,
    },
  };
}

/**
 * 组装 Builder 目录。
 *
 * @param {object} [options] 参数。
 * @param {object[]} [options.serialProtocolPresets] `loadSerialProtocolPresets()` 出来的预设。
 *   刻意从外面传进来而不是在这里读文件：这一层不该碰 fs，也不该反向依赖 serial 层。
 * @returns {object} Builder 目录。
 */
function buildDisplaySystemBuilderCatalog({ serialProtocolPresets = [] } = {}) {
  const legacySerialTemplates = [
      {
        id: 'pressure-fixed-length',
        label: '经典 8 Bit 帧',
        description: '1000000 baud，不分包，按矩阵点数读取完整 uint8 帧',
        defaults: {
          transportType: 'binary',
          baudRate: 1000000,
          framingType: 'fixedLength',
          delimiter: '',
          dataBits: 8,
          valueType: 'uint8',
          byteOffset: 0,
          bytesPerValue: 1,
        },
      },
      {
        id: 'pressure-u8-tail',
        label: '921600 分包协议',
        description: '921600 baud，使用 AA 55 03 99 帧尾分包，按 uint8 解码',
        defaults: {
          transportType: 'binary',
          baudRate: 921600,
          framingType: 'delimiter',
          delimiter: 'AA 55 03 99',
          dataBits: 8,
          valueType: 'uint8',
          byteOffset: 0,
          bytesPerValue: 1,
        },
      },
      {
        id: 'pressure-adc16-tail',
        label: '经典 12 Bit ADC',
        description: '1500000 baud，8 字节帧尾，按 uint16le 解码',
        defaults: {
          transportType: 'binary',
          baudRate: 1500000,
          framingType: 'delimiter',
          delimiter: 'AA 00 55 00 03 00 99 00',
          dataBits: 12,
          valueType: 'uint16le',
          byteOffset: 0,
          bytesPerValue: 2,
        },
      },
  ];

  // 同 id 时预设覆盖内置模板 —— 和 loader 里「用户预设覆盖内置预设」同一套规则，
  // 保证下拉框里一个 id 只出现一次；旧 manifest 记的 serialTemplate 也仍然找得到。
  const serialTemplateById = new Map(legacySerialTemplates.map((template) => [template.id, template]));
  serialProtocolPresets.forEach((preset) => {
    if (!preset?.id || !preset.protocol) return;
    serialTemplateById.set(preset.id, buildSerialTemplateFromPreset(preset));
  });
  const serialTemplates = [...serialTemplateById.values()];

  // 预设可能用了不在固定档位里的波特率（大床是 3000000），不并进来的话
  // 选中预设后波特率下拉框会显示成一个没有选项的裸数字。
  const baudRates = [...new Set([
    ...BUILDER_BAUD_RATES,
    ...serialTemplates.map((template) => Number(template.defaults?.baudRate)).filter(Boolean),
  ])].sort((left, right) => left - right);

  return {
    serialTemplates,
    displayTemplates: [
      {
        id: 'heatmap-overview',
        label: '热力图总览',
        description: '彩色热力图、压力统计和左侧受压区域数据',
        defaults: {
          rendererId: 'heatmap',
          visualizationAlgorithmId: 'identity',
          profileLabel: '热力图总览',
          showStats: true,
          showPressurePanel: true,
          showAreaPanel: true,
        },
      },
      {
        id: 'numeric-matrix',
        label: '数字矩阵',
        description: '直接显示每个点的数值，同时保留压力统计',
        defaults: {
          rendererId: 'matrix',
          visualizationAlgorithmId: 'identity',
          profileLabel: '数字矩阵',
          showStats: true,
          showPressurePanel: true,
          showAreaPanel: true,
        },
      },
    ],
    serialRoles: ['sit', 'back', 'head', 'sensor'],
    // 多传感器系统的 outputChannel 可以任意取名，这里只给建议值而不是枚举。
    // sit/back/head 三路会入库并进历史回放，其它通道目前只有实时显示。
    outputChannelSuggestions: [
      { id: 'sit', label: '坐垫（入库）', stored: true },
      { id: 'back', label: '靠背（入库）', stored: true },
      { id: 'head', label: '头枕（入库）', stored: true },
      { id: 'sensor', label: '附加传感器（仅实时显示）', stored: false },
    ],
    transportTypes: [
      { id: 'binary', label: '二进制串口' },
    ],
    baudRates,
    framingTypes: [
      { id: 'fixedLength', label: '不分包（固定长度）' },
      { id: 'delimiter', label: '按分隔符分包' },
    ],
    // 直接取协议层的支持列表，避免 Builder 下拉框和解码器实现各写一份而漂移。
    valueTypes: [...PROTOCOL_VALUE_TYPES],
    checksumTypes: [...PROTOCOL_CHECKSUM_TYPES],
    backendAlgorithms: [
      { id: 'none', label: '不处理' },
      { id: 'json', label: '数值处理' },
    ],
    algorithmModes: [
      { id: 'none', label: '不处理' },
      { id: 'json', label: '参数化数值处理' },
      { id: 'code', label: '自定义代码函数' },
    ],
    codeLanguages: [
      {
        id: 'js',
        label: 'JavaScript',
        filename: 'algorithm.js',
        template: DEFAULT_ALGORITHM_SOURCES.js,
      },
      {
        id: 'python',
        label: 'Python',
        filename: 'algorithm.py',
        template: DEFAULT_ALGORITHM_SOURCES.python,
      },
    ],
    renderers: [
      { id: 'heatmap', type: 'heatmap', label: '热力图' },
      { id: 'matrix', type: 'matrix', label: '数值矩阵' },
      { id: 'raw2d', type: 'raw2d', label: '原始二维数据' },
    ],
    visualizationAlgorithms: [
      { id: 'identity', type: 'identity', label: '原始数据', options: {} },
      { id: 'normalize', type: 'normalize', label: '归一化', options: { max: 100 } },
      { id: 'threshold', type: 'threshold', label: '阈值过滤', options: { threshold: 20 } },
      { id: 'smooth', type: 'smooth', label: '邻域平滑', options: { radius: 1 } },
    ],
    // display.canvas 的可选值目录。色值实现留在前端 colormaps.js，
    // 这里只登记 id 和中文名，保证前端零件栏、后端校验用的是同一份白名单。
    colormaps: [...CANVAS_COLORMAPS],
    overlays: [...CANVAS_OVERLAYS],
    // 图表表面能落地的叠加层是画布那份的子集，不含 legend。
    chartOverlays: [...CHART_OVERLAYS],
    chartCardLimit: DISPLAY_CHART_CARD_LIMIT,
  };
}

/** 只挑出草稿层能落地的三段，别的字段一律不接受 —— 这条通路只动 display 段。 */
const DISPLAY_SECTION_FIELDS = Object.freeze(['canvas', 'chartAppearance', 'chartCards']);

/**
 * 把 display 段的三个字段合并进原 manifest 的 `display`。
 *
 * `undefined` 表示"这次不改这一段"，`null` 表示"清掉这一段回到内置默认"。
 * 分开这两种语义是必要的：只保存配色的那次请求不该顺手把图表卡片清空。
 *
 * @param {object} display 原 manifest 的 display 段。
 * @param {object} patch 要合并的三段。
 * @returns {object} 新的 display 段。
 */
function mergeDisplaySection(display, patch = {}) {
  const next = { ...(display && typeof display === 'object' && !Array.isArray(display) ? display : {}) };
  DISPLAY_SECTION_FIELDS.forEach((field) => {
    if (!(field in patch) || patch[field] === undefined) return;
    if (patch[field] === null) {
      delete next[field];
      return;
    }
    next[field] = patch[field];
  });
  return next;
}

/**
 * 落盘前把这三段归一成规范形状。
 *
 * 前端传来的可能是 `colormap: 'thermal'` 这种简写。运行时无所谓（加载 manifest
 * 时还会再归一一遍），但**文件内容是要给人看的** —— 用户拿这个文件夹去二开，
 * 里面写着什么就是他学到的写法，所以磁盘上留规范形状。
 *
 * 只归一这三个字段。整段过一遍 `normalizeDisplayConfig` 会把 widgets / profiles
 * 也重写掉，那就不是"只动 display 段那三个字段"了。
 */
const DISPLAY_SECTION_NORMALIZERS = Object.freeze({
  canvas: (value) => {
    const normalized = normalizeCanvasConfig(value, []);
    // `canvas.widgets` 缺省的含义是"跟随 display.widgets"。这里不能把当时那份
    // 抄成一份显式清单 —— 抄了之后再改 display.widgets，画布就跟不上了。
    if (!Array.isArray(value?.widgets)) delete normalized.widgets;
    return normalized;
  },
  chartAppearance: (value) => normalizeChartAppearanceConfig(value),
  chartCards: (value) => normalizeChartCardsConfig(value),
});

/**
 * 合并 → 校验 → 归一，`saveDisplaySection` 和 `duplicate` 共用这一条。
 *
 * 校验跑在**归一之前**：`chartAppearance` 里写了 `legend` 这种错，归一会静默丢掉，
 * 只有先校验才能把它报给用户，而不是保存成功却没生效。
 *
 * @param {object} display 原 manifest 的 display 段。
 * @param {object} patch 要写入的三段。
 * @returns {object} 可落盘的新 display 段。
 */
function buildDisplaySection(display, patch) {
  const merged = mergeDisplaySection(display, patch);
  const errors = validateDisplayConfig(merged, { source: 'display draft' });
  if (errors.length) {
    const error = new Error('display section validation failed');
    error.details = errors;
    throw error;
  }
  const next = { ...merged };
  DISPLAY_SECTION_FIELDS.forEach((field) => {
    if (next[field] === undefined) return;
    next[field] = DISPLAY_SECTION_NORMALIZERS[field](next[field]);
  });
  return next;
}

/**
 * 递归复制一个目录。
 *
 * 必须递归：v3 多传感器 manifest 的线序 / 点位文件在 `cushion/` 这类子目录里，
 * 只复制顶层文件会造出一个读不出数据的新展示系统。
 *
 * @param {string} sourceDirectory 源目录。
 * @param {string} targetDirectory 目标目录。
 * @param {object} fsLike 文件系统实现。
 * @returns {void}
 */
function copyDirectoryRecursive(sourceDirectory, targetDirectory, fsLike) {
  fsLike.mkdirSync(targetDirectory, { recursive: true });
  fsLike.readdirSync(sourceDirectory, { withFileTypes: true }).forEach((entry) => {
    const from = path.join(sourceDirectory, entry.name);
    const to = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(from, to, fsLike);
      return;
    }
    // 逐字节复制而不是 JSON 往返：v1/v2/v3、algorithm.js / algorithm.py、
    // assets/ 里的图片全都自动正确，语义上也就是用户说的"把文件夹复制一份"。
    fsLike.copyFileSync(from, to);
  });
}

/**
 * 创建展示系统工作区服务：Builder 的读写落盘层。
 *
 * 这是二开链路里唯一**往磁盘写展示系统**的地方。它只认一个 `writableRoot`
 * （由调用方拼成 `<用户可写目录>/display-systems`），因此打包后的只读资源目录
 * 永远不可能被写到 —— 「自带系统只读、用户系统可写」那条规则的物理保障就在这里，
 * 不是靠上层判断 `editable`（上层那道检查只是为了给出更好的错误信息）。
 *
 * 构造时立刻 `mkdirSync(recursive)`：目录不存在是首次运行的常态，等到保存那一刻
 * 才发现目录没有会让第一次保存失败。
 *
 * `fsLike` 注入让整个服务能在内存文件系统上测（写盘逻辑分支多，不注入就得建真目录）。
 * `listSerialProtocolPresets` 是**函数而不是数组**，为的是每次取目录时重读预设 ——
 * 用户往可写目录丢一份协议 JSON，刷新页面就能看到，不必重启服务。
 *
 * @param {object} [options] 创建参数。
 * @param {string} options.writableRoot 用户可写的 display-systems 目录。
 * @param {typeof fs} [options.fsLike=fs] 注入的 fs。
 * @param {() => object[]} [options.listSerialProtocolPresets] 串口协议预设读取函数。
 * @returns {{save: Function, saveDisplaySection: Function, duplicate: Function,
 *            read: Function, getCatalog: Function}} 工作区服务。
 * @throws {Error} 缺 writableRoot 时抛出 —— 没有它就无从判断该往哪写，
 *         静默退化会有把文件写进只读资源目录的风险。
 */
function createDisplaySystemWorkspaceService({
  writableRoot,
  fsLike = fs,
  // 每次取目录时重新读一遍串口协议预设：用户往可写目录丢一份 JSON 之后
  // 刷新「新建传感器」页面就能看到，不用重启服务。
  listSerialProtocolPresets = () => [],
} = {}) {
  if (!writableRoot) throw new Error('display system writableRoot is required');
  fsLike.mkdirSync(writableRoot, { recursive: true });

  /**
   * Builder「新建/保存传感器」的落盘主流程。
   *
   * 顺序是：校 id → 校算法 → 从几何文件反推尺寸 → 重建 manifest → 校 manifest →
   * 校四份定义文件 → 建目录 → **先写定义文件、最后写 manifest**。
   *
   * 几个必须知道的点：
   *
   * **① `SAFE_DISPLAY_SYSTEM_ID` 是路径安全边界，不只是命名规范。** id 会直接
   * `path.join(writableRoot, id)` 当目录名用，允许 `..` 或分隔符就能写到可写根目录
   * 之外。改这个正则等于改一道安全边界。
   *
   * **② 尺寸以几何文件为准，不以 manifest 声明为准**（`derivedMatrix` 的优先级：
   * 坐标映射 → 点位表 → manifest 声明）。同理 `valueCount` 也从点数反推。理由是这两者
   * 一旦不一致，画面就是错位的，而用户改的通常是几何文件；让文件当唯一真相能从根上
   * 消掉「manifest 说 10×9、点位表是 8×8」这种不可能自己发现的错。
   *
   * **③ 这条通路内嵌了「Builder 单传感器向导」的假设**：强制 `schemaVersion: 2`、
   * 把 `files` 重写成固定的扁平文件名、按类型重建整个 `algorithm` 段。所以它**不能**
   * 用来保存 v3 多传感器 manifest —— 这正是 `saveDisplaySection` 单独存在的原因
   * （见那个函数的注释）。
   *
   * **④ 两轮校验都用 `error.details` 带上完整错误列表**再抛，HTTP 层据此把每一条
   * 摊给用户，而不是只给一句「保存失败」。
   *
   * **⑤ manifest 一定最后写。** 发现层是靠 `display-system.json` 是否存在来认一个
   * 目录的，而**没有 manifest 的目录会被静默跳过**（`discoverDisplaySystems` 只在
   * `result.manifestPath` 非空时才记错误）。所以写到一半崩掉的结果是「这个系统还没
   * 出现」，而不是「出现了但引用的文件都不在」—— 后者会在每次启动时刷一堆错误。
   * **调整写入顺序会破坏这个性质。**
   *
   * `overwrite` 默认 false，目录已存在时抛带 `code = 'DISPLAY_SYSTEM_EXISTS'` 的错，
   * 让上层能把它翻成「id 已被占用」而不是 500。
   *
   * @param {object} [options] 保存参数。
   * @param {object} options.manifest Builder 提交的 manifest。
   * @param {{lineOrder?: object, pointOrder?: object, coordinateMap?: object,
   *          algorithmData?: object, algorithmSource?: string}} [options.definitions={}]
   *        随 manifest 一起提交的定义文件内容。
   * @param {boolean} [options.overwrite=false] 目录已存在时是否覆盖。
   * @returns {{id: string, directory: string, manifest: object}} 落盘结果。
   * @throws {Error} id 非法、算法类型不支持、算法缺入口、manifest 或定义文件校验失败、
   *         目录已存在且未允许覆盖。
   */
  function save({ manifest: inputManifest, definitions = {}, overwrite = false } = {}) {
    if (!inputManifest || typeof inputManifest !== 'object') {
      throw new Error('display system manifest is required');
    }
    const id = String(inputManifest.id || '').trim();
    if (!SAFE_DISPLAY_SYSTEM_ID.test(id)) {
      throw new Error('display system id may only contain letters, numbers, dot, underscore and hyphen');
    }

    const algorithmType = inputManifest.algorithm?.type || 'none';
    if (!BUILDER_ALGORITHM_TYPES.has(algorithmType)) {
      throw new Error('page builder only supports none, json, js and python backend algorithms');
    }
    const algorithmSource = definitions.algorithmSource
      ?? DEFAULT_ALGORITHM_SOURCES[algorithmType]
      ?? null;
    validateBuilderAlgorithmSource(algorithmType, algorithmSource);

    const suppliedPointOrder = definitions.pointOrder == null
      ? null
      : canonicalizePointDefinition(definitions.pointOrder);
    const pointDefinition = suppliedPointOrder
      ? normalizePointDefinition(suppliedPointOrder)
      : null;
    const suppliedCoordinateMap = definitions.coordinateMap == null
      ? null
      : canonicalizeCoordinateMapDefinition(definitions.coordinateMap);
    const coordinateDefinition = suppliedCoordinateMap
      ? normalizeCoordinateMapDefinition(suppliedCoordinateMap)
      : null;
    const derivedMatrix = coordinateDefinition
      ? { rows: coordinateDefinition.rows, cols: coordinateDefinition.cols }
      : pointDefinition
      ? { rows: pointDefinition.rows, cols: pointDefinition.cols }
      : inputManifest.sensor?.matrix;
    const derivedValueCount = pointDefinition?.points.length ?? coordinateDefinition?.pointCount;

    const manifest = {
      ...inputManifest,
      schemaVersion: 2,
      id,
      sensor: {
        ...inputManifest.sensor,
        matrix: derivedMatrix,
      },
      protocol: {
        ...inputManifest.protocol,
        decoding: {
          ...inputManifest.protocol?.decoding,
          ...(derivedValueCount == null ? {} : { valueCount: derivedValueCount }),
        },
      },
      files: {
        lineOrder: 'line-order.json',
        pointOrder: 'point-order.json',
        ...(suppliedCoordinateMap ? { coordinateMap: 'coordinate-map.json' } : {}),
      },
      algorithm: algorithmType === 'json'
        ? { ...inputManifest.algorithm, type: 'json', dataFile: 'algorithm-data.json', entry: null }
        : CODE_ALGORITHM_TYPES.has(algorithmType)
          ? {
            ...inputManifest.algorithm,
            type: algorithmType,
            entry: algorithmType === 'python' ? 'algorithm.py' : 'algorithm.js',
            dataFile: null,
            input: {
              source: 'rawData',
              ...(inputManifest.algorithm?.input || {}),
            },
            timeoutMs: Number(inputManifest.algorithm?.timeoutMs || 1000),
          }
          : { type: 'none' },
    };
    const validation = validateDisplaySystemConfig(manifest, { source: 'page builder' });
    if (!validation.ok) {
      const error = new Error('display system manifest validation failed');
      error.details = validation.errors;
      throw error;
    }
    const persistedManifest = {
      ...manifest,
      protocol: validation.value.protocol,
    };

    const matrix = validation.value.sensor.matrix;
    const total = matrix.rows * matrix.cols;
    const identity = createIdentityDefinitions(matrix);
    const pointOrder = suppliedPointOrder || identity.pointOrder;
    const pointCount = suppliedPointOrder?.points.length || total;
    const lineOrder = definitions.lineOrder || {
      order: Array.from({ length: pointCount }, (_, index) => index + 1),
    };
    const algorithmData = algorithmType === 'json' ? (definitions.algorithmData || {}) : null;
    const definitionErrors = [
      ...validateLineOrderDefinition(lineOrder, { source: 'line-order.json', matrixTotal: total }),
      ...validatePointOrderDefinition(pointOrder, {
        source: 'point-order.json',
        matrix,
        maxPointCount: Array.isArray(lineOrder?.order) ? lineOrder.order.length : total,
      }),
      ...(suppliedCoordinateMap
        ? validateCoordinateMapDefinition(suppliedCoordinateMap, {
          source: 'coordinate-map.json',
          matrix,
        })
        : []),
      ...validateAlgorithmDataDefinition(algorithmData, { source: 'algorithm-data.json' }),
    ];
    if (definitionErrors.length) {
      const error = new Error('display system definition validation failed');
      error.details = definitionErrors;
      throw error;
    }

    const directory = path.join(writableRoot, id);
    if (fsLike.existsSync(directory) && !overwrite) {
      const error = new Error('display system already exists');
      error.code = 'DISPLAY_SYSTEM_EXISTS';
      throw error;
    }
    fsLike.mkdirSync(directory, { recursive: true });
    writeJsonAtomic(path.join(directory, 'line-order.json'), lineOrder, fsLike);
    writeJsonAtomic(path.join(directory, 'point-order.json'), pointOrder, fsLike);
    if (suppliedCoordinateMap) {
      writeJsonAtomic(path.join(directory, 'coordinate-map.json'), suppliedCoordinateMap, fsLike);
    }
    if (algorithmData) {
      writeJsonAtomic(path.join(directory, 'algorithm-data.json'), algorithmData, fsLike);
    }
    if (CODE_ALGORITHM_TYPES.has(algorithmType)) {
      const filename = algorithmType === 'python' ? 'algorithm.py' : 'algorithm.js';
      writeTextAtomic(path.join(directory, filename), algorithmSource, fsLike);
    }
    writeJsonAtomic(path.join(directory, 'display-system.json'), persistedManifest, fsLike);

    return { id, directory, manifest: persistedManifest };
  }

  /**
   * 把主界面拖出来的外观固化进 manifest 的 display 段。
   *
   * **刻意不复用 `save()`。** 那条通路内嵌了 Builder 的单传感器向导假设：
   * 强制 `schemaVersion: 2`、把 `files` 重写成扁平路径、重建 `algorithm` 段。
   * 拿一份 v3 多传感器 manifest 过一遍它只为了改一个配色，会把 manifest 改坏。
   * 这里读原文、只合并 display 下那三段、逐字写回，其余字段一个都不碰。
   *
   * @param {object} config 已加载的展示系统配置（要有 `manifestPath`）。
   * @param {{canvas?: object, chartAppearance?: object, chartCards?: object[]}} patch 要写入的三段。
   * @returns {{id: string, directory: string, manifest: object}} 写入结果。
   */
  function saveDisplaySection(config, patch = {}) {
    if (!config?.manifestPath) throw new Error('display system manifestPath is required');
    const manifest = readJsonOptional(config.manifestPath, fsLike);
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('display system manifest is not readable');
    }
    const display = buildDisplaySection(manifest.display, patch);
    const nextManifest = { ...manifest, display };
    writeJsonAtomic(config.manifestPath, nextManifest, fsLike);
    return {
      id: String(manifest.id || ''),
      directory: path.dirname(config.manifestPath),
      manifest: nextManifest,
    };
  }

  /**
   * 把整个展示系统目录复制成一个新 id 的新模块，并写入 display 段。
   *
   * 这是自带展示系统唯一的保存出路：它的目录在资源目录里、不可写，
   * 所以**不检查源能不能写**，只检查源能不能读、目标 id 有没有被占。
   *
   * @param {object} config 源展示系统配置（要有 `manifestPath`）。
   * @param {{id: string, name?: string, canvas?: object, chartAppearance?: object,
   *          chartCards?: object[]}} options 新模块的身份与要写入的三段。
   * @returns {{id: string, directory: string, manifest: object}} 新模块。
   */
  function duplicate(config, options = {}) {
    if (!config?.manifestPath) throw new Error('display system manifestPath is required');
    const id = String(options.id || '').trim();
    if (!SAFE_DISPLAY_SYSTEM_ID.test(id)) {
      throw new Error('display system id may only contain letters, numbers, dot, underscore and hyphen');
    }
    const sourceDirectory = config.sourceDirectory || path.dirname(config.manifestPath);
    const manifest = readJsonOptional(config.manifestPath, fsLike);
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('display system manifest is not readable');
    }
    const directory = path.join(writableRoot, id);
    if (fsLike.existsSync(directory)) {
      const error = new Error('display system already exists');
      error.code = 'DISPLAY_SYSTEM_EXISTS';
      throw error;
    }
    const display = buildDisplaySection(manifest.display, options);
    const nextManifest = {
      ...manifest,
      id,
      name: String(options.name || '').trim() || `${manifest.name || id} 副本`,
      display,
      metadata: {
        ...(manifest.metadata || {}),
        // 必须显式写 'user'：`classifyDisplaySystemAccess` 把 `metadata.origin` 当
        // 最高优先级的判据，自带系统那份写着 'system'，照抄过来的话副本明明躺在
        // 可写目录里也会被判成不可编辑，用户就再也保存不了第二次。
        origin: 'user',
        // 记下来源，以后要做"和原版比一比"或者"跟随原版升级"时有据可查。
        derivedFrom: String(manifest.id || ''),
      },
    };
    copyDirectoryRecursive(sourceDirectory, directory, fsLike);
    // manifest 的文件名跟着源目录走 —— 源里叫 display-system.json 就还叫这个。
    writeJsonAtomic(path.join(directory, path.basename(config.manifestPath)), nextManifest, fsLike);
    return { id, directory, manifest: nextManifest };
  }

  /**
   * 读出一个展示系统的**可编辑视图**：manifest 原文 + 五份定义文件内容 + 权限标记。
   *
   * 与发现层的 `getById` 不同：那个给的是归一、校验、投影之后的运行时配置；这里给的是
   * **磁盘原文**，因为 Builder 要把用户当初写的东西一字不差地填回表单。若拿归一结果
   * 回填，用户一打开表单就会看到被补过默认值的内容，随手一存就把默认值固化进
   * manifest。
   *
   * 五份定义全走 `readJsonOptional`/`readTextOptional`，缺文件返回 null 而不报错 ——
   * 只有线序和点位是必填，其余三份缺失是常态。
   *
   * 三个权限字段分工不同，别当成一个：
   * - `pathIsWritable`：这份 manifest **物理上**是否在可写根目录里（用
   *   `path.relative(...).startsWith('..')` 判包含，理由同
   *   `displaySystemRuntimeDiscovery.isPathInside`）。
   * - `editable`：优先采信调用方给的 `config.editable`（发现层已按 origin 判过），
   *   没给才退回路径判断。这样两处判据不会给出互相矛盾的答案。
   * - `writable`：两者都成立才是真能写。前端据此决定「保存」按钮是可用、还是只给
   *   「另存为」。
   *
   * @param {{manifestPath?: string, resolvedFiles?: object, editable?: boolean,
   *          origin?: string}} config 已加载的展示系统配置。
   * @returns {object|null} 编辑视图；没有 manifestPath 时为 null。
   */
  function read(config) {
    if (!config?.manifestPath) return null;
    const pathIsWritable = !path.relative(
      path.resolve(writableRoot),
      path.resolve(path.dirname(config.manifestPath)),
    ).startsWith('..');
    const editable = typeof config.editable === 'boolean'
      ? config.editable
      : pathIsWritable;
    return {
      manifest: readJsonOptional(config.manifestPath, fsLike),
      definitions: {
        lineOrder: readJsonOptional(config.resolvedFiles?.lineOrder, fsLike),
        pointOrder: readJsonOptional(config.resolvedFiles?.pointOrder, fsLike),
        coordinateMap: readJsonOptional(config.resolvedFiles?.coordinateMap, fsLike),
        algorithmData: readJsonOptional(config.resolvedFiles?.algorithmData, fsLike),
        algorithmSource: readTextOptional(config.resolvedFiles?.algorithmEntry, fsLike),
      },
      editable,
      origin: config.origin || (editable ? 'user' : 'system'),
      writable: editable && pathIsWritable,
    };
  }

  return {
    getCatalog: () => ({
      ...buildDisplaySystemBuilderCatalog({
        serialProtocolPresets: listSerialProtocolPresets(),
      }),
      writableRoot,
    }),
    read,
    save,
    saveDisplaySection,
    duplicate,
    writableRoot,
  };
}

module.exports = {
  DEFAULT_ALGORITHM_SOURCES,
  buildDisplaySystemBuilderCatalog,
  createDisplaySystemWorkspaceService,
  createIdentityDefinitions,
  validateBuilderAlgorithmSource,
};
