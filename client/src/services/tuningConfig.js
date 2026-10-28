import { selectedNativeSystemId } from '../displays/nativeSystemTemplates';

const STORAGE_KEY = 'valueConfig';
const EXPLICIT_FIELDS = '__explicitTuningFields';
const FIELDS = ['valueg1', 'valuej1', 'valuel1', 'valuef1', 'value1', 'valuelInit1', 'sizeValue', 'speedValue', 'terrainBaseGain'];

/** 读取旧版兼容缓存，损坏记录或不可用存储不能阻止进入系统。 */
function readCache() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

/** 从历史型号键逐层覆盖到独立系统键，模式项高于该系统的通用项。 */
function records({ sensorType, systemId, legacyType, mode, modeOnly = false }) {
  const cache = readCache();
  const identity = systemId || selectedNativeSystemId(sensorType);
  const ids = [...new Set([legacyType, sensorType, identity].filter(Boolean))];
  return ids.flatMap(id => [...(!modeOnly ? [id] : []), ...(mode ? [`${id}__${mode}`] : [])])
    .map(key => Object.hasOwn(cache, key) ? cache[key] : null)
    .filter(value => value && typeof value === 'object' && !Array.isArray(value));
}

/** 合并已保存的有效数值，保留零值，不把默认参数误当成用户设置。 */
export function readTuningConfig(options) {
  const result = {};
  for (const record of records(options)) {
    for (const field of FIELDS) {
      const value = record[field];
      if ((typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value))) {
        result[field] = Number(value);
      }
    }
  }
  return result;
}

/** 判断最终生效字段是否由新版滑块明确保存，避免历史默认值迁移覆盖用户选择。 */
export function hasExplicitTuningValue(options, field) {
  let explicit = false;
  for (const record of records(options)) {
    if (Object.hasOwn(record, field)) explicit = Array.isArray(record[EXPLICIT_FIELDS]) && record[EXPLICIT_FIELDS].includes(field);
  }
  return explicit;
}

/** 按真实系统和显示模式保存一个参数，保留其他系统与未知历史字段。 */
export function writeTuningConfig({ sensorType, systemId, mode, valueType, value }) {
  if (!FIELDS.includes(valueType) || !Number.isFinite(value)) return false;
  const identity = systemId || selectedNativeSystemId(sensorType);
  if (!identity) return false;
  const cache = readCache(), key = mode ? `${identity}__${mode}` : identity;
  const previous = Object.hasOwn(cache, key) && cache[key] && typeof cache[key] === 'object' && !Array.isArray(cache[key]) ? cache[key] : {};
  const fields = Array.isArray(previous[EXPLICIT_FIELDS]) ? previous[EXPLICIT_FIELDS].filter(field => FIELDS.includes(field)) : [];
  const next = { ...cache, [key]: { ...previous, [valueType]: value, [EXPLICIT_FIELDS]: [...new Set([...fields, valueType])] } };
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next)); return true; }
  catch { return false; }
}
