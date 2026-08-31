const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '../..');
const testFiles = [
  'backend/tests/processing/lineOrders.test.js',
  'backend/tests/processing/videoPointMappings.test.js',
  'backend/tests/processing/pressureTransforms.test.js',
  'backend/tests/processing/configMappingExecutor.test.js',
  'backend/tests/displaySystems/runtimeChannelPlanner.test.js',
  'backend/tests/displaySystems/runtimeBinding.test.js',
  'backend/tests/displaySystems/runtimeDispatcher.test.js',
  'backend/tests/displaySystems/runtimePolicy.test.js',
  'backend/tests/displaySystems/configValidation.test.js',
  'backend/tests/displaySystems/displayChartConfig.test.js',
  'backend/tests/displaySystems/multiSensorManifest.test.js',
  'backend/tests/displaySystems/protocolValidation.test.js',
  'backend/tests/displaySystems/workspaceService.test.js',
  'backend/tests/displaySystems/extensionHostBoundaries.test.js',
  'backend/tests/collection/collectionDiskSpaceGuard.test.js',
  'backend/tests/csv/csvDownloadService.test.js',
  'backend/tests/serial/serialParserManager.test.js',
  'backend/tests/serial/serialProtocolPresets.test.js',
  'backend/tests/serial/serialPortOrchestrator.test.js',
  'backend/tests/application/serialControlService.test.js',
  'backend/tests/http/displaySystemsApi.test.js',
  'backend/tests/http/serialProtocolsApi.test.js',
  'backend/tests/http/commandApi.test.js',
  'backend/tests/platform/controlCommandRouter.test.js',
  'backend/tests/platform/zeroCommandService.test.js',
  'backend/tests/ws/websocketChannelService.test.js',
  'backend/tests/ws/websocketTransportService.test.js',
  'backend/tests/ws/websocketSubscriptionService.test.js',
  'backend/tests/ws/realtimeTelemetryGateway.test.js',
  'backend/tests/platform/serverPathConfig.test.js',
  'backend/tests/sdk/backendPackageInvariants.test.js',
  'backend/tests/sdk/backendSdkClient.test.js',
  'backend/tests/sdk/backendCommandRouter.test.js',
  'backend/tests/sdk/frontendDisplayRegistry.test.js',
  'backend/tests/sdk/displayProfileRuntime.test.js',
  'backend/tests/sdk/serialChainDemo.test.js',
  'backend/tests/server/displaySystemRuntimeFactory.test.js',
  'backend/tests/server/appRuntimeDisplaySystems.test.js',
  'backend/tests/server/framePipelineFactory.test.js',
  'backend/tests/server/zeroFrameAdapter.test.js',
  'backend/tests/server/zeroStateStore.test.js',
  'backend/tests/server/playbackFrameService.test.js',
  'backend/tests/playback/channelPlaybackService.test.js',
  'backend/tests/server/handRuntimeFactory.test.js',
  'backend/tests/server/runtimeContextFactory.test.js',
  'backend/tests/server/runtimeStatePatchFactory.test.js',
  'backend/tests/server/runtimeStateStoreFactory.test.js',
  'backend/tests/server/runtimeFactories.test.js',
  'backend/tests/server/serverShutdownOrchestrator.test.js',
  'backend/tests/server/webSocketHandlerFactory.test.js',
  'backend/tests/server/sensorProcessorFactory.test.js',
  'backend/tests/server/legacySerialFrameRuntimeState.test.js',
  'backend/tests/server/smallBedRuntimeFactory.test.js',
  'backend/tests/server/jqbedAlgorithmConfig.test.js',
  'backend/tests/server/jqbedAlgorithmProtocol.test.js',
  'backend/tests/server/petCareRuntimeService.test.js',
  'backend/tests/sensors/runtime/legacyGloveFrameProcessor.test.js',
];

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [path.resolve(projectRoot, testFile)], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`All ${testFiles.length} test files passed`);
