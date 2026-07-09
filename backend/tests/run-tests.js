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
  'backend/tests/serial/serialParserManager.test.js',
  'backend/tests/http/displaySystemsApi.test.js',
  'backend/tests/ws/webSocketCommandRouter.test.js',
  'backend/tests/sdk/backendSdkClient.test.js',
  'backend/tests/sdk/serialChainDemo.test.js',
  'backend/tests/server/displaySystemRuntimeFactory.test.js',
  'backend/tests/server/framePipelineFactory.test.js',
  'backend/tests/server/handRuntimeFactory.test.js',
  'backend/tests/server/runtimeContextFactory.test.js',
  'backend/tests/server/runtimeStatePatchFactory.test.js',
  'backend/tests/server/runtimeStateStoreFactory.test.js',
  'backend/tests/server/runtimeFactories.test.js',
  'backend/tests/server/sensorProcessorFactory.test.js',
  'backend/tests/server/smallBedRuntimeFactory.test.js',
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
