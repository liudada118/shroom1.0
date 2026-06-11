import { sensorCommands } from './commands.js';
import { toLegacyCommand } from './legacyCommands.js';
import { normalizeIncomingMessage } from '../store/normalizeFrame.js';

export class SensorClient {
  constructor({ url = 'ws://127.0.0.1:19999', WebSocketImpl = globalThis.WebSocket, legacyProtocol = false } = {}) {
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.legacyProtocol = legacyProtocol;
    this.ws = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect() {
    if (!this.WebSocketImpl) {
      throw new Error('WebSocket implementation is not available');
    }
    if (this.ws && [this.WebSocketImpl.OPEN, this.WebSocketImpl.CONNECTING].includes(this.ws.readyState)) {
      return this.ws;
    }

    this.ws = new this.WebSocketImpl(this.url);
    this.ws.onopen = (event) => {
      this.isConnected = true;
      this.emit('open', event);
    };
    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.emit('close', event);
    };
    this.ws.onerror = (event) => {
      this.emit('error', event);
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    return this.ws;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(messageOrType, payload = {}) {
    const message = typeof messageOrType === 'string'
      ? { type: messageOrType, payload }
      : messageOrType;

    if (!this.ws || this.ws.readyState !== this.WebSocketImpl.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(this.legacyProtocol ? toLegacyCommand(message) : message));
  }

  command(name, payload) {
    const commandFactory = sensorCommands[name];
    if (!commandFactory) {
      throw new Error(`unknown command "${name}"`);
    }
    this.send(commandFactory(payload));
  }

  handleMessage(rawMessage) {
    let parsed;
    try {
      parsed = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    } catch (error) {
      this.emit('error', error);
      return;
    }

    const normalized = normalizeIncomingMessage(parsed);
    this.emit('message', normalized);

    normalized.frames.forEach((frame) => {
      this.emit('frame', frame);
      this.emit(`frame:${frame.sensorType}`, frame);
      this.emit(`frame:${frame.sensorType}:${frame.channel}`, frame);
    });

    if (normalized.type) {
      this.emit(normalized.type, normalized.payload);
    }
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, payload) {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
  }
}
