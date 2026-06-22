const { DelimiterParser } = require('@serialport/parser-delimiter');

const SERIAL_PARSER_CHANNELS = Object.freeze({
  SIT: 'sit',
  BACK: 'back',
  HEAD: 'head',
  BIG_BED_SIT: 'bigBedSit',
  SMALL_BED_12B: 'smallBed12B',
});

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

  return {
    channels: SERIAL_PARSER_CHANNELS,
    getParser,
    getSitParser,
    onData,
    pipe,
    pipeSit,
  };
}

module.exports = {
  SERIAL_PARSER_CHANNELS,
  createSerialParserManager,
};
