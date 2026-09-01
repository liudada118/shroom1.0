const {
  ALGORITHM_TYPES,
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS,
  validateDisplaySystemConfig,
} = require('./manifest/displaySystemConfigValidator');
const {
  PROTOCOL_FRAMING_TYPES,
  PROTOCOL_VALUE_TYPES,
  decodeProtocolValues,
  normalizeProtocolConfig,
  parseByteSequence,
  validateProtocolConfig,
} = require('@shroom/backend/protocol/displaySystemProtocol.js');
const {
  DEFAULT_RENDERER_TYPES,
  MATRIX_TRANSFORM_TYPES,
  normalizeCanvasConfig,
  normalizeChartAppearanceConfig,
  normalizeChartCardsConfig,
  normalizeDisplayConfig,
  normalizeMatrixTransform,
  normalizeProfile,
  normalizeView,
  validateDisplayConfig,
} = require('./manifest/displaySystemPage');
const {
  CANVAS_COLORMAPS,
  CANVAS_OVERLAYS,
  CHART_OVERLAYS,
  DISPLAY_CHART_CARD_LIMIT,
} = require('./manifest/displaySystemCanvasCatalog');
const {
  validateAlgorithmDataDefinition,
  validateCoordinateMapDefinition,
  validateDisplaySystemDefinitionFiles,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
} = require('./manifest/displaySystemConfigFileValidator');
const {
  canonicalizeCoordinateMapDefinition,
  getCoordinateMatrix,
  normalizeCoordinateMapDefinition,
} = require('./manifest/displaySystemCoordinateMap');
const {
  DEFAULT_MANIFEST_FILENAMES,
  discoverDisplaySystems,
  findManifestFile,
  loadDisplaySystemDirectory,
  resolveDisplaySystemFiles,
} = require('./manifest/displaySystemConfigLoader');
const {
  buildDisplayMetadataFromDisplaySystem,
  buildDisplaySystemRuntimeDefinition,
  buildParserChannelDefinitionsFromDisplaySystem,
  buildSensorDefinitionFromDisplaySystem,
} = require('./manifest/displaySystemDefinitionBuilder');
const {
  createDisplaySystemRegistry,
} = require('./runtime/displaySystemRegistry');
const {
  buildDisplaySystemRoots,
  classifyDisplaySystemAccess,
  createDisplaySystemRuntimeDiscovery,
  resolveDisplaySystemAccessConflicts,
} = require('./runtime/displaySystemRuntimeDiscovery');
const {
  attachRuntimeChannelPlan,
  buildRuntimeChannelPlan,
} = require('./runtime/displaySystemRuntimeChannelPlanner');
const {
  bindDisplaySystemRuntimeChannels,
  resolveOutputPublisher,
  resolveParserChannel,
} = require('./runtime/displaySystemRuntimeBinder');
const {
  applyNumericConfig,
  createDisplaySystemFrameProcessor,
  getFrameValues,
} = require('./runtime/displaySystemFrameProcessorFactory');
const {
  createDisplaySystemRuntimeRegistry,
} = require('./runtime/displaySystemRuntimeRegistry');
const {
  createDisplaySystemRuntimeDispatcher,
  normalizeIncomingFrame,
} = require('./runtime/displaySystemRuntimeDispatcher');
const {
  DEFAULT_LEGACY_PARSER_CHANNELS,
  evaluateDisplaySystemDispatchPolicy,
} = require('./runtime/displaySystemRuntimePolicy');
const {
  createJavaScriptAlgorithmRunner,
  createPythonAlgorithmRunner,
} = require('../kernel/algorithm-channel/displaySystemAlgorithmRunner');
const {
  DEFAULT_ALGORITHM_SOURCES,
  buildDisplaySystemBuilderCatalog,
  createDisplaySystemWorkspaceService,
  createIdentityDefinitions,
  validateBuilderAlgorithmSource,
} = require('./workspace/displaySystemWorkspaceService');
const {
  AGENT_APP_ALLOWED_PERMISSIONS,
  AGENT_APP_ID_PATTERN,
  AGENT_APP_SCHEMA_VERSION,
  AgentAppError,
  createAgentAppService,
  normalizeAgentAppManifest,
} = require('./agent-apps/agentAppService');

module.exports = {
  AGENT_APP_ALLOWED_PERMISSIONS,
  AGENT_APP_ID_PATTERN,
  AGENT_APP_SCHEMA_VERSION,
  ALGORITHM_TYPES,
  CANVAS_COLORMAPS,
  CANVAS_OVERLAYS,
  CHART_OVERLAYS,
  DISPLAY_CHART_CARD_LIMIT,
  DEFAULT_MANIFEST_FILENAMES,
  DEFAULT_LEGACY_PARSER_CHANNELS,
  DEFAULT_ALGORITHM_SOURCES,
  DEFAULT_RENDERER_TYPES,
  MATRIX_TRANSFORM_TYPES,
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS,
  PROTOCOL_FRAMING_TYPES,
  PROTOCOL_VALUE_TYPES,
  applyNumericConfig,
  AgentAppError,
  bindDisplaySystemRuntimeChannels,
  buildDisplaySystemRoots,
  classifyDisplaySystemAccess,
  resolveDisplaySystemAccessConflicts,
  buildDisplaySystemBuilderCatalog,
  buildDisplayMetadataFromDisplaySystem,
  buildDisplaySystemRuntimeDefinition,
  buildParserChannelDefinitionsFromDisplaySystem,
  buildRuntimeChannelPlan,
  buildSensorDefinitionFromDisplaySystem,
  attachRuntimeChannelPlan,
  canonicalizeCoordinateMapDefinition,
  createDisplaySystemFrameProcessor,
  createAgentAppService,
  createJavaScriptAlgorithmRunner,
  createPythonAlgorithmRunner,
  createDisplaySystemRuntimeDispatcher,
  createDisplaySystemRegistry,
  createDisplaySystemRuntimeRegistry,
  createDisplaySystemRuntimeDiscovery,
  createDisplaySystemWorkspaceService,
  createIdentityDefinitions,
  decodeProtocolValues,
  discoverDisplaySystems,
  evaluateDisplaySystemDispatchPolicy,
  findManifestFile,
  getFrameValues,
  getCoordinateMatrix,
  normalizeIncomingFrame,
  normalizeCoordinateMapDefinition,
  normalizeCanvasConfig,
  normalizeChartAppearanceConfig,
  normalizeChartCardsConfig,
  normalizeDisplayConfig,
  normalizeMatrixTransform,
  normalizeProfile,
  normalizeProtocolConfig,
  normalizeView,
  normalizeAgentAppManifest,
  parseByteSequence,
  loadDisplaySystemDirectory,
  resolveOutputPublisher,
  resolveParserChannel,
  resolveDisplaySystemFiles,
  validateAlgorithmDataDefinition,
  validateBuilderAlgorithmSource,
  validateCoordinateMapDefinition,
  validateDisplaySystemConfig,
  validateDisplaySystemDefinitionFiles,
  validateDisplayConfig,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
  validateProtocolConfig,
};
