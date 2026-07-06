const { createRuntimeStateStore } = require('./runtimeStateStore');

const ZERO_STATE_KEYS = Object.freeze([
  'newArr147',
  'newArr147_2',
  'pointArr1RawZero',
  'pointArr1RawZeroData',
  'pointArr1zero',
  'pointArr1zeroData',
  'pointArr2RawZero',
  'pointArr2RawZeroData',
  'pointArr2zero',
  'pointArr2zeroData',
  'pointArr3zero',
  'pointArr3zeroData',
  'pointArr4zero',
  'pointArr4zeroData',
  'pointArr147zero',
  'pointArr147zero_2',
]);

/**
 * 创建零点状态仓库。
 *
 * 零点状态包含三类数据：
 * 1. 已应用到实时帧扣零的基准帧。
 * 2. 原始零点源帧，供 resetZero 和历史入库使用。
 * 3. legacy 手套/分段协议保留的映射缓存。
 */
function createZeroStateStore() {
  return createRuntimeStateStore({
    initialState: ZERO_STATE_KEYS.reduce((state, key) => {
      state[key] = [];
      return state;
    }, {}),
  });
}

module.exports = {
  ZERO_STATE_KEYS,
  createZeroStateStore,
};

