const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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
const policySource = fs.readFileSync(path.join(projectRoot, 'agent-resources/policy.json'), 'utf8');
const skillSource = fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-system/SKILL.md'),
  'utf8',
);
const displayAppSkillSource = fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-app/SKILL.md'),
  'utf8',
);
const policy = JSON.parse(policySource);
const templateManifest = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-app/template/app.json'),
  'utf8',
));
const clientHtml = fs.readFileSync(path.join(projectRoot, 'client/index.html'), 'utf8');
const templateHtml = fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-app/template/frontend/index.html'),
  'utf8',
);
const templateScript = fs.readFileSync(
  path.join(projectRoot, 'agent-resources/add-display-app/template/frontend/app.js'),
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
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'pack-resources/agent/policy.json'), 'utf8'),
  policySource,
);
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'pack-resources/agent/add-display-system/SKILL.md'), 'utf8'),
  skillSource,
);

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
assert.match(policy.displaySystemGeneration.protocolSelection.presetFirstRule, /MUST copy/);
assert.match(policy.displaySystemGeneration.protocolSelection.wireDocumentRule, /MUST NOT.*fixedLength/);
assert.match(policy.displaySystemGeneration.algorithmSelection.registeredPackageRule, /MUST attach/);
assert.match(policy.displaySystemGeneration.display.rendererRule, /MUST use it by default/);
assert.match(policy.displaySystemGeneration.display.rendererIntentExamples['3dPointPlot'], /pointGrid/);
assert.match(policy.displaySystemGeneration.display.layoutPresentationRule, /display\.layout\.presentation/);
assert.match(policy.displaySystemGeneration.display.layoutPresentationRule, /immersive/);
assert.match(policy.displaySystemGeneration.display.runtimePresentationRule, /runtimeChrome absent or false/);
assert.match(policy.displaySystemGeneration.display.runtimePresentationRule, /MUST NOT add title/);
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'pack-resources/agent/add-display-app/SKILL.md'), 'utf8'),
  displayAppSkillSource,
);
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'pack-resources/agent/add-display-app/template/README.md'), 'utf8'),
  fs.readFileSync(path.join(projectRoot, 'agent-resources/add-display-app/template/README.md'), 'utf8'),
);
assert.match(policy.displaySystemGeneration.display.charts.surfaceRule, /transparent root/);
assert(policy.displaySystemGeneration.activation.verification.some((item) => item.includes('real canonical sensor.frame')));
assert(policy.displaySystemGeneration.acceptance.some((item) => item.includes('open status alone is insufficient')));
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
assert.doesNotMatch(templateHtml, /<(?:header|footer)\b/i);
assert.match(templateHtml, /background:\s*transparent/);
assert.match(templateScript, /getContext\(['"]2d['"],\s*\{\s*alpha:\s*true\s*\}\)/);
assert.match(templateScript, /context\.clearRect\(/);

console.log('agentAppPackaging.test.js passed');

// 用宿主 DTO 形状实际执行模板，而不是仅匹配文字；原始数组不等长不能阻断指标。
const posted = [];
const listeners = {};
const elements = new Map();
const ctx = new Proxy({}, { get: () => () => {} });
const parent = { postMessage: (message) => posted.push(message) };
vm.runInNewContext(templateScript, {
  window: { parent, devicePixelRatio: 2, addEventListener: (name, listener) => { listeners[name] = listener; } },
  document: { getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, {
      dataset: {}, textContent: '', width: 0, height: 0,
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 300, height: 200 }),
    });
    return elements.get(id);
  } },
});
/** 向模板投递模拟宿主消息，保留正式身份与每路独立矩阵。 */
function sendTemplate(type, payload) {
  listeners.message({ source: parent, data: { type: 'shroom.renderer.' + type, schemaVersion: 1, payload } });
}
const identity = { displaySystemId: 'test', sensorId: 'mat', channelId: 'test:mat' };
sendTemplate('init', identity);
for (const rawValues of [undefined, null, [], [1, 2], Array(1028).fill(1)]) {
  posted.length = 0;
  sendTemplate('frame', {
    ...identity, values: Array(1024).fill(2), rawValues,
    matrix: { rows: 32, cols: 32, total: 1024 },
    algorithmMetrics: { respirationSignal: -0.5, copX: 5, copY: 6 },
    channels: [{
      displaySystemId: 'test', sensorId: 'hand', channelId: 'test:hand',
      values: [1, 2, 3, 4], rawValues: [1],
      matrix: { rows: 2, cols: 2, total: 4 },
    }],
  });
  assert.ok(!posted.some((message) => message.type === 'shroom.renderer.error'));
  assert.match(elements.get('summary').textContent, /1024 values/);
}
sendTemplate('frame', { ...identity, values: [1], matrix: { rows: 32, cols: 32, total: 1024 } });
assert.ok(posted.some((message) => message.type === 'shroom.renderer.error'));
assert.deepStrictEqual(policy.displaySystemGeneration.componentChoice.dimensions, ['algorithm', 'renderer', 'chart']);
assert.strictEqual(policy.displaySystemGeneration.componentChoice.defaultMode, 'automatic');
assert.strictEqual(policy.displaySystemGeneration.componentChoice.requireSourceConfirmation, false);
assert.strictEqual(templateScript, fs.readFileSync(
  path.join(projectRoot, 'pack-resources/agent/add-display-app/template/frontend/app.js'), 'utf8'));
