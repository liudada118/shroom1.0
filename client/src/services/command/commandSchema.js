import schema from '../../../../shared/commandSchema.json';

export const commandSchema = Object.freeze(schema);
export const COMMAND_TYPES = Object.freeze(
  Object.keys(schema.commands).reduce((types, type) => {
    types[type.replace(/[^a-zA-Z0-9]+(.)/g, (_, value) => value.toUpperCase())] = type;
    return types;
  }, {}),
);

export function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCommand(type, payload = {}, requestId = createRequestId()) {
  const definition = schema.commands[type];
  if (!definition) throw new Error(`unsupported command type: ${type}`);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('command payload must be an object');
  }
  const missing = (definition.required || []).filter((field) => payload[field] == null);
  if (missing.length) throw new Error(`missing required payload field(s): ${missing.join(', ')}`);
  if (!requestId) throw new Error('command requestId is required');
  return { type, payload, requestId };
}
