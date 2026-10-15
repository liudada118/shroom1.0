/** 把已校验的 hand 帧转到桌面 jqbed 点位，再送入三个视图共用的通道。
 * ⚠️ USB 仅在这里重排一次；演示帧已经是显示坐标，重排会使热点位置错乱。
 */
export function createMobileDisplayFrame(frame) {
  const values = frame.source === 'usb'
    ? Array.from({ length: 1024 }, (_, index) => {
      const row = Math.floor(index / 32);
      const sourceRow = row < 17 ? row + 15 : 31 - row;
      return frame.values[sourceRow * 32 + index % 32];
    })
    : [...frame.values];
  return { channels: { sit: values } };
}
