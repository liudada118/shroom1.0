const assert = require('assert');
const {
  createSerialParserManager,
} = require('../../serial/serialParserManager');

const manager = createSerialParserManager({
  frameDelimiter: Buffer.from([0xaa, 0x55]),
  smallBed12BDelimiter: Buffer.from([0x0d, 0x0a]),
});

const sitFrames = [];
const smallBedFrames = [];
const sitHandler = (frame) => {
  sitFrames.push([...frame]);
};
manager.onData(manager.channels.SIT, sitHandler);
manager.onData(manager.channels.SMALL_BED_12B, (frame) => {
  smallBedFrames.push([...frame]);
});

manager.getParser(manager.channels.SIT).write(Buffer.from([1, 2, 0xaa, 0x55]));
manager.offData(manager.channels.SIT, sitHandler);
manager.getParser(manager.channels.SIT).write(Buffer.from([9, 9, 0xaa, 0x55]));
manager.getParser(manager.channels.SMALL_BED_12B).write(Buffer.from([3, 4, 0x0d, 0x0a]));

assert.deepStrictEqual(sitFrames, [[1, 2]]);
assert.deepStrictEqual(smallBedFrames, [[3, 4]]);
assert.throws(() => manager.getParser('missing'), /unknown serial parser channel/);

console.log('serialParserManager.test.js passed');
