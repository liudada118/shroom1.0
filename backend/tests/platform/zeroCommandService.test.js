const assert = require('assert');

const {
  createZeroCommandService,
  normalizeZeroCommand,
} = require('../../kernel/platform/runtime/zeroCommandService');
const {
  createControlCommandRouter,
} = require('../../kernel/platform/commands/controlCommandRouter');
const {
  createControlCommandService,
} = require('../../kernel/platform/commands/controlCommandService');
const {
  registerCalibrationZeroCommandHandler,
} = require('../../kernel/platform/commands/registerCalibrationZeroCommandHandler');
const {
  toLegacyCommand,
  validateCommandEnvelope,
} = require('@shroom/backend/contract/commandProtocol.js');

const storeCalls = [];
const resolutionCalls = [];
const knownChannels = new Set([
  'display-a:seat',
  'display-a:back',
  'display-b:seat',
]);
const zeroStateStore = {
  capture: (channelIds) => {
    storeCalls.push({ operation: 'capture', channelIds });
    return {
      affectedChannelIds: channelIds.filter((channelId) => channelId !== 'display-a:back'),
      skipped: channelIds
        .filter((channelId) => channelId === 'display-a:back')
        .map((channelId) => ({ channelId, reason: 'NO_CURRENT_FRAME' })),
    };
  },
  clear: (channelIds) => {
    storeCalls.push({ operation: 'clear', channelIds });
    return { affectedChannelIds: [...channelIds], skipped: [] };
  },
};
const service = createZeroCommandService({
  zeroStateStore,
  getActiveDisplaySystemId: () => 'display-a',
  resolveTargetChannelIds: (target) => {
    resolutionCalls.push(target);
    const channelIds = target.channelIds || [...knownChannels]
      .filter((channelId) => channelId.startsWith(`${target.displaySystemId}:`));
    return {
      channelIds: channelIds.filter((channelId) => knownChannels.has(channelId)),
      skipped: channelIds
        .filter((channelId) => !knownChannels.has(channelId))
        .map((channelId) => ({ channelId, reason: 'UNKNOWN_CHANNEL' })),
    };
  },
});

assert.deepStrictEqual(normalizeZeroCommand({
  enabled: true,
  displaySystemId: '轮椅 A',
  channelIds: ['轮椅 A:左 侧'],
}), {
  enabled: true,
  displaySystemId: '轮椅 A',
  channelIds: ['轮椅 A:左 侧'],
});
assert.deepStrictEqual(validateCommandEnvelope({
  type: 'calibration.zero',
  payload: {
    enabled: true,
    displaySystemId: '轮椅 A',
    channelIds: ['轮椅 A:左 侧'],
  },
  requestId: 'req-unicode-zero',
}).payload.channelIds, ['轮椅 A:左 侧']);

const activeCapture = service.handle({ enabled: true });
assert.deepStrictEqual(resolutionCalls[0], {
  displaySystemId: 'display-a',
  channelIds: undefined,
  operation: 'capture',
});
assert.deepStrictEqual(storeCalls[0], {
  operation: 'capture',
  channelIds: ['display-a:seat', 'display-a:back'],
});
assert.deepStrictEqual(activeCapture.affectedChannelIds, ['display-a:seat']);
assert.strictEqual(activeCapture.affected, 1);
assert.deepStrictEqual(activeCapture.skipped, [{
  channelId: 'display-a:back',
  reason: 'NO_CURRENT_FRAME',
}]);

assert.throws(
  () => service.handle({ enabled: false, channelIds: [] }),
  (error) => error.code === 'INVALID_COMMAND' && /must not be empty/.test(error.message),
);

assert.throws(() => service.handle({
  enabled: false,
  displaySystemId: 'display-a',
  channelIds: ['display-a:seat', 'display-b:seat'],
}), (error) => error.code === 'INVALID_COMMAND' && /outside display system/.test(error.message));

// 仅显式给出 channelIds 时精确寻址，不应偷偷套用当前 display-a 的范围。
const explicitOtherDisplay = service.handleResetZero(true, { channelIds: ['display-b:seat'] });
assert.deepStrictEqual(resolutionCalls.at(-1), {
  displaySystemId: undefined,
  channelIds: ['display-b:seat'],
  operation: 'capture',
});
assert.deepStrictEqual(explicitOtherDisplay.affectedChannelIds, ['display-b:seat']);

assert.strictEqual(service.handleResetZero('true'), false);
assert.throws(
  () => service.handle({ enabled: 'true' }),
  (error) => error.code === 'INVALID_COMMAND' && /must be a boolean/.test(error.message),
);
assert.throws(
  () => service.handle({ enabled: true, displaySystemId: {} }),
  (error) => error.code === 'INVALID_COMMAND' && /displaySystemId/.test(error.message),
);
assert.throws(
  () => service.handle({ enabled: true, channelIds: ['display-a:seat', 'display-a:seat'] }),
  (error) => error.code === 'INVALID_COMMAND' && /unique canonical/.test(error.message),
);

let resolverCalledWithoutActiveDisplay = false;
const serviceWithoutActiveDisplay = createZeroCommandService({
  zeroStateStore,
  getActiveDisplaySystemId: () => '',
  resolveTargetChannelIds: () => {
    resolverCalledWithoutActiveDisplay = true;
    return [...knownChannels];
  },
});
assert.throws(
  () => serviceWithoutActiveDisplay.handle({ enabled: false }),
  (error) => error.code === 'COMMAND_EXECUTION_FAILED' && error.httpStatus === 409,
);
assert.strictEqual(resolverCalledWithoutActiveDisplay, false);

const serviceWithUnknownDisplay = createZeroCommandService({
  zeroStateStore,
  getActiveDisplaySystemId: () => 'display-a',
  resolveTargetChannelIds: () => ({
    channelIds: [],
    skipped: [{ displaySystemId: 'missing', reason: 'unknown-display-system' }],
  }),
});
assert.throws(
  () => serviceWithUnknownDisplay.handle({ enabled: false, displaySystemId: 'missing' }),
  (error) => error.code === 'COMMAND_EXECUTION_FAILED'
    && /unknown-display-system/.test(error.message),
);

const routedPayloads = [];
const commandRouter = createControlCommandRouter();
const controlCommandService = createControlCommandService({ commandRouter });
registerCalibrationZeroCommandHandler(controlCommandService, {
  zeroCommandService: {
    handle: (payload) => {
      routedPayloads.push(payload);
      return { affected: 1, affectedChannelIds: payload.channelIds || ['display-a:seat'] };
    },
  },
});
const canonicalResult = controlCommandService.executeHttp({
  type: 'calibration.zero',
  payload: {
    enabled: true,
    displaySystemId: 'display-a',
    channelIds: ['display-a:seat'],
  },
  requestId: 'req-routed-zero',
});
assert.strictEqual(canonicalResult.ok, true);
const legacyResult = controlCommandService.executeWs({
  resetZero: false,
  displaySystemId: 'display-b',
  channelIds: ['display-b:seat'],
});
assert.strictEqual(legacyResult.ok, true);
assert.deepStrictEqual(routedPayloads, [{
  enabled: true,
  displaySystemId: 'display-a',
  channelIds: ['display-a:seat'],
}, {
  enabled: false,
  displaySystemId: 'display-b',
  channelIds: ['display-b:seat'],
}]);
assert.throws(
  () => controlCommandService.executeHttp({
    type: 'calibration.zero',
    payload: { enabled: 'true' },
    requestId: 'req-invalid-zero',
  }),
  (error) => error.code === 'INVALID_COMMAND',
);
assert.throws(
  () => controlCommandService.executeHttp({
    type: 'calibration.zero',
    payload: { enabled: true, channelIds: ['seat'] },
    requestId: 'req-invalid-zero-channel',
  }),
  (error) => error.code === 'INVALID_COMMAND' && /channelIds/.test(error.message),
);
assert.throws(
  () => controlCommandService.executeHttp({
    type: 'calibration.zero',
    payload: { enabled: true, displaySystemId: 'display-a', unexpected: true },
    requestId: 'req-invalid-zero-extra',
  }),
  (error) => error.code === 'INVALID_COMMAND' && /unsupported field/.test(error.message),
);

assert.deepStrictEqual(toLegacyCommand({
  type: 'calibration.zero',
  payload: {
    enabled: true,
    displaySystemId: 'display-a',
    channelIds: ['display-a:seat'],
  },
  requestId: 'req-zero-target',
}), {
  resetZero: true,
  displaySystemId: 'display-a',
  channelIds: ['display-a:seat'],
});

console.log('zeroCommandService.test.js passed');
