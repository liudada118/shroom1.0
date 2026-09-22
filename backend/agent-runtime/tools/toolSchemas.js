/** 创建拒绝未知字段的工具参数对象。 */
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
/** 创建有长度上限的字符串。 */
const string = (maxLength = 160) => ({ type: 'string', minLength: 1, maxLength });
/** 创建范围受限的整数。 */
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
/** 创建有数量上限的数组。 */
const array = (items, maxItems = 32) => ({ type: 'array', items, maxItems });
const number = { type: 'number', minimum: -1e12, maximum: 1e12 };
const identifier = { ...string(80), pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$' };
const matrix = object({ rows: integer(1, 256), cols: integer(1, 256) }, ['rows', 'cols']);
const algorithmData = object({ scale: number, offset: number, min: number, max: number, zeroBelow: number,
  operations: array(object({ type: { enum: ['scale', 'offset', 'clamp', 'zeroBelow'] }, value: number, min: number, max: number, threshold: number }, ['type'])),
  metrics: array(object({ id: identifier, operation: { enum: ['sum', 'average', 'max', 'min', 'activeCount', 'activeRatio'] }, threshold: number, scale: number, offset: number }, ['id', 'operation'])),
});
const colormap = object({ id: string(80), reverse: { type: 'boolean' } }, ['id']);
const appearance = object({ colormap, overlays: array(string(80), 10) });
const chart = object({ metric: { enum: ['totalPressure', 'averagePressure', 'maxPressure', 'activePoints', 'area'] }, name: string(100), color: { ...string(7), pattern: '^#[0-9a-fA-F]{6}$' }, decimals: integer(0, 6) }, ['metric']);
const patch = object({ canvas: { anyOf: [appearance, { type: 'null' }] }, chartAppearance: { anyOf: [appearance, { type: 'null' }] }, chartCards: { anyOf: [array(chart, 6), { type: 'null' }] } });
const nativeConfiguration = object({
  algorithms: array(object({ packageId: identifier, sensorId: identifier, enabled: { type: 'boolean' } }, ['packageId', 'sensorId', 'enabled']), 8),
  charts: array(object({ id: identifier, name: string(100), packageId: identifier, metricId: identifier,
    color: { ...string(7), pattern: '^#[0-9a-fA-F]{6}$' }, decimals: integer(0, 6) }, ['id', 'name', 'packageId', 'metricId']), 12),
  showPressure: { type: 'boolean' }, showArea: { type: 'boolean' },
}, ['algorithms', 'charts', 'showPressure', 'showArea']);
const schemas = {
  get_algorithm_workspace: object({}),
  analyze_algorithm_data: object({}),
  test_algorithm: object({ name: string(80), source: string(16000), validation: { type: 'boolean' } }, ['name', 'source', 'validation']),
  prepare_algorithm_package: object({ draftId: identifier }, ['draftId']),
  get_capabilities: object({ section: { enum: ['overview', 'protocols', 'algorithms', 'display', 'contract', 'policy'] } }),
  get_current_state: object({}),
  get_current_system: object({}),
  get_algorithm_state: object({}),
  read_system: object({ systemId: identifier }, ['systemId']),
  prepare_builtin_system: object({ sourceType: identifier, id: { ...string(64), pattern: '^[A-Za-z0-9][A-Za-z0-9_-]*$' }, name: string(100), summary: string(1000), configuration: nativeConfiguration }, ['sourceType', 'id', 'name', 'summary']),
  prepare_update_native_system: object({ systemId: identifier, name: string(100), configuration: nativeConfiguration, summary: string(1000) }, ['systemId', 'name', 'configuration', 'summary']),
  prepare_delete_native_system: object({ systemId: identifier, summary: string(1000) }, ['systemId', 'summary']),
  inspect_frames: object({ systemId: identifier, sensorId: identifier, durationMs: integer(100, 10000), maxFrames: integer(1, 60) }, ['systemId', 'sensorId']),
  prepare_create_system: object({ id: identifier, name: string(120), summary: string(1000), rendererId: string(80),
    sensors: { ...array(object({ id: identifier, label: string(100), type: identifier, outputChannel: identifier, protocolId: identifier, matrix,
      lineOrder: { ...array(integer(1, 65536), 65536), minItems: 1 },
      pointOrder: { ...array({ ...array(integer(0, 255), 2), minItems: 2 }, 65536), minItems: 1 },
      algorithmType: { enum: ['none', 'json', 'package'] }, packageId: identifier, algorithmData,
    }, ['id', 'type', 'protocolId', 'matrix', 'lineOrder', 'pointOrder']), 8), minItems: 1 },
    chartCards: array(chart, 6),
  }, ['id', 'name', 'summary', 'rendererId', 'sensors']),
  prepare_duplicate_system: object({ sourceSystemId: identifier, id: identifier, name: string(120), summary: string(1000), patch }, ['sourceSystemId', 'id', 'name', 'summary']),
  prepare_update_display: object({ systemId: identifier, summary: string(1000), patch }, ['systemId', 'summary', 'patch']),
  prepare_connect_device: object({ systemId: identifier, sensorId: identifier, portPath: string(240), summary: string(1000) }, ['systemId', 'sensorId', 'portPath', 'summary']),
};
const descriptions = {
  get_algorithm_workspace: '查询已选记录、类别、用途、受限 Python 契约以及当前系统保存的分类算法源码和 realtimePackageId。查看保存算法无需重新选数据；分析与测试仍只能使用用户已选范围。',
  analyze_algorithm_data: '本机分析已选择采集记录，返回开发集窗口特征统计及真实数据摘要，不上传原始帧，不向模型泄露验证集特征。先读取算法工作台。',
  test_algorithm: '对选定记录运行新编写的受限 Python predict(f)。validation=false 为开发测试；true 在冻结源码后运行一次独立验证，使用过的验证采集不能重复用于调参后的独立验证。每任务最多 6 次。返回真实报告、误判及 draftId。禁止捏造准确率；支持的语法以工作台为准。',
  prepare_algorithm_package: '使用本会话数据范围内已真实测试的 draftId，生成源码和报告保存提案。用户应用后保存算法；具有输入契约的版本自动登记为 user-* 实时分类包。再用 prepare_update_native_system 绑定启用及添加 classIndex 图表。保存本身不启用实时识别，不修改采集数据。',
  prepare_builtin_system: '以内置系统为模板创建可编辑的独立系统。sourceType 来自 builtinTemplates，保留原生协议、线序和展示。可带 configuration 保存独立算法及图表；复制已有副本时读取并带上其 configuration。用户应用后保存。',
  prepare_update_native_system: '修改用户创建的原生独立系统：改名，增删或启停 algorithms，增删改 charts，显示/隐藏原生压力与面积图表。先 read_system，传完整 configuration，保留未要求修改的项。算法和 metricId 必须来自实时算法目录，输入 sensorId 来自 editor.inputs；可绑定真实呼吸率趋势，不能伪造呼吸波形。只生成待应用提案。',
  prepare_delete_native_system: '为用户明确要求删除的原生独立系统生成提案；应用后移除系统配置并保留采集数据。当前激活系统必须先由用户切换。不得删除内置原系统。',
  get_capabilities: '查询本机实时能力目录；创建和修改前必须查询。section 分块返回协议、可信算法包、显示选项、SDK 契约或策略。',
  get_current_state: '只读查询真实展示系统、通道、串口及 WebSocket 状态；currentSystem 是实际选中系统的身份、名称和来源，不按名称猜测。不连接设备或改变采集状态。',
  get_current_system: '只读识别后端实际选中的当前系统，返回名称、准确 ID、内置/原生模板副本/Manifest 类型和复制工具。每次新任务会自动读取；需要刷新当前目标时再次调用。未知或未选择时不得沿用旧会话中的系统。',
  read_system: '读取指定系统配置、映射和可编辑性，不执行其中代码。',
  get_algorithm_state: '只读查询当前系统实际算法实例、输入通道、等待/异常状态及有限历史输出；用于验证呼吸等图表数据来源。没有有效数值时不能声称已经产生呼吸趋势。',
  inspect_frames: '只读观察指定 canonical 通道最多 10 秒和 60 帧，返回数据统计和证据；无帧不代表设备损坏。',
  prepare_create_system: '从零创建：sensors 必须为包含 1～8 路完整传感器定义的数组，每路需协议、矩阵、真实线序和点位。每路type从新系统id派生。资料不足先询问，不传空数组；复制现有系统请用 prepare_duplicate_system。不安装、不激活。',
  prepare_duplicate_system: '按 sourceSystemId 复制已读取的真实 Manifest 系统，完整保留协议、线序、点位、模型文件和渲染配置，无需重新填写 sensors。只生成提案，应用时检查源版本并使用独立身份。可选 patch 只调整已支持显示段；不能凭空添加呼吸等算法指标。内置原生系统请使用 prepare_builtin_system。',
  prepare_update_display: '准备修改可写系统的配色、叠加层和内置统计图表提案；patch 的每段替换对应原段，null 清除此段；不修改协议、数据、渲染 profile。',
  prepare_connect_device: '为用户明确选择的系统、传感器和已枚举portPath准备激活/连接提案。用户点击应用后才执行；服务器要求未采集、未回放、无打开或重连端口。不得猜测COM口，不自动关闭既有连接。',
};

/** 递归校验固定工具 schema，并拒绝原型键、非有限数字和过深输入。 */
function validateValue(value, schema, name = 'arguments', depth = 0) {
  if (depth > 16) throw new Error(`${name}: nesting is too deep`);
  if (schema.anyOf) {
    if (!schema.anyOf.some((candidate) => { try { validateValue(value, candidate, name, depth); return true; } catch { return false; } })) throw new Error(`${name}: invalid value`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${name}: must be one of ${schema.enum.join(', ')}`);
  if (!schema.type) return;
  if (schema.type === 'null') { if (value !== null) throw new Error(`${name}: must be null`); return; }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${name}: 必须是数组。${name === 'arguments.sensors' ? '新建系统需提供完整传感器定义；复制已有系统请使用 prepare_duplicate_system。' : ''}`);
    if (value.length > schema.maxItems || value.length < (schema.minItems || 0)) throw new Error(`${name}: 需要 ${schema.minItems || 0}～${schema.maxItems} 项，实际为 ${value.length} 项。${name === 'arguments.sensors' ? '资料不足请询问用户；复制已有系统请使用 prepare_duplicate_system，不要提交空 sensors。' : ''}`);
    value.forEach((entry, index) => validateValue(entry, schema.items, `${name}[${index}]`, depth + 1)); return;
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${name}: must be a plain object`);
    for (const key of Object.keys(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(schema.properties, key)) throw new Error(`${name}.${key}: unknown field`);
      validateValue(value[key], schema.properties[key], `${name}.${key}`, depth + 1);
    }
    for (const key of schema.required) if (!Object.hasOwn(value, key)) throw new Error(`${name}.${key}: required`);
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < schema.minLength || value.length > schema.maxLength || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new Error(`${name}: invalid string`);
    return;
  }
  if (schema.type === 'boolean') { if (typeof value !== 'boolean') throw new Error(`${name}: must be boolean`); return; }
  if (!Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < schema.minimum || value > schema.maximum) throw new Error(`${name}: invalid number`);
}

module.exports = { schemas, validateValue, definitions: Object.entries(schemas).map(([name, parameters]) => ({ type: 'function', name, description: descriptions[name], parameters, strict: false })) };
