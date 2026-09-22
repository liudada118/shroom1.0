const { SENSOR_DEFINITIONS } = require('@shroom/backend/sensors');

const DEFAULT_CONFIGURATION = Object.freeze({ algorithms: [], charts: [], showPressure: true, showArea: true });
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** 抛出配置校验错误，不接受未声明的代码、路径或数据源。 */
function invalid(message) { throw Object.assign(new Error(message), { code: 'DISPLAY_SYSTEM_INVALID' }); }

/** 检查对象字段，避免拼写错误悄悄变成未生效配置。 */
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !allowed.includes(key))) invalid('配置包含未知字段。');
}

/** 返回原生输入的已登记尺寸和通道；未知型号不伪造 32×32 输入。 */
function nativeInputs(sourceType) {
  const sensor = SENSOR_DEFINITIONS[sourceType];
  return sensor ? { channels: [...sensor.channels], matrix: { rows: sensor.matrix.height, cols: sensor.matrix.width, total: sensor.matrix.total } } : { channels: [], matrix: null };
}

/** 规范化每个系统独有的算法与图表；加载旧文件时补齐默认值。 */
function validateNativeConfiguration(value = DEFAULT_CONFIGURATION, { sourceType, systemId, packages, validatePackages = true } = {}) {
  fields(value, ['algorithms', 'charts', 'showPressure', 'showArea']);
  const next = { ...DEFAULT_CONFIGURATION, ...value };
  if (typeof next.showPressure !== 'boolean' || typeof next.showArea !== 'boolean') invalid('原生图表显示开关必须是布尔值。');
  if (!Array.isArray(next.algorithms) || next.algorithms.length > 8 || !Array.isArray(next.charts) || next.charts.length > 12) invalid('最多配置 8 个算法和 12 张算法图表。');
  const inputs = nativeInputs(sourceType);
  const ids = new Set();
  next.algorithms = next.algorithms.map((entry) => {
    fields(entry, ['packageId', 'sensorId', 'enabled']);
    if (!SAFE_ID.test(entry.packageId || '') || !SAFE_ID.test(entry.sensorId || '') || typeof entry.enabled !== 'boolean' || ids.has(entry.packageId)) invalid('算法需要唯一的包 ID、输入通道和启用开关。');
    ids.add(entry.packageId);
    if (!inputs.channels.includes(entry.sensorId)) invalid('算法输入不属于此系统的原生通道。');
    if (validatePackages) {
      const item = packages?.find((candidate) => candidate.id === entry.packageId);
      if (!item || item.attachable === false || item.packageManifest?.input?.mode === 'multi-sensor') invalid('请选择目录中可接入的单通道算法包。');
      if (item.systemId && item.systemId !== systemId) invalid('用户分类算法只能绑定到其测试并保存的系统。');
      const totals = item.compatibility?.matrixTotals || [];
      const shapes = item.compatibility?.recommendedMatrices || [];
      if (!inputs.matrix || (totals.length && !totals.includes(inputs.matrix.total)) || (shapes.length && !shapes.some((shape) => shape.rows === inputs.matrix.rows && shape.cols === inputs.matrix.cols))) invalid('算法输入尺寸与模板不匹配，请选择兼容算法。');
    }
    return { packageId: entry.packageId, sensorId: entry.sensorId, enabled: entry.enabled };
  });
  const chartIds = new Set();
  next.charts = next.charts.map((entry) => {
    fields(entry, ['id', 'name', 'packageId', 'metricId', 'color', 'decimals']);
    if (!SAFE_ID.test(entry.id || '') || chartIds.has(entry.id) || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100) invalid('图表需要独立 ID 和名称。');
    chartIds.add(entry.id);
    if (!ids.has(entry.packageId) || !SAFE_ID.test(entry.metricId || '')) invalid('图表必须绑定本系统已配置的算法和实际输出指标；删除算法时需同时删除其图表。');
    if (validatePackages && !packages?.find((item) => item.id === entry.packageId)?.metricDefinitions?.some((metric) => metric.id === entry.metricId)) invalid('算法没有声明此输出指标，不能用压力值替代呼吸。');
    const color = entry.color || '#20B486';
    const decimals = entry.decimals ?? 1;
    if (!/^#[0-9a-fA-F]{6}$/.test(color) || !Number.isInteger(decimals) || decimals < 0 || decimals > 6) invalid('图表颜色或小数位无效。');
    return { id: entry.id, name: entry.name.trim(), packageId: entry.packageId, metricId: entry.metricId, color, decimals };
  });
  return next;
}

module.exports = { DEFAULT_CONFIGURATION, nativeInputs, validateNativeConfiguration };
