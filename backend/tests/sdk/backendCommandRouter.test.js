const assert = require('assert');

const { BackendCommandRouter } = require('@shroom/backend/client/BackendCommandRouter.js');

const router = new BackendCommandRouter();
const events = [];
router.on('zero:capture', (target) => events.push({ operation: 'capture', target }));
router.on('zero:clear', (target) => events.push({ operation: 'clear', target }));

router.route({
  resetZero: true,
  displaySystemId: 'display-a',
  channelIds: ['display-a:seat'],
});
router.route({ resetZero: false });

assert.deepStrictEqual(events, [{
  operation: 'capture',
  target: {
    displaySystemId: 'display-a',
    channelIds: ['display-a:seat'],
  },
}, {
  operation: 'clear',
  target: {},
}]);

console.log('backendCommandRouter.test.js passed');
