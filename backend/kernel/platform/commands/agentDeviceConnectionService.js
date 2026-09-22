const { LICENSE_SENSOR_GROUPS } = require('../../../../licenseScopes');

const BUILTIN_TYPES = new Set(LICENSE_SENSOR_GROUPS.flatMap((group) => group.items.map((item) => item.value)));
const BUILTIN_NAMES = new Map(LICENSE_SENSOR_GROUPS.flatMap((group) => group.items.map((item) => [item.value, item.label])));
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const REQUEST_FIELDS = ['systemId', 'sensorId', 'portPath', 'requestId', 'expectedCurrentSystemId', 'expectedCurrentSensorType', 'expectedRevision'];

/** 创建有明确 HTTP 状态及稳定代码的连接拒绝。 */
function connectionError(code, message, httpStatus = 409) {
  return Object.assign(new Error(message), { code, httpStatus });
}

/** 校验专用连接请求，拒绝任意命令、未知字段及缺失的并发前提。 */
function validateAgentConnectionRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw connectionError('AGENT_INVALID_ARGUMENTS', 'Connection request must be an object', 400);
  if (Object.keys(input).some((key) => !REQUEST_FIELDS.includes(key)) || REQUEST_FIELDS.some((key) => !Object.hasOwn(input, key))) throw connectionError('AGENT_INVALID_ARGUMENTS', 'Connection request has unknown or missing fields', 400);
  for (const key of ['systemId', 'sensorId']) if (typeof input[key] !== 'string' || !SAFE_ID.test(input[key])) throw connectionError('AGENT_INVALID_ARGUMENTS', `Invalid ${key}`, 400);
  for (const key of ['expectedCurrentSystemId', 'expectedCurrentSensorType']) if (input[key] !== null && (typeof input[key] !== 'string' || input[key].length > 160 || !input[key].trim())) throw connectionError('AGENT_INVALID_ARGUMENTS', `Invalid ${key}`, 400);
  if (typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedRevision)) throw connectionError('AGENT_INVALID_ARGUMENTS', 'Invalid manifest revision', 400);
  if (typeof input.portPath !== 'string' || !input.portPath.trim() || input.portPath.length > 240 || /[\x00-\x1f]/.test(input.portPath)) throw connectionError('AGENT_INVALID_ARGUMENTS', 'Invalid serial port path', 400);
  if (typeof input.requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(input.requestId)) throw connectionError('AGENT_INVALID_ARGUMENTS', 'Invalid request ID', 400);
  return input;
}

/** 创建只允许空闲时激活并连接一个明确通道的服务；旧控制命令保持原语义。 */
function createAgentDeviceConnectionService({ getRuntimeState, getSerialStatus, getSystem, getEditor, listSerialChannels, controlCommandService } = {}) {
  /** 根据活动身份读取名称与来源；不按名称相似度寻找替代系统。 */
  function describeCurrentSystem(currentSystemId, sensorType) {
    const id = currentSystemId || sensorType;
    if (!id) return null;
    const system = getSystem(id);
    const template = system?.builtinTemplate;
    if (template) return { id, name: template.name, kind: 'builtin-template', sensorType,
      sourceType: template.sourceType, sourceName: BUILTIN_NAMES.get(template.sourceType) || null,
      editable: true, editTool: 'prepare_update_native_system', copyTool: 'prepare_builtin_system' };
    if (system) return { id, name: system.name || id, kind: 'manifest', sensorType,
      origin: system.origin || null, editable: system.editable === true, copyTool: 'prepare_duplicate_system' };
    if (BUILTIN_NAMES.has(id)) return { id, name: BUILTIN_NAMES.get(id), kind: 'builtin', sensorType,
      sourceType: id, sourceName: BUILTIN_NAMES.get(id), editable: false, copyTool: 'prepare_builtin_system' };
    return { id, name: null, kind: 'unknown', sensorType, editable: false, copyTool: null };
  }

  /** 读取新鲜运行状态，输出无密钥且可用于提案固定前提的快照。 */
  function snapshot() {
    const runtime = getRuntimeState();
    const statuses = getSerialStatus();
    const serial = Array.isArray(statuses) ? statuses.map((item) => ({ role: item.role || item.portId, path: item.path || null, isOpen: item.isOpen === true, status: item.status, reconnect: item.reconnect === true, lastError: item.lastError || null })) : null;
    const channels = listSerialChannels(runtime.currentSensorType) || [];
    const currentIds = [...new Set(channels.map((channel) => channel.displaySystemId).filter(Boolean))];
    const currentSystemId = currentIds.length === 1 ? currentIds[0] : runtime.currentSystemId || null;
    const alternateTransportBusy = runtime.alternateTransportBusy === true;
    const idle = runtime.collecting === false && runtime.localPlayback === false && runtime.playing === false && runtime.historyMode === false && !alternateTransportBusy;
    const portsIdle = Array.isArray(serial) && serial.every((port) => !port.isOpen && !port.reconnect && ['registered', 'closed', 'stopped', 'error'].includes(port.status));
    return { schemaVersion: 1, observedAt: new Date().toISOString(), currentSystemId, currentSensorType: runtime.currentSensorType || null,
      currentSystem: describeCurrentSystem(currentSystemId, runtime.currentSensorType || null),
      idle, alternateTransportBusy, collecting: runtime.collecting, localPlayback: runtime.localPlayback, playing: runtime.playing, historyMode: runtime.historyMode,
      licensed: runtime.licensed === true, licenseScope: runtime.licenseScope === 'all' ? 'all' : Array.isArray(runtime.licenseScope) ? runtime.licenseScope.filter((value) => typeof value === 'string') : null,
      portsIdle, serial, currentChannels: channels.map(({ channelId, displaySystemId, sensorId, serialRole }) => ({ channelId, displaySystemId, sensorId, serialRole })),
    };
  }

  /** 同步核验原子前提并串行执行两条固定命令；进入此函数之前才能等待端口枚举。 */
  function connect(rawInput, availablePorts) {
    const input = validateAgentConnectionRequest(rawInput);
    if (!Array.isArray(availablePorts) || !availablePorts.some((port) => port?.path === input.portPath)) throw connectionError('AGENT_PORT_UNAVAILABLE', 'Selected serial port is no longer available');
    const state = snapshot();
    if (!state.licensed) throw connectionError('LICENSE_REQUIRED', 'A valid license is required to connect a device', 403);
    if (!state.idle || !state.portsIdle) throw connectionError('AGENT_DEVICE_BUSY', 'Stop collection, playback and HaLow reception, then close existing or reconnecting ports before connecting');
    if (state.currentSystemId !== input.expectedCurrentSystemId || state.currentSensorType !== input.expectedCurrentSensorType) throw connectionError('AGENT_RUNTIME_CONFLICT', 'Current system changed after this connection proposal was prepared');
    const system = getSystem(input.systemId);
    const editor = getEditor(input.systemId);
    if (!system || !editor?.revision) throw connectionError('AGENT_SYSTEM_NOT_FOUND', 'Target system is not available', 404);
    if (system.kind === 'builtin-template') throw connectionError('AGENT_BINDING_UNSUPPORTED', '原生模板请使用页面中的设备控件连接串口');
    if (editor.revision !== input.expectedRevision) throw connectionError('DISPLAY_SYSTEM_REVISION_CONFLICT', 'Target configuration changed after this connection proposal was prepared');
    const sensorTypes = [system.id, system.sensor?.type, ...(system.sensors || []).map((sensor) => sensor.type)];
    if (state.licenseScope !== 'all' && sensorTypes.some((type) => BUILTIN_TYPES.has(type) && !state.licenseScope?.includes(type))) throw connectionError('LICENSE_SCOPE_REQUIRED', 'The license does not include this built-in sensor type', 403);
    const channels = listSerialChannels(input.systemId) || [];
    const matches = channels.filter((channel) => channel.displaySystemId === input.systemId && channel.sensorId === input.sensorId && channel.channelId === `${input.systemId}:${input.sensorId}`);
    if (matches.length !== 1 || channels.some((channel) => channel.displaySystemId !== input.systemId)) throw connectionError('AGENT_BINDING_UNAVAILABLE', 'Target sensor does not resolve to a unique declared system binding');
    const selected = matches[0];
    if (['seat', 'sensor'].includes(selected.serialRole) || input.systemId === 'minzhen') throw connectionError('AGENT_BINDING_UNSUPPORTED', 'This legacy serial role requires the existing device controls');
    const steps = [];
    /** 执行固定命令并检查 handler 摘要；任何派发后的失败都保留副作用不确定状态。 */
    function dispatch(type, payload, suffix) {
      const result = controlCommandService.executeHttp({ type, payload, requestId: `${input.requestId}:${suffix}` }, { scope: 'agent-device' });
      if (!result?.ok || !result.handled) throw connectionError('AGENT_OPERATION_UNCERTAIN', 'Device command failed after dispatch; inspect the active system and port state before retrying');
      steps.push(type);
    }
    // ⚠️ 从上述快照检查到两次派发结束之间不得 await，否则可能中断刚开始的采集。
    try {
      if (state.currentSystemId !== input.systemId || state.currentSensorType !== input.systemId) dispatch('sensor.switch', { sensorType: input.systemId }, 'activate');
      const active = snapshot();
      if (!active.idle || active.currentSystemId !== input.systemId) throw connectionError('AGENT_OPERATION_UNCERTAIN', 'Target activation did not produce the expected idle system');
      dispatch('serial.open', { role: selected.serialRole, path: input.portPath }, 'open');
      return { requestId: input.requestId, accepted: true, systemId: input.systemId, sensorId: input.sensorId, channelId: selected.channelId, serialRole: selected.serialRole, portPath: input.portPath, steps,
        connected: false, liveVerified: false, verification: 'Commands accepted; physical open and realtime frames still require verification.' };
    } catch (cause) {
      const error = connectionError('AGENT_OPERATION_UNCERTAIN', 'Activation or connection may have partially completed; no automatic rollback was attempted');
      error.details = { completedCommands: steps, causeCode: cause.code || 'COMMAND_EXECUTION_FAILED' };
      throw error;
    }
  }

  return { snapshot, connect, validateRequest: validateAgentConnectionRequest };
}

module.exports = { createAgentDeviceConnectionService, validateAgentConnectionRequest };
