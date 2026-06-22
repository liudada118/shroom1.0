const HAND_GLOVE_FULL_PACKET_LAYOUT = {
  left: {
    fingerRows: [
      [65, 66, 67, 38, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79],
      [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63],
      [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],
      [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    ],
    fingerTips: [2, 5, 8, 11, 14],
    palm: [
      129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
      145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159,
      161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175,
      177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191,
      193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207,
      209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223,
    ],
    palmLeadingBlankCount: 3,
    palmTopRows: [
      [244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255],
      [228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239],
    ],
  },
  right: {
    fingerRows: [
      [190, 191, 192, 187, 188, 189, 184, 185, 186, 181, 182, 183, 178, 179, 180],
      [206, 207, 208, 203, 204, 205, 200, 201, 202, 197, 198, 199, 194, 195, 196],
      [222, 223, 224, 219, 220, 221, 216, 217, 218, 213, 214, 215, 210, 211, 212],
      [238, 239, 240, 235, 236, 237, 232, 233, 234, 229, 230, 231, 226, 227, 228],
    ],
    fingerTips: [255, 252, 249, 246, 243],
    palm: [
      114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128,
      98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
      82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96,
      66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
      50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
      34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    ],
    palmTrailingBlankCount: 3,
    palmTopRows: [
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
    ],
  },
};

function readHandGlovePoint(pressureData, oneBasedIndex) {
  return pressureData[oneBasedIndex - 1] || 0;
}

function mapHandGloveFullPacketPressure(pressureData, side) {
  const layout = HAND_GLOVE_FULL_PACKET_LAYOUT[side] || HAND_GLOVE_FULL_PACKET_LAYOUT.left;
  const res = new Array(15 * 13).fill(0);

  layout.fingerRows.forEach((row, rowIndex) => {
    row.forEach((oneBasedIndex, colIndex) => {
      res[rowIndex * 15 + colIndex] = readHandGlovePoint(pressureData, oneBasedIndex);
    });
  });

  layout.fingerTips.forEach((oneBasedIndex, fingerIndex) => {
    res[15 * 4 + 1 + fingerIndex * 3] = readHandGlovePoint(pressureData, oneBasedIndex);
  });

  layout.palmTopRows.forEach((row, rowIndex) => {
    const startIndex = 75 + rowIndex * 15 + (layout.palmLeadingBlankCount || 0);
    row.forEach((oneBasedIndex, colIndex) => {
      res[startIndex + colIndex] = readHandGlovePoint(pressureData, oneBasedIndex);
    });
  });

  layout.palm.forEach((oneBasedIndex, index) => {
    res[75 + 2 * 15 + index] = readHandGlovePoint(pressureData, oneBasedIndex);
  });

  return res;
}

function mapHandGloveFullPacketModelMatrix(mappedData) {
  const sourceData = [...mappedData];
  while (sourceData.length < 195) {
    sourceData.push(0);
  }

  for (let i = 4 * 15; i < 5 * 15; i++) {
    sourceData[i] = sourceData[i] / 3;
  }

  const legacyData = [];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 15; j++) {
      legacyData.push(sourceData[i * 15 + 14 - j]);
    }
  }

  for (let i = 75 + 12 - 1; i >= 75; i--) {
    legacyData.push(sourceData[i]);
  }

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 15; j++) {
      legacyData.push(sourceData[75 + 12 + i * 15 + 14 - j]);
    }
  }

  const handPointArr = [[6, 2], [6, 3], [6, 4], [3, 8], [3, 9], [3, 10], [3, 14], [3, 15], [3, 16], [3, 20], [3, 21], [3, 22], [10, 26], [10, 27], [10, 28], [7, 2], [7, 3], [7, 4], [4, 8], [4, 9], [4, 10], [4, 14], [4, 15], [4, 16], [4, 20], [4, 21], [4, 22], [11, 26], [11, 27], [11, 28], [8, 2], [8, 3], [8, 4], [5, 8], [5, 9], [5, 10], [5, 14], [5, 15], [5, 16], [5, 20], [5, 21], [5, 22], [12, 26], [12, 27], [12, 28], [9, 2], [9, 3], [9, 4], [6, 8], [6, 9], [6, 10], [6, 14], [6, 15], [6, 16], [6, 20], [6, 21], [6, 22], [13, 26], [13, 27], [13, 28], [13, 2], [13, 3], [13, 4], [13, 8], [13, 9], [13, 10], [13, 14], [13, 15], [13, 16], [13, 20], [13, 21], [13, 22], [17, 25], [17, 26], [17, 27], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20]];
  const modelData = new Array(32 * 32).fill(0);
  handPointArr.forEach((point, index) => {
    const [row, col] = point;
    modelData[(31 - row) * 32 + col] = legacyData[index] || 0;
    if (index >= 75) {
      modelData[(31 - (row + 1)) * 32 + col] = legacyData[index] || 0;
    }
  });

  return modelData;
}

function getHandGloveFullPacketSide(packetType, fallbackSide) {
  if (packetType === 1) {
    return 'right';
  }
  if (packetType === 2) {
    return 'left';
  }
  return fallbackSide;
}

function parseHandGloveFullPacket(buffer, fallbackSide) {
  const bytes = Array.from(buffer);
  const pressureData = bytes.slice(2, 258);
  const imuBytes = bytes.slice(258, 274);
  const packetType = bytes[1];
  const side = fallbackSide === 'right' ? 'right' : 'left';
  const mappedData = mapHandGloveFullPacketPressure(pressureData, side);

  return {
    frameIndex: bytes[0],
    packetType,
    side,
    pressureData,
    imuBytes,
    mappedData,
  };
}

module.exports = {
  HAND_GLOVE_FULL_PACKET_LAYOUT,
  getHandGloveFullPacketSide,
  mapHandGloveFullPacketModelMatrix,
  mapHandGloveFullPacketPressure,
  parseHandGloveFullPacket,
  readHandGlovePoint,
};
