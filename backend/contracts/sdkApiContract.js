const API_VERSION = 'v1';
const SDK_CONTRACT_VERSION = '2026-07-03';

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
  commands: '/api/commands',
  serialPorts: '/api/serial/ports',
  serialStatus: '/api/serial/status',
  serialOpen: '/api/serial/open',
  serialClose: '/api/serial/close',
  serialExchange: '/api/serial/exchange',
  serialRefresh: '/api/serial/refresh',
  serialAutoConnectHandGloveDouble: '/api/serial/auto-connect-hand-glove-double',
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
});

const TELEMETRY_METRICS = Object.freeze({
  PRESSURE: 'pressure',
});

const TELEMETRY_QUALITY = Object.freeze({
  GOOD: 'good',
  STALE: 'stale',
  ERROR: 'error',
});

const DISPLAY_SYSTEM_SCHEMA_VERSION = 1;

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
  serialStatus = {},
  subscriptions = {},
} = {}) {
  return {
    apiVersion: API_VERSION,
    contractVersion: SDK_CONTRACT_VERSION,
    http: {
      basePath: '/api',
      routes: HTTP_ROUTES,
      controlTransport: 'http',
    },
    websocket: {
      realtimeTransport: 'websocket',
      messageTypes: WS_MESSAGE_TYPES,
      subscribeExample: {
        type: WS_MESSAGE_TYPES.SUBSCRIBE,
        channels: ['sit'],
      },
      unsubscribeExample: {
        type: WS_MESSAGE_TYPES.UNSUBSCRIBE,
        channels: ['sit'],
      },
    },
    telemetry: {
      metrics: TELEMETRY_METRICS,
      quality: TELEMETRY_QUALITY,
      channelIdPattern: '{sensorType}_{portId}.{metric}',
      frameShape: {
        channelId: 'string',
        deviceId: 'string',
        portId: 'sit|back|head|sensor',
        metric: 'pressure',
        value: 'number[]',
        unit: 'string',
        timestamp: 'number',
        quality: 'good|stale|error',
        metadata: 'object',
      },
      channels,
    },
    serial: {
      roles: listSerialRoles(),
      aliases: SERIAL_ROLE_ALIASES,
      status: serialStatus,
    },
    displaySystems: {
      schemaVersion: DISPLAY_SYSTEM_SCHEMA_VERSION,
      manifestFiles: DISPLAY_SYSTEM_MANIFEST_FILES,
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
        algorithm: {
          type: 'none|js|python|external',
          entry: 'string|null',
          dataFile: 'string|null',
        },
        display: 'object',
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
  SERIAL_ROLES,
  SERIAL_ROLE_ALIASES,
  TELEMETRY_METRICS,
  TELEMETRY_QUALITY,
  WS_MESSAGE_TYPES,
  buildSdkContractSnapshot,
  listSerialRoles,
  normalizeSerialRole,
};

