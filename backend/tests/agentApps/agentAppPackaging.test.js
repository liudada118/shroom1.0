const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  AGENT_APP_MAX_FILE_BYTES,
  AGENT_APP_MAX_FILES,
  AGENT_APP_MAX_CHARTS,
  AGENT_APP_MAX_PATH_LENGTH,
  AGENT_APP_MAX_TOTAL_BYTES,
} = require('../../extension-host/agent-apps/agentAppService');
const { buildSdkContractSnapshot } = require('@shroom/backend/contract/sdkApiContract.js');

const projectRoot = path.resolve(__dirname, '../../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(projectRoot, 'agent-resources/policy.json'), 'utf8'));
const templateManifest = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-app/template/app.json'),
  'utf8',
));
const clientHtml = fs.readFileSync(path.join(projectRoot, 'client/index.html'), 'utf8');
const templateHtml = fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-app/template/frontend/index.html'),
  'utf8',
);
const packSyncScript = fs.readFileSync(path.join(projectRoot, 'scripts/sync-pack-resources.js'), 'utf8');

const builderAgentResource = packageJson.build.extraResources.find((entry) => entry.to === 'agent');
assert.deepStrictEqual(builderAgentResource, {
  from: './agent-resources',
  to: 'agent',
  filter: ['**/*'],
});
assert(packageJson.config.forge.packagerConfig.extraResource.includes('./pack-resources/agent'));
assert(packageJson.config.forge.packagerConfig.ignore.includes('^/agent-resources($|/)'));
assert.match(packSyncScript, /path\.join\(packResourcesDir, ["']agent["']\)/);
assert.match(packSyncScript, /syncAgentResources\(\);/);

// 主页面与 API 是两个 loopback origin；没有显式 frame-src 时会回落到 default-src 'self'。
assert.match(
  clientHtml,
  /frame-src http:\/\/127\.0\.0\.1:19245 http:\/\/localhost:19245/,
);
assert.match(
  clientHtml,
  /child-src http:\/\/127\.0\.0\.1:19245 http:\/\/localhost:19245/,
);

const contract = buildSdkContractSnapshot();
assert.strictEqual(policy.appManifest.schemaVersion, templateManifest.schemaVersion);
assert.strictEqual(templateManifest.permissions.includes('sensor.read'), true);
assert.strictEqual(policy.installApi.limits.maximumFiles, AGENT_APP_MAX_FILES);
assert.strictEqual(policy.installApi.limits.maximumCharts, AGENT_APP_MAX_CHARTS);
assert.strictEqual(policy.installApi.limits.maximumDecodedBytesPerFile, AGENT_APP_MAX_FILE_BYTES);
assert.strictEqual(policy.installApi.limits.maximumDecodedBytesTotal, AGENT_APP_MAX_TOTAL_BYTES);
assert.strictEqual(policy.installApi.limits.maximumPortableRelativePathLength, AGENT_APP_MAX_PATH_LENGTH);
assert.deepStrictEqual(contract.agentApps.limits, {
  maximumFiles: AGENT_APP_MAX_FILES,
  maximumCharts: AGENT_APP_MAX_CHARTS,
  maximumDecodedBytesPerFile: AGENT_APP_MAX_FILE_BYTES,
  maximumDecodedBytesTotal: AGENT_APP_MAX_TOTAL_BYTES,
  maximumPortableRelativePathLength: AGENT_APP_MAX_PATH_LENGTH,
});
assert.deepStrictEqual(contract.agentApps.descriptorShape.permissions, ['sensor.read']);
assert.deepStrictEqual(contract.agentApps.surfaces, ['renderer', 'chart']);
assert.strictEqual(contract.agentApps.chartIdPattern, 'agent-chart:<appId>:<chartId>');
assert.deepStrictEqual(
  [...policy.installApi.errorCodes].sort(),
  [...contract.agentApps.errorCodes].sort(),
);
assert.match(contract.agentApps.writeOriginPolicy, /loopback/);

// CSP 由静态响应头统一施加；模板只引用包内外部脚本，不能再声明一份相冲突的 meta CSP。
assert.doesNotMatch(templateHtml, /http-equiv=["']Content-Security-Policy["']/i);
assert.match(templateHtml, /<script src=["']\.\/app\.js["']><\/script>/i);
assert.doesNotMatch(templateHtml, /<script(?!\s+src=)[^>]*>/i);
assert.doesNotMatch(templateHtml, /(?:https?|wss?):\/\//i);

console.log('agentAppPackaging.test.js passed');
