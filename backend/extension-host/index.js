const {
  ALGORITHM_TYPES,
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS,
  validateDisplaySystemConfig,
} = require('./displaySystemConfigValidator');
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
} = require('./displaySystemPage');
const {
  CANVAS_COLORMAPS,
  CANVAS_OVERLAYS,
  CHART_OVERLAYS,
  DISPLAY_CHART_CARD_LIMIT,
} = require('./displaySystemCanvasCatalog');
const {
  validateAlgorithmDataDefinition,
  validateCoordinateMapDefinition,
  validateDisplaySystemDefinitionFiles,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
} = require('./displaySystemConfigFileValidator');
const {
  canonicalizeCoordinateMapDefinition,
  getCoordinateMatrix,
  normalizeCoordinateMapDefinition,
} = require('./displaySystemCoordinateMap');
const {
  DEFAULT_MANIFEST_FILENAMES,
  discoverDisplaySystems,
  findManifestFile,
  loadDisplaySystemDirectory,
  resolveDisplaySystemFiles,
} = require('./displaySystemConfigLoader');
const {
  buildDisplayMetadataFromDisplaySystem,
  buildDisplaySystemRuntimeDefinition,
  buildParserChannelDefinitionsFromDisplaySystem,
  buildSensorDefinitionFromDisplaySystem,
} = require('./displaySystemDefinitionBuilder');
const {
  createDisplaySystemRegistry,
} = require('./displaySystemRegistry');
const {
  buildDisplaySystemRoots,
  classifyDisplaySystemAccess,
  createDisplaySystemRuntimeDiscovery,
  resolveDisplaySystemAccessConflicts,
} = require('./displaySystemRuntimeDiscovery');
const {
  attachRuntimeChannelPlan,
  buildRuntimeChannelPlan,
} = require('./displaySystemRuntimeChannelPlanner');
const {
  bindDisplaySystemRuntimeChannels,
  resolveOutputPublisher,
  resolveParserChannel,
} = require('./displaySystemRuntimeBinder');
const {
  applyNumericConfig,
  createDisplaySystemFrameProcessor,
  getFrameValues,
} = require('./displaySystemFrameProcessorFactory');
const {
  createDisplaySystemRuntimeRegistry,
} = require('./displaySystemRuntimeRegistry');
const {
  createDisplaySystemRuntimeDispatcher,
  normalizeIncomingFrame,
} = require('./displaySystemRuntimeDispatcher');
const {
  DEFAULT_LEGACY_PARSER_CHANNELS,
  evaluateDisplaySystemDispatchPolicy,
} = require('./displaySystemRuntimePolicy');
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
} = require('./displaySystemWorkspaceService');

module.exports = {
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
