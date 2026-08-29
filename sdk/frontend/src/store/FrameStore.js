export function createFrameKey(sensorTypeOrFrame, channel = 'sit', displaySystemId = '') {
  if (sensorTypeOrFrame && typeof sensorTypeOrFrame === 'object') {
    const frame = sensorTypeOrFrame;
    if (typeof frame.channelId === 'string' && frame.channelId.trim()) {
      return frame.channelId.trim();
    }
    const frameDisplaySystemId = String(frame.displaySystemId || '').trim();
    const frameSensorId = String(frame.sensorId || frame.outputChannel || frame.channel || '').trim();
    if (frameDisplaySystemId && frameSensorId) {
      return `${frameDisplaySystemId}:${frameSensorId}`;
    }
    return `${frame.sensorType || 'unknown'}:${frame.channel || 'sit'}`;
  }

  const identity = String(sensorTypeOrFrame || 'unknown').trim();
  if (identity.includes(':') && channel === 'sit' && !displaySystemId) return identity;
  return displaySystemId
    ? `${displaySystemId}:${channel || 'sit'}`
    : `${identity}:${channel || 'sit'}`;
}

export class FrameStore {
  constructor() {
    this.frames = new Map();
    this.listeners = new Set();
  }

  update(frame) {
    const key = createFrameKey(frame);
    this.frames.set(key, frame);
    this.emit(frame);
    return frame;
  }

  updateMany(frames = []) {
    frames.forEach((frame) => this.update(frame));
  }

  getFrame(sensorType, channel = 'sit', { displaySystemId = '' } = {}) {
    const direct = this.frames.get(createFrameKey(sensorType, channel, displaySystemId));
    if (direct || displaySystemId || String(sensorType || '').includes(':')) return direct || null;
    return [...this.frames.values()].find(
      (frame) => frame.sensorType === sensorType && frame.channel === channel,
    ) || null;
  }

  getFrameByChannelId(channelId) {
    return this.frames.get(createFrameKey(channelId)) || null;
  }

  getFrames(identity) {
    return [...this.frames.values()].filter((frame) => (
      !identity
      || frame.sensorType === identity
      || frame.displaySystemId === identity
    ));
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

    [...this.frames.entries()]
      .filter(([, frame]) => (
        frame.sensorType === sensorType || frame.displaySystemId === sensorType
      ))
      .forEach(([key]) => this.frames.delete(key));
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
