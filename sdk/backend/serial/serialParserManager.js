const { DelimiterParser } = require('@serialport/parser-delimiter');
const { Transform } = require('stream');
const {
  PROTOCOL_FRAMING_TYPES,
  normalizeProtocolConfig,
} = require('../protocol/displaySystemProtocol');

const SERIAL_PARSER_CHANNELS = Object.freeze({
  SIT: 'sit',
  BACK: 'back',
  HEAD: 'head',
  BIG_BED_SIT: 'bigBedSit',
  SMALL_BED_12B: 'smallBed12B',
});

class FixedLengthParser extends Transform {
  constructor({ length }) {
    super();
    this.length = length;
    this.pending = Buffer.alloc(0);
  }

  _transform(chunk, _encoding, callback) {
    this.pending = Buffer.concat([this.pending, Buffer.from(chunk)]);
    while (this.pending.length >= this.length) {
      this.push(this.pending.subarray(0, this.length));
      this.pending = this.pending.subarray(this.length);
    }
    callback();
  }
}

function createParserFromProtocol(protocol) {
  const normalized = normalizeProtocolConfig(protocol);
  if (!normalized) throw new Error('serial protocol config is required');
  if (normalized.framing.type === PROTOCOL_FRAMING_TYPES.FIXED_LENGTH) {
    return new FixedLengthParser({ length: normalized.framing.frameLength });
  }
  return new DelimiterParser({
    delimiter: Buffer.from(normalized.framing.delimiter),
    includeDelimiter: normalized.framing.includeDelimiter,
  });
}

function createSerialParserManager({
  frameDelimiter,
  smallBed12BDelimiter,
}) {
  const parsers = new Map([
    [SERIAL_PARSER_CHANNELS.SIT, new DelimiterParser({ delimiter: frameDelimiter })],
    [SERIAL_PARSER_CHANNELS.BACK, new DelimiterParser({ delimiter: frameDelimiter })],
    [SERIAL_PARSER_CHANNELS.HEAD, new DelimiterParser({ delimiter: frameDelimiter })],
    [SERIAL_PARSER_CHANNELS.BIG_BED_SIT, new DelimiterParser({ delimiter: frameDelimiter })],
    [SERIAL_PARSER_CHANNELS.SMALL_BED_12B, new DelimiterParser({ delimiter: smallBed12BDelimiter })],
  ]);

  function registerChannel(channel, protocol, { replace = false } = {}) {
    const normalizedChannel = String(channel || '').trim();
    if (!normalizedChannel) throw new Error('serial parser channel is required');
    if (parsers.has(normalizedChannel) && !replace) return normalizedChannel;
    parsers.set(normalizedChannel, createParserFromProtocol(protocol));
    return normalizedChannel;
  }

  function hasChannel(channel) {
    return parsers.has(channel);
  }

  function getParser(channel) {
    const parser = parsers.get(channel);
    if (!parser) {
      throw new Error(`unknown serial parser channel: ${channel}`);
    }
    return parser;
  }

  function getSitParser(sensorType, { smallBed12BType }) {
    return sensorType === smallBed12BType
      ? getParser(SERIAL_PARSER_CHANNELS.SMALL_BED_12B)
      : getParser(SERIAL_PARSER_CHANNELS.SIT);
  }

  function pipe(port, channel) {
    return port.pipe(getParser(channel));
  }

  function pipeSit(port, sensorType, { smallBed12BType }) {
    return port.pipe(getSitParser(sensorType, { smallBed12BType }));
  }

  function onData(channel, handler) {
    getParser(channel).on('data', handler);
  }

  function offData(channel, handler) {
    getParser(channel).removeListener('data', handler);
  }

  return {
    channels: SERIAL_PARSER_CHANNELS,
    hasChannel,
    listChannels: () => [...parsers.keys()],
    getParser,
    getSitParser,
    offData,
    onData,
    pipe,
    pipeSit,
    registerChannel,
  };
}

module.exports = {
  FixedLengthParser,
  SERIAL_PARSER_CHANNELS,
  createParserFromProtocol,
  createSerialParserManager,
};
