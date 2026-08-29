const API_VERSION = 'v1';
const SDK_CONTRACT_VERSION = '2026-08-29';
const SENSOR_FRAME_SCHEMA_VERSION = 1;
const commandSchema = require('./commandSchema.json');

const SERIAL_ROLES = Object.freeze({
  SIT: 'sit',
  BACK: 'back',
  HEAD: 'head',
  SENSOR: 'sensor',
});

const SERIAL_ROLE_ALIASES = Object.freeze({
  seat: SERIAL_ROLES.SIT,
});

const HTTP_ROUTES = Object.freeze({
  channels: '/api/channels',
  wsStatus: '/api/ws/status',
  sdkContract: '/api/sdk/contract',
    displaySystems: '/api/display-systems',
    displaySystemById: '/api/display-systems/:id',
    displaySystemCatalog: '/api/display-systems/catalog',
    displaySystemEditor: '/api/display-systems/:id/editor',
    displaySystemReload: '/api/display-systems/reload',
    displaySystemDisplaySection: '/api/display-systems/:id/display',
    displaySystemDuplicate: '/api/display-systems/:id/duplicate',
  commands: '/api/commands',
  serialPorts: '/api/serial/ports',
  serialStatus: '/api/serial/status',
  serialOpen: '/api/serial/open',
  serialClose: '/api/serial/close',
  serialExchange: '/api/serial/exchange',
  serialRefresh: '/api/serial/refresh',
  serialAutoConnectHandGloveDouble: '/api/serial/auto-connect-hand-glove-double',
  serialProtocols: '/api/serial/protocols',
  sensorCurrent: '/api/sensor/current',
  sensorType: '/api/sensor/type',
  historyLoad: '/api/history/load',
  playbackControl: '/api/playback/control',
  collectionStart: '/api/collection/start',
  collectionStop: '/api/collection/stop',
  exportCsv: '/api/export/csv',
});

const WS_MESSAGE_TYPES = Object.freeze({
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SUBSCRIPTIONS: 'subscriptions',
  SENSOR_FRAME: 'sensor.frame',
});

const TELEMETRY_METRICS = Object.freeze({
  PRESSURE: 'pressure',
});

const TELEMETRY_QUALITY = Object.freeze({
  GOOD: 'good',
  STALE: 'stale',
  ERROR: 'error',
});

const DISPLAY_SYSTEM_SCHEMA_VERSION = 2;

const DISPLAY_SYSTEM_MANIFEST_FILES = Object.freeze([
  'display-system.json',
  'system.json',
]);

function normalizeSerialRole(role) {
  const normalized = String(role || '').trim();
  if (!normalized) return '';
  return SERIAL_ROLE_ALIASES[normalized] || normalized;
}

function listSerialRoles() {
  return Object.values(SERIAL_ROLES);
}

function buildSdkContractSnapshot({
  channels = [],
  displaySystems = {},
  serialStatus = {},
  subscriptions = {},
  protocolPresets = [],
} = {}) {
  return {
    apiVersion: API_VERSION,
    contractVersion: SDK_CONTRACT_VERSION,
    http: {
      basePath: '/api',
      routes: HTTP_ROUTES,
      controlTransport: 'http',
      commandSchema,
      commandAckShape: {
        type: 'command.ack',
        requestId: 'string',
        commandType: 'string',
        status: 'accepted|rejected',
        ok: 'boolean',
        code: 'string',
        message: 'string',
        data: 'object?',
      },
    },
    websocket: {
      realtimeTransport: 'websocket',
      acceptsControlCommands: false,
      messageTypes: WS_MESSAGE_TYPES,
      subscribeExample: {
        type: WS_MESSAGE_TYPES.SUBSCRIBE,
        channels: ['car:sit'],
      },
      unsubscribeExample: {
        type: WS_MESSAGE_TYPES.UNSUBSCRIBE,
        channels: ['car:sit'],
      },
    },
    telemetry: {
      frameType: WS_MESSAGE_TYPES.SENSOR_FRAME,
      schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
      metrics: TELEMETRY_METRICS,
      quality: TELEMETRY_QUALITY,
      channelIdPattern: '{displaySystemId}:{sensorId}',
      frameShape: {
        type: 'sensor.frame',
        schemaVersion: '1',
        channelId: 'string',
        displaySystemId: 'string',
        sensorId: 'string',
        sensorType: 'string',
        outputChannel: 'string',
        source: 'realtime|playback',
        sequence: 'number',
        timestamp: 'number',
        quality: 'good|stale|error',
        payload: {
          value: 'number[]',
          stages: {
            decoded: 'number[]|null',
            normalized: 'number[]|null',
            calibrated: 'number[]|null',
            processed: 'number[]|null',
            mapped: 'number[]|null',
          },
          metrics: 'object',
          algorithmMetrics: 'object',
          matrix: 'object|null',
          orientation: 'number[]|null',
          status: 'object|null',
          temperature: 'object|null',
          protocol: 'object|null',
          history: 'object|null',
        },
      },
      channels,
    },
    serial: {
      roles: listSerialRoles(),
      aliases: SERIAL_ROLE_ALIASES,
      status: serialStatus,
      // 可用的串口协议预设摘要。完整的 protocol 段走 GET /api/serial/protocols，
      // 这里只给 id/label，让 SDK 不用先拉一遍列表就知道有哪些预设可选。
      protocolPresets,
    },
    displaySystems: {
      schemaVersion: DISPLAY_SYSTEM_SCHEMA_VERSION,
      manifestFiles: DISPLAY_SYSTEM_MANIFEST_FILES,
      routes: {
        list: HTTP_ROUTES.displaySystems,
        detail: HTTP_ROUTES.displaySystemById,
        catalog: HTTP_ROUTES.displaySystemCatalog,
        editor: HTTP_ROUTES.displaySystemEditor,
        reload: HTTP_ROUTES.displaySystemReload,
      },
      status: displaySystems,
      manifestShape: {
        id: 'string',
        name: 'string',
        version: 'string',
        sensor: {
          type: 'string',
          matrix: {
            rows: 'positive integer',
            cols: 'positive integer',
          },
          ports: 'string[]',
        },
        files: {
          lineOrder: 'string',
          pointOrder: 'string',
        },
        protocol: {
          baudRate: 'positive integer',
          framing: {
            type: 'delimiter|fixedLength',
            delimiter: 'byte[]',
            frameLength: 'positive integer|null',
          },
          decoding: {
            valueType: 'uint8|int8|uint16le|uint16be|int16le|int16be',
            byteOffset: 'non-negative integer',
            valueCount: 'positive integer|null',
          },
        },
        algorithm: {
          type: 'none|js|python|external',
          entry: 'string|null',
          dataFile: 'string|null',
        },
        display: {
          layout: 'object|string',
          views: 'DisplayView[]',
            widgets: 'DisplayWidget[]',
            controls: 'object|array',
            defaultView: 'string',
            renderers: 'DisplayRenderer[]',
            visualizationAlgorithms: 'DisplayVisualizationAlgorithm[]',
            profiles: 'DisplayProfile[]',
            defaultProfile: 'string',
          },
      },
    },
    subscriptions,
  };
}

module.exports = {
  API_VERSION,
  DISPLAY_SYSTEM_MANIFEST_FILES,
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  HTTP_ROUTES,
  SDK_CONTRACT_VERSION,
  SENSOR_FRAME_SCHEMA_VERSION,
  SERIAL_ROLES,
  SERIAL_ROLE_ALIASES,
  TELEMETRY_METRICS,
  TELEMETRY_QUALITY,
  WS_MESSAGE_TYPES,
  buildSdkContractSnapshot,
  listSerialRoles,
  normalizeSerialRole,
};
