const HAND_GLOVE_CSV_SEGMENT_POINTS = {
  left: {
    littleFinger: [31, 30, 29, 15, 14, 13, 255, 254, 253, 239, 238, 237],
    ringFinger: [28, 27, 26, 12, 11, 10, 252, 251, 250, 236, 235, 234],
    middleFinger: [25, 24, 23, 9, 8, 7, 249, 248, 247, 233, 232, 231],
    indexFinger: [22, 21, 20, 6, 5, 4, 246, 245, 244, 230, 229, 228],
    thumb: [19, 18, 17, 3, 2, 1, 243, 242, 241, 227, 226, 225],
    fingerRoot: [222, 219, 216, 213, 210],
    palm: [
      207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196,
      191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 180,
      179, 178, 177, 175, 174, 173, 172, 171, 170, 169, 168, 167,
      166, 165, 164, 163, 162, 161, 159, 158, 157, 156, 155, 154,
      153, 152, 151, 150, 149, 148, 147, 146, 145, 143, 142, 141,
      140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129,
    ],
  },
  right: {
    littleFinger: [228, 227, 226, 244, 243, 242, 4, 3, 2, 20, 19, 18],
    ringFinger: [231, 230, 229, 247, 246, 245, 7, 6, 5, 23, 22, 21],
    middleFinger: [234, 233, 232, 250, 249, 248, 10, 9, 8, 26, 25, 24],
    indexFinger: [237, 236, 235, 253, 252, 251, 13, 12, 11, 29, 28, 27],
    thumb: [240, 239, 238, 256, 255, 254, 16, 15, 14, 32, 31, 30],
    fingerRoot: [35, 38, 41, 44, 47],
    palm: [
      61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50,
      80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69,
      68, 67, 66, 96, 95, 94, 93, 92, 91, 90, 89, 88,
      87, 86, 85, 84, 83, 82, 112, 111, 110, 109, 108, 107,
      106, 105, 104, 103, 102, 101, 100, 99, 98, 128, 127, 126,
      125, 124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114,
    ],
  },
};


/** 从256点原始手帧提取各手指、指根和手掌的采集值。 */
function buildHandGloveCsvSegments(pressureData, side = 'left') {
  const data = Array.isArray(pressureData) ? pressureData : [];
  const points = HAND_GLOVE_CSV_SEGMENT_POINTS[side] || HAND_GLOVE_CSV_SEGMENT_POINTS.left;
  const readPoints = (pointIndexes = []) => pointIndexes.map((pointIndex) => data[pointIndex - 1] ?? 0);

  return {
    littleFinger: JSON.stringify(readPoints(points.littleFinger)),
    ringFinger: JSON.stringify(readPoints(points.ringFinger)),
    middleFinger: JSON.stringify(readPoints(points.middleFinger)),
    indexFinger: JSON.stringify(readPoints(points.indexFinger)),
    thumb: JSON.stringify(readPoints(points.thumb)),
    fingerRoot: JSON.stringify(readPoints(points.fingerRoot)),
    palm: JSON.stringify(readPoints(points.palm)),
  };
}


module.exports = { buildHandGloveCsvSegments };
