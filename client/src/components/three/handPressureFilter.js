/** 按接收帧的ADC总和判定初始阈值，再生成仅供显示使用的逐点过滤数据。 */
export function filterHandPressure(frame, { initialThreshold = 0, pointFilter = 0, count = 1024 } = {}) {
  const threshold = Number.isFinite(initialThreshold) ? Math.max(0, initialThreshold) : 0;
  const filter = Number.isFinite(pointFilter) ? Math.max(0, pointFilter) : 0;
  let total = 0;
  const values = Array.from({ length: count }, (_, index) => {
    const value = Number(frame?.[index]);
    const pressure = Number.isFinite(value) && value > 0 ? value : 0;
    total += pressure;
    return pressure < filter ? 0 : pressure;
  });
  const suppressed = total < threshold;
  if (suppressed) values.fill(0);
  return { values, total, suppressed };
}
