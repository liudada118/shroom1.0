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

function validatePayloadRule(type, field, value, rule) {
  const label = `${type} payload.${field}`;
  if (rule.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  if (rule.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${label} must be a string`);
    if ((rule.minLength || 0) > value.length) throw new Error(`${label} is too short`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) throw new Error(`${label} has an invalid format`);
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    if ((rule.minItems || 0) > value.length) throw new Error(`${label} must not be empty`);
    if (rule.uniqueItems && new Set(value).size !== value.length) throw new Error(`${label} must contain unique items`);
    value.forEach((item, index) => validatePayloadRule(type, `${field}[${index}]`, item, rule.items || {}));
  }
}

function validatePayload(type, payload, definition) {
  const properties = definition.properties || {};
  if (definition.additionalProperties === false) {
    const unexpected = Object.keys(payload).filter((field) => !(field in properties));
    if (unexpected.length) throw new Error(`${type} payload contains unsupported field(s): ${unexpected.join(', ')}`);
  }
  Object.entries(properties).forEach(([field, rule]) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      validatePayloadRule(type, field, payload[field], rule);
    }
  });
}

export function createCommand(type, payload = {}, requestId = createRequestId()) {
  const definition = schema.commands[type];
  if (!definition) throw new Error(`unsupported command type: ${type}`);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('command payload must be an object');
  }
  const missing = (definition.required || []).filter((field) => payload[field] == null);
  if (missing.length) throw new Error(`missing required payload field(s): ${missing.join(', ')}`);
  validatePayload(type, payload, definition);
  if (!requestId) throw new Error('command requestId is required');
  return { type, payload, requestId };
}
