/**
 * 从系统状态消息中读取当前正在运行的传感器类型。
 *
 * `currentSensorType` 是新协议字段；没有授权字段的标量 `file` 仅用于兼容旧版切换事件。
 * 授权消息中的 `file` 可能是数组或单个授权类型，不能再当作当前选择。
 */
export function getCurrentSensorTypeFromStatus(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;

  if (typeof message.currentSensorType === 'string' && message.currentSensorType.trim()) {
    return message.currentSensorType.trim();
  }

  if (
    message.selectFlag == null &&
    typeof message.file === 'string' &&
    message.file !== 'all' &&
    message.file.trim()
  ) {
    return message.file.trim();
  }

  return null;
}

/**
 * 组合传感器下拉列表。
 *
 * 密钥授权范围只过滤内置系统；本机安装的外部 Display System 独立追加，
 * 从而保留“授权内置系统 + 用户自定义系统”两类入口，且不修改授权数据本身。
 */
export function buildAccessibleSensorOptions({
  builtInSensors = [],
  dynamicSensors = [],
  allowedTypes = null,
} = {}) {
  const allowedTypeSet = Array.isArray(allowedTypes) && allowedTypes.length
    ? new Set(allowedTypes)
    : null;
  const builtInTypeSet = new Set(builtInSensors.map((sensor) => sensor.value));
  const result = allowedTypeSet
    ? builtInSensors.filter((sensor) => allowedTypeSet.has(sensor.value))
    : [...builtInSensors];
  const seenTypes = new Set(result.map((sensor) => sensor.value));

  dynamicSensors.forEach((sensor) => {
    if (!sensor?.value || builtInTypeSet.has(sensor.value) || seenTypes.has(sensor.value)) return;
    seenTypes.add(sensor.value);
    result.push(sensor);
  });

  return result;
}
