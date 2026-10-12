export const MATRIX_ROWS = 32;
export const MATRIX_COLUMNS = 32;
export const PRESSURE_POINT_COUNT = MATRIX_ROWS * MATRIX_COLUMNS;

export type FrameSource = 'usb' | 'demo';
export type PressureFrame = {
  type: 'pressure.frame';
  version: 1;
  source: FrameSource;
  sequence: number;
  timestamp: number;
  rows: 32;
  columns: 32;
  values: number[];
  connectionId?: string;
};

/** 丢弃已经断开的 USB 连接的迟到事件，即使其序号仍然较大。 */
export function isCurrentUsbFrame(frame: unknown, connectionId: string | null): frame is PressureFrame {
  return connectionId !== null && isPressureFrame(frame) && frame.source === 'usb' && frame.connectionId === connectionId;
}

/** 校验移动端原始压力帧，拒绝错点数、非 uint8 值及无效时间。 */
export function isPressureFrame(value: unknown): value is PressureFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as Partial<PressureFrame>;
  return frame.type === 'pressure.frame' && frame.version === 1
    && (frame.source === 'usb' || frame.source === 'demo')
    && frame.rows === MATRIX_ROWS && frame.columns === MATRIX_COLUMNS
    && Number.isSafeInteger(frame.sequence) && (frame.sequence ?? -1) >= 0
    && Number.isSafeInteger(frame.timestamp) && (frame.timestamp ?? -1) >= 0
    && Array.isArray(frame.values) && frame.values.length === PRESSURE_POINT_COUNT
    && Array.from(frame.values).every((point) => Number.isInteger(point) && point >= 0 && point <= 255);
}

/** 生成明确标为 demo 的移动压力峰，验证数据桥及画布；不代表设备数据。 */
export function createDemoFrame(sequence: number, timestamp: number): PressureFrame {
  const phase = sequence / 12;
  const centerX = 15.5 + 9 * Math.sin(phase / 2);
  const centerY = 15.5 + 7 * Math.cos(phase / 3);
  return {
    type: 'pressure.frame', version: 1, source: 'demo', sequence, timestamp,
    rows: 32, columns: 32,
    values: Array.from({ length: PRESSURE_POINT_COUNT }, (_, index) => {
      const x = index % MATRIX_COLUMNS;
      const y = Math.floor(index / MATRIX_COLUMNS);
      const distance = (x - centerX) ** 2 + (y - centerY) ** 2;
      return Math.round(220 * Math.exp(-distance / 28));
    }),
  };
}
