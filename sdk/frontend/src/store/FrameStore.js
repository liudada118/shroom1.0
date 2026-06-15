export function createFrameKey(sensorType, channel = 'sit') {
  return `${sensorType || 'unknown'}:${channel || 'sit'}`;
}

export class FrameStore {
  constructor() {
    this.frames = new Map();
    this.listeners = new Set();
  }

  update(frame) {
    const key = createFrameKey(frame.sensorType, frame.channel);
    this.frames.set(key, frame);
    this.emit(frame);
    return frame;
  }

  updateMany(frames = []) {
    frames.forEach((frame) => this.update(frame));
  }

  getFrame(sensorType, channel = 'sit') {
    return this.frames.get(createFrameKey(sensorType, channel)) || null;
  }

  getFrames(sensorType) {
    return [...this.frames.values()].filter((frame) => !sensorType || frame.sensorType === sensorType);
  }

  getChannels(sensorType) {
    return this.getFrames(sensorType).reduce((acc, frame) => {
      acc[frame.channel] = frame;
      return acc;
    }, {});
  }

  clear(sensorType = null) {
    if (!sensorType) {
      this.frames.clear();
      this.emit(null);
      return;
    }

    [...this.frames.keys()]
      .filter((key) => key.startsWith(`${sensorType}:`))
      .forEach((key) => this.frames.delete(key));
    this.emit(null);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(frame) {
    this.listeners.forEach((listener) => listener(frame, this));
  }
}
