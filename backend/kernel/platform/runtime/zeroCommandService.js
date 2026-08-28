const ZERO_RESET_KEYS = Object.freeze([
  'pointArr1zero',
  'pointArr2zero',
  'pointArr3zero',
  'pointArr4zero',
  'pointArr1RawZero',
  'pointArr2RawZero',
  'pointArr147zero',
  'pointArr147zero_2',
]);

function cloneFrame(frame) {
  return Array.isArray(frame) ? [...frame] : [];
}

function hasFrame(frame) {
  return Array.isArray(frame) && frame.length > 0;
}

/**
 * 创建零点命令服务。
 *
 * 该服务承接旧 WebSocket resetZero 命令，负责把当前帧源数据保存为扣零基准，
 * 或清空所有零点基准。WebSocket 层只负责路由命令，不再直接操作零点字段。
 */
function createZeroCommandService({
  getRuntime,
  setZeroState,
} = {}) {
  function captureZero() {
    const runtime = getRuntime();

    if (runtime.pointArr) setZeroState('pointArr1zero', cloneFrame(runtime.pointArr1zeroData));
    if (runtime.pointArr2) setZeroState('pointArr2zero', cloneFrame(runtime.pointArr2zeroData));
    if (runtime.pointArr3) setZeroState('pointArr3zero', cloneFrame(runtime.pointArr3zeroData));
    if (runtime.pointArr4) setZeroState('pointArr4zero', cloneFrame(runtime.pointArr4zeroData));
    if (hasFrame(runtime.pointArr1RawZeroData)) setZeroState('pointArr1RawZero', cloneFrame(runtime.pointArr1RawZeroData));
    if (hasFrame(runtime.pointArr2RawZeroData)) setZeroState('pointArr2RawZero', cloneFrame(runtime.pointArr2RawZeroData));
    if (runtime.newArr147) setZeroState('pointArr147zero', cloneFrame(runtime.newArr147));
    if (runtime.newArr147_2) setZeroState('pointArr147zero_2', cloneFrame(runtime.newArr147_2));
  }

  function clearZero() {
    ZERO_RESET_KEYS.forEach((key) => {
      setZeroState(key, []);
    });
  }

  function handleResetZero(value) {
    if (value === true) {
      captureZero();
      return true;
    }

    if (value === false) {
      clearZero();
      return true;
    }

    return false;
  }

  return {
    captureZero,
    clearZero,
    handleResetZero,
  };
}

module.exports = {
  ZERO_RESET_KEYS,
  createZeroCommandService,
};

