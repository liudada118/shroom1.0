const assert = require('assert');
const {
  STORE_BACKED_RUNTIME_KEYS,
  createServerRuntimeStateStore,
} = require('../../server/runtimeStateStoreFactory');

const backedKeys = [];
let boundStore = null;
let file = 'hand0205';

const bindings = createServerRuntimeStateStore({
  runtimeStatePatchers: {
    bindRuntimeStateStore: (store, keys) => {
      boundStore = store;
      backedKeys.push(...keys);
    },
  },
  accessors: {
    file: {
      get: () => file,
      set: (value) => { file = value; },
    },
  },
});

assert.ok(bindings.runtimeStateStore);
assert.strictEqual(boundStore, bindings.runtimeStateStore);
assert.deepStrictEqual(backedKeys, [...STORE_BACKED_RUNTIME_KEYS]);
assert.deepStrictEqual(bindings.runtimeStateStore.get('firstBlueData'), []);

bindings.runtimeStateStore.set('file', 'jqbed');
assert.strictEqual(file, 'jqbed');
assert.strictEqual(bindings.runtimeStateAccessor('file').get(), 'jqbed');

console.log('runtimeStateStoreFactory.test.js passed');
