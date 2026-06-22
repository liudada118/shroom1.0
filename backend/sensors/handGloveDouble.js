const TYPE = 'hand0205Double';
const FIRST_PACKET_LENGTH = 130;
const SECOND_PACKET_LENGTH = 146;
const PACKET_SIDE_BY_TYPE = Object.freeze({
  1: 'left',
  2: 'right',
});

function toPacketBytes(buffer) {
  return Array.from(Buffer.from(buffer || []));
}

function getPacketSide(packetType, fallbackSide = 'left') {
  return PACKET_SIDE_BY_TYPE[Number(packetType)] || fallbackSide;
}

function createHandGloveDoublePacketParser() {
  const chunks = {
    left: [],
    right: [],
  };

  function reset(side) {
    if (side === 'left' || side === 'right') {
      chunks[side] = [];
      return;
    }
    chunks.left = [];
    chunks.right = [];
  }

  function handleFirstPacket(buffer, fallbackSide = 'left') {
    if (!buffer || buffer.length !== FIRST_PACKET_LENGTH) return null;

    const bytes = toPacketBytes(buffer);
    const side = getPacketSide(bytes[1], fallbackSide);
    chunks[side] = bytes.slice(2);
    return {
      complete: false,
      packetType: bytes[1],
      side,
    };
  }

  function handleSecondPacket(buffer, fallbackSide = 'left', sourcePort = 'sit') {
    if (!buffer || buffer.length !== SECOND_PACKET_LENGTH) return null;

    const bytes = toPacketBytes(buffer);
    const side = getPacketSide(bytes[1], fallbackSide);
    const firstChunk = chunks[side] || [];
    const rest = bytes.slice(2);
    const imuBytes = rest.slice(rest.length - 16);
    const secondChunk = rest.slice(0, rest.length - 16);
    const pressureData = [...firstChunk, ...secondChunk];
    chunks[side] = [];

    return {
      complete: true,
      packetType: bytes[1],
      side,
      sourcePort,
      pressureData,
      imuBytes,
    };
  }

  function handlePacket(buffer, fallbackSide = 'left', sourcePort = 'sit') {
    if (!buffer) return null;
    if (buffer.length === FIRST_PACKET_LENGTH) {
      return handleFirstPacket(buffer, fallbackSide);
    }
    if (buffer.length === SECOND_PACKET_LENGTH) {
      return handleSecondPacket(buffer, fallbackSide, sourcePort);
    }
    return null;
  }

  return {
    handleFirstPacket,
    handlePacket,
    handleSecondPacket,
    reset,
  };
}

module.exports = {
  TYPE,
  FIRST_PACKET_LENGTH,
  SECOND_PACKET_LENGTH,
  PACKET_SIDE_BY_TYPE,
  createHandGloveDoublePacketParser,
  getPacketSide,
};
