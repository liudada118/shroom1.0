const API_VERSION = 'v1';
const SDK_CONTRACT_VERSION = '2026-09-01';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const multiSensorStableContract = deepFreeze(require('./multiSensorStableContract.json'));
const SENSOR_FRAME_SCHEMA_VERSION = multiSensorStableContract.frame.schemaVersion;
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
  agentApps: '/api/agent-apps',
  agentAppReload: '/api/agent-apps/reload',
  agentAppPolicy: '/api/agent-apps/policy',
  agentAppFiles: '/api/agent-apps/:id/files/*',
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
  serialProtocolDetect: '/api/serial/protocol-detect',
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

const DISPLAY_SYSTEM_SCHEMA_VERSION = multiSensorStableContract.manifest.schemaVersion;

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
    stableContracts: {
      multiSensor: {
        name: multiSensorStableContract.contractName,
        version: multiSensorStableContract.contractVersion,
        status: multiSensorStableContract.status,
        compatibilityPolicy: multiSensorStableContract.compatibilityPolicy,
      },
    },
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
        sensorLabel: 'string',
        sensorType: 'string',
        outputChannel: 'string',
        source: 'realtime|playback',
        sequence: 'number',
        timestamp: 'number',
        quality: 'good|stale|error',
        serial: 'object|null',
        payload: {
          value: '(finite number|null)[]',
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
    agentApps: {
      capability: 'sandboxed-renderer-apps',
      schemaVersion: 1,
      rendererIdPattern: 'agent:<appId>',
      permissions: ['sensor.read'],
      routes: {
        list: HTTP_ROUTES.agentApps,
        install: HTTP_ROUTES.agentApps,
        reload: HTTP_ROUTES.agentAppReload,
        policy: HTTP_ROUTES.agentAppPolicy,
        files: HTTP_ROUTES.agentAppFiles,
      },
      installShape: {
        manifest: 'AgentAppManifestV1',
        files: [{ path: 'package-relative string', encoding: 'utf8|base64', content: 'string' }],
        overwrite: 'boolean (optional; defaults to false)',
      },
      writeOriginPolicy: 'browser Origin must be loopback; native local clients without Origin are allowed',
      descriptorShape: {
        id: 'string',
        name: 'string',
        version: 'semantic-version string',
        rendererId: 'agent:<appId>',
        renderer: {
          id: 'string',
          label: 'string',
          entry: 'package-relative string',
          height: 'integer 160..2000',
        },
        permissions: ['sensor.read'],
        entryUrl: '/api/agent-apps/:id/files/*',
        editable: true,
      },
      limits: {
        maximumFiles: 128,
        maximumDecodedBytesPerFile: 25165824,
        maximumDecodedBytesTotal: 33554432,
        maximumPortableRelativePathLength: 240,
      },
      errorCodes: [
        'AGENT_APP_INVALID',
        'AGENT_APP_EXISTS',
        'AGENT_APP_NOT_FOUND',
        'AGENT_APP_FILE_INVALID',
        'AGENT_APP_FILE_NOT_FOUND',
        'AGENT_APP_LIMIT_EXCEEDED',
        'AGENT_APP_INSTALL_FAILED',
        'AGENT_APP_DISCOVERY_FAILED',
        'AGENT_APP_POLICY_NOT_FOUND',
        'AGENT_APP_POLICY_INVALID',
        'AGENT_APP_SERVICE_UNAVAILABLE',
        'AGENT_APP_REQUEST_FAILED',
        'AGENT_APP_ORIGIN_FORBIDDEN',
      ],
      messageProtocol: {
        transport: 'window.postMessage',
        schemaVersion: 1,
        envelope: {
          type: 'shroom.renderer.*',
          schemaVersion: 1,
          payload: 'JSON-safe object',
        },
        hostToRenderer: {
          init: 'shroom.renderer.init',
          frame: 'shroom.renderer.frame',
        },
        rendererToHost: {
          ready: 'shroom.renderer.ready',
          error: 'shroom.renderer.error',
        },
      },
    },
    serial: {
      roles: listSerialRoles(),
      aliases: SERIAL_ROLE_ALIASES,
      status: serialStatus,
      // 可用的串口协议预设摘要。完整的 protocol 段走 GET /api/serial/protocols，
      // 这里只给 id/label，让 SDK 不用先拉一遍列表就知道有哪些预设可选。
      protocolPresets,
      protocolDetection: {
        route: HTTP_ROUTES.serialProtocolDetect,
        statuses: ['matched', 'ambiguous', 'unknown'],
        errorCodes: [
          'SERIAL_PATH_REQUIRED',
          'INVALID_CANDIDATE_IDS',
          'UNKNOWN_PROTOCOL_PRESET',
          'SERIAL_PORT_BUSY',
          'SERIAL_STATUS_UNAVAILABLE',
          'SERIAL_PROTOCOL_PROBE_FAILED',
          'SERIAL_PROTOCOL_DETECT_FAILED',
        ],
      },
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
        schemaVersion: '1|2|3 (3 recommended)',
        id: 'string',
        name: 'string',
        version: 'string',
        sensors: [{
          id: 'string (required in schema v3; v1/v2 defaults to array index; unique; must not contain ":")',
          label: 'string (optional; defaults to id)',
          outputChannel: 'string (optional; defaults to id; unique)',
          type: 'string',
          matrix: {
            rows: 'positive integer',
            cols: 'positive integer',
          },
          files: {
            lineOrder: 'string',
            pointOrder: 'string',
            coordinateMap: 'string|null',
          },
          protocol: {
            validation: {
              headerOffset: 'non-negative integer',
              header: 'byte[]',
              checksum: {
                type: 'sum8|xor8|crc16-modbus',
                byteOffset: 'integer',
                range: '[integer, integer]|null',
              },
            },
            baudRate: 'positive integer',
            framing: {
              type: 'delimiter|fixedLength',
              delimiter: 'byte[]',
              frameLength: 'positive integer|null',
              includeDelimiter: 'boolean',
            },
            decoding: {
              valueType: 'uint8|int8|uint16le|uint16be|int16le|int16be|uint32le|uint32be|int32le|int32be|float32le|float32be|bit',
              byteOffset: 'non-negative integer',
              valueCount: 'positive integer|null',
            },
          },
          algorithm: {
            type: 'none|json|js|python|external',
            entry: 'string|null',
            dataFile: 'string|null',
            input: 'object',
            output: 'object',
            timeoutMs: 'positive integer',
          },
          stored: 'boolean (optional; defaults to true)',
        }],
        legacyCompatibility: {
          supportedSchemaVersions: [1, 2],
          behavior: 'sensor.ports[] is normalized to sensors[]; each generated sensor inherits top-level files/protocol/algorithm',
        },
        // schema v1/v2 的单传感器声明仍受支持，并会在后端统一升格为 sensors[]。
        sensor: {
          type: 'string',
          label: 'string|null',
          matrix: {
            rows: 'positive integer',
            cols: 'positive integer',
          },
          ports: 'string[]',
          portLabels: 'Record<string, string>',
        },
        files: {
          lineOrder: 'string',
          pointOrder: 'string',
          coordinateMap: 'string|null',
        },
        protocol: {
          baudRate: 'positive integer',
          framing: {
            type: 'delimiter|fixedLength',
            delimiter: 'byte[]',
            frameLength: 'positive integer|null',
            includeDelimiter: 'boolean',
          },
          decoding: {
            valueType: 'uint8|int8|uint16le|uint16be|int16le|int16be|uint32le|uint32be|int32le|int32be|float32le|float32be|bit',
            byteOffset: 'non-negative integer',
            valueCount: 'positive integer|null',
          },
        },
        algorithm: {
          type: 'none|json|js|python|external',
          entry: 'string|null',
          dataFile: 'string|null',
          input: 'object',
          output: 'object',
          timeoutMs: 'positive integer',
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
  multiSensorStableContract,
  normalizeSerialRole,
};
