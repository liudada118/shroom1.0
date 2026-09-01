// These values are part of the frozen shroom.multi-sensor v1 contract. The
// package-export test compares them with the JSON/CJS contract so this browser
// ESM entry stays synchronous and does not depend on experimental JSON modules.
const SENSOR_FRAME_TYPE = 'sensor.frame';
const SENSOR_FRAME_SCHEMA_VERSION = 1;
const SENSOR_CHANNEL_SEPARATOR = ':';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isTrimmedNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isIdentityPart(value) {
  return isTrimmedNonEmptyString(value) && !value.includes(SENSOR_CHANNEL_SEPARATOR);
}

function isSensorFrameValue(value) {
  return Array.isArray(value) && value.every(
    (item) => item === null || (typeof item === 'number' && Number.isFinite(item)),
  );
}

function isDeclaredSensorFrame(value) {
  return isObject(value) && value.type === SENSOR_FRAME_TYPE;
}

function isSensorFrameV1Envelope(value) {
  if (!isDeclaredSensorFrame(value)
    || value.schemaVersion !== SENSOR_FRAME_SCHEMA_VERSION
    || !isObject(value.payload)
    || !isSensorFrameValue(value.payload.value)) return false;

  const {
    displaySystemId,
    sensorId,
    channelId,
    outputChannel,
  } = value;
  return isIdentityPart(displaySystemId)
    && isIdentityPart(sensorId)
    && isTrimmedNonEmptyString(outputChannel)
    && channelId === `${displaySystemId}${SENSOR_CHANNEL_SEPARATOR}${sensorId}`;
}

const sensorFrameV1Contract = Object.freeze({
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  isDeclaredSensorFrame,
  isSensorFrameV1Envelope,
  isSensorFrameValue,
});

export {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  isDeclaredSensorFrame,
  isSensorFrameV1Envelope,
  isSensorFrameValue,
};

export default sensorFrameV1Contract;
