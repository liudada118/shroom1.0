/**
 * matrixViewTransform.js - 数字矩阵「展示方向」的纯运算与状态：旋转 90°、水平翻转、纵向翻转
 *
 * 只描述画面怎么摆：先按数据自己的方向做镜像，再把整幅画面顺时针转 k 个 90°，
 * 得到每个原始格落在画面的哪一行哪一列、行列号怎么标。输入帧不被改写，统计、框选索引、采集与导出继续用原始顺序。
 */

/** 归一成 0–3 的整数圈数；非法值当作没转。 */
export function normalizeQuarterTurns(value) {
  return Number.isInteger(value) ? ((value % 4) + 4) % 4 : 0;
}

/**
 * 归一成完整的展示方向；缺字段或非法值当作没翻、没转。
 * @param {{flipX?: boolean, flipY?: boolean, quarterTurns?: number}} [view] flipX 左右镜像、flipY 上下镜像（都按数据自己的方向），quarterTurns 是镜像之后再顺时针转几个 90°
 * @returns {{flipX: boolean, flipY: boolean, quarterTurns: number}} 新对象，可以放心改
 */
export function normalizeMatrixView(view) {
  return { flipX: view?.flipX === true, flipY: view?.flipY === true, quarterTurns: normalizeQuarterTurns(view?.quarterTurns) };
}

/** 画面是不是和数据同向（没翻也没转）。 */
export function isUprightMatrixView(view) {
  return view?.flipX !== true && view?.flipY !== true && normalizeQuarterTurns(view?.quarterTurns) === 0;
}

/** 这个展示方向下画面的列数与行数；转奇数圈时互换，翻转不影响。 */
export function matrixViewSize(width, height, view) {
  return normalizeQuarterTurns(view?.quarterTurns) % 2 ? { width: height, height: width } : { width, height };
}

/**
 * 原始格 (row, col) 在画面上的行列：先镜像，再顺时针转。
 * @param {number} row 原始行，0 起点、自上而下
 * @param {number} col 原始列，0 起点、自左而右
 * @param {number} width 原始列数
 * @param {number} height 原始行数
 * @param {object} view 展示方向
 * @returns {{row: number, col: number}} 画面上的行列
 */
export function matrixViewCell(row, col, width, height, view) {
  const r = view?.flipY === true ? height - 1 - row : row, c = view?.flipX === true ? width - 1 - col : col;
  switch (normalizeQuarterTurns(view?.quarterTurns)) {
    case 1: return { row: c, col: height - 1 - r };
    case 2: return { row: height - 1 - r, col: width - 1 - c };
    case 3: return { row: width - 1 - c, col: r };
    default: return { row: r, col: c };
  }
}

// 最近用过的几张「原始下标 → 画面下标」对照表。逐帧重排只查表，不逐格重算。
const INDEX_MAPS = new Map();
const INDEX_MAP_LIMIT = 8;

/**
 * 行优先的「原始下标 → 画面下标」对照表。
 * ⚠️ 返回的表是缓存里的同一份，调用方只读不写。
 * @returns {Int32Array} 长度 width × height
 */
export function matrixViewIndexMap(width, height, view) {
  const normalized = normalizeMatrixView(view);
  const key = `${width}x${height}:${normalized.flipX ? 1 : 0}${normalized.flipY ? 1 : 0}${normalized.quarterTurns}`;
  const cached = INDEX_MAPS.get(key);
  if (cached) return cached;
  const shownWidth = matrixViewSize(width, height, normalized).width, map = new Int32Array(Math.max(0, width * height));
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = matrixViewCell(row, col, width, height, normalized);
      map[row * width + col] = cell.row * shownWidth + cell.col;
    }
  }
  if (INDEX_MAPS.size >= INDEX_MAP_LIMIT) INDEX_MAPS.delete(INDEX_MAPS.keys().next().value);
  INDEX_MAPS.set(key, map);
  return map;
}

/**
 * 生成一份摆好方向的展示副本，不改写输入。
 * ⚠️ 只给最后上屏那一步用；拿它去算统计或存盘，行列就和设备对不上了。
 * @param {ArrayLike<*>} values 行优先原始帧；不足 width×height 的位置补 0，多出的忽略
 * @param {number} width 原始列数
 * @param {number} height 原始行数
 * @param {object} view 展示方向
 * @returns {{data: Array, width: number, height: number}} 行优先展示帧与它的列数、行数
 */
export function transformMatrixView(values, width, height, view) {
  const size = matrixViewSize(width, height, view), map = matrixViewIndexMap(width, height, view);
  const data = new Array(map.length).fill(0), length = Math.min(values?.length || 0, map.length);
  for (let index = 0; index < length; index++) data[map[index]] = values[index];
  return { data, width: size.width, height: size.height };
}

/**
 * 画面每一行、每一列对应的原始行列号（1 起点）。
 * ⚠️ 转奇数圈时画面的「行」是原始的列：`rows` 里装的是原始列号，`cols` 里是原始行号。
 * @param {number} width 原始列数
 * @param {number} height 原始行数
 * @param {object} view 展示方向
 * @returns {{rows: number[], cols: number[]}} 自上而下、自左而右的标号
 */
export function matrixViewAxisLabels(width, height, view) {
  const size = matrixViewSize(width, height, view), odd = normalizeQuarterTurns(view?.quarterTurns) % 2 === 1;
  const rows = new Array(size.height), cols = new Array(size.width);
  for (let row = 0; row < height; row++) {
    const cell = matrixViewCell(row, 0, width, height, view);
    if (odd) cols[cell.col] = row + 1; else rows[cell.row] = row + 1;
  }
  for (let col = 0; col < width; col++) {
    const cell = matrixViewCell(0, col, width, height, view);
    if (odd) rows[cell.row] = col + 1; else cols[cell.col] = col + 1;
  }
  return { rows, cols };
}

/**
 * 数字矩阵的视角快照只有展示方向，和 3D 场景的镜头快照互不通用。
 * 早期只存圈数的快照没有翻转字段，按没翻处理。
 */
export function validateMatrixViewSnapshot(value) {
  return Boolean(value) && value.schemaVersion === 1 && value.kind === 'matrix'
    && Number.isInteger(value.quarterTurns) && value.quarterTurns >= 0 && value.quarterTurns <= 3
    && (value.flipX === undefined || typeof value.flipX === 'boolean')
    && (value.flipY === undefined || typeof value.flipY === 'boolean');
}

/**
 * 数字矩阵的展示工具：旋转 90°、水平 / 纵向翻转和恢复，没有镜头和缩放。
 * 接口形状与 3D 场景的视角工具一致，工具箱和视角保存可以直接复用。
 * @param {(view: {flipX: boolean, flipY: boolean, quarterTurns: number}) => void} apply 把展示方向交给后端重排画面
 * @param {object} [initial] 场景重建前已有的展示方向；只记下来，不回调 apply
 * @returns {object} 视角工具
 */
export function createMatrixViewTools(apply, initial) {
  let view = normalizeMatrixView(initial), disposed = false;
  const listeners = new Set();
  /** 当前展示方向的快照；卸载后返回 null。 */
  const getSnapshot = () => (disposed ? null : { schemaVersion: 1, kind: 'matrix', ...view });
  /** 应用新的展示方向并通知订阅方；订阅方出错不影响画面。 */
  const commit = (next) => {
    view = next;
    apply({ ...view });
    for (const listener of [...listeners]) { try { listener(getSnapshot()); } catch { /* 本地保存失败不影响画面。 */ } }
    return true;
  };
  return {
    getSnapshot,
    /** 翻过或转过之后按屏幕框选会选错行列，所以 selectionSafe 只在与数据同向时为真。 */
    getState: () => ({ available: !disposed, ...view, selectionSafe: isUprightMatrixView(view) }),
    /** 监听展示方向变化；取消订阅不改变画面。 */
    subscribe(listener) {
      if (disposed || typeof listener !== 'function') return () => {};
      listeners.add(listener); return () => listeners.delete(listener);
    },
    /** 恢复保存的展示方向；不是数字矩阵的快照一律拒绝。 */
    restoreSnapshot(snapshot) {
      if (disposed || !validateMatrixViewSnapshot(snapshot)) return false;
      const next = normalizeMatrixView(snapshot);
      return next.flipX === view.flipX && next.flipY === view.flipY && next.quarterTurns === view.quarterTurns ? true : commit(next);
    },
    /** 顺时针（负数为逆时针）转 90°。 */
    rotateQuarter(direction = 1) {
      if (disposed || !Number.isFinite(direction) || direction === 0) return false;
      return commit({ ...view, quarterTurns: normalizeQuarterTurns(view.quarterTurns + (direction > 0 ? 1 : -1)) });
    },
    /**
     * 水平（'x'）或纵向（'y'）翻转当前看到的画面，再点一次恢复。
     * ⚠️ 镜像与旋转不可交换：画面转过 90° 时，要翻当前看到的左右，等于翻数据的左右再把圈数反过来。
     *   所以翻转一次后圈数会从 1 变 3（或 3 变 1），这是同一幅画面的记法，不是多转了。
     */
    flip(axis) {
      if (disposed || !['x', 'y'].includes(axis)) return false;
      return commit({ flipX: view.flipX !== (axis === 'x'), flipY: view.flipY !== (axis === 'y'), quarterTurns: (4 - view.quarterTurns) % 4 });
    },
    /** 回到与数据同向。 */
    reset() {
      if (disposed) return false;
      return isUprightMatrixView(view) ? true : commit(normalizeMatrixView());
    },
    /** 卸载后拒绝迟到的操作。 */
    dispose() { disposed = true; listeners.clear(); },
  };
}
