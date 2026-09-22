export const MAX_SCREEN_RULERS = 8;

/** 计算坐标平面距离；当前量尺传整数行列，物理读数由 sensorRulerDistance 计算。 */
export function screenRulerDistance(start, end) {
  return start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
}

/** 将端点吸附到整数传感点，并限制在当前矩阵内。 */
export function clampRulerPoint(point, bounds) {
  return { x: Math.max(0, Math.min(Math.floor(bounds.width), Math.round(point.x))), y: Math.max(0, Math.min(Math.floor(bounds.height), Math.round(point.y))) };
}

/** 建立一次量测状态；物理量尺仅在重新开启或更换传感器时重置。 */
export function createRulerState(width = 800, height = 600) {
  return { lines: [], selectedId: null, start: null, cursor: { x: Math.floor(width / 2), y: Math.floor(height / 2) }, nextId: 1, error: '' };
}

/** 移动端点或整条线；整线贴边时限制位移，保留长度和方向。 */
export function moveScreenRuler(line, part, delta, bounds) {
  delta = { x: Math.round(delta.x), y: Math.round(delta.y) };
  if (part === 'start' || part === 'end') return { ...line, [part]: clampRulerPoint({
    x: line[part].x + delta.x, y: line[part].y + delta.y,
  }, bounds) };
  const dx = Math.max(-Math.min(line.start.x, line.end.x), Math.min(bounds.width - Math.max(line.start.x, line.end.x), delta.x));
  const dy = Math.max(-Math.min(line.start.y, line.end.y), Math.min(bounds.height - Math.max(line.start.y, line.end.y), delta.y));
  return { ...line, start: { x: line.start.x + dx, y: line.start.y + dy }, end: { x: line.end.x + dx, y: line.end.y + dy } };
}

/** 两点点击、拖拽和键盘落点共用量尺状态，未完成线不占用八条名额。 */
export function screenRulerReducer(state, action) {
  if (['preview', 'cursor', 'place'].includes(action.type)) {
    const points = action.type === 'preview' ? [action.start, action.point] : [action.point];
    if (!points.every((point) => point && Number.isInteger(point.x) && point.x >= 0 && Number.isInteger(point.y) && point.y >= 0)) {
      return { ...state, error: '端点必须落在传感点中心。' };
    }
  }
  switch (action.type) {
    case 'reset': return createRulerState(action.width, action.height);
    case 'restore': return action.state;
    case 'preview': return { ...state, start: action.start, cursor: action.point, error: '' };
    case 'cursor': return { ...state, cursor: action.point };
    case 'cancel': return { ...state, start: null, error: '' };
    case 'place': {
      if (!state.start) {
        if (state.lines.length >= MAX_SCREEN_RULERS) return { ...state, error: '最多保留 8 条量尺，请先删除或清空。' };
        return { ...state, start: action.point, cursor: action.point, error: '' };
      }
      const distance = screenRulerDistance(state.start, action.point);
      if (!Number.isFinite(distance) || distance < 1) return { ...state, error: '请选择两个不同的传感点。' };
      if (state.lines.length >= MAX_SCREEN_RULERS) return { ...state, start: null, error: '最多保留 8 条量尺，请先删除或清空。' };
      const line = { id: state.nextId, start: state.start, end: action.point };
      return { ...state, lines: [...state.lines, line], selectedId: line.id, nextId: state.nextId + 1, start: null, cursor: action.point, error: '' };
    }
    case 'select': return { ...state, selectedId: action.id, start: null, error: '' };
    case 'move': {
      const line = moveScreenRuler(action.line, action.part, action.delta, action.bounds);
      if (screenRulerDistance(line.start, line.end) < 1) return state;
      return { ...state, lines: state.lines.map((entry) => entry.id === line.id ? line : entry), selectedId: line.id, error: '' };
    }
    case 'remove': {
      const lines = state.lines.filter((line) => line.id !== action.id);
      return { ...state, lines, selectedId: lines.some((line) => line.id === state.selectedId) ? state.selectedId : lines.at(-1)?.id ?? null, error: '' };
    }
    case 'clear': return { ...createRulerState(), cursor: state.cursor, nextId: state.nextId };
    default: return state;
  }
}
