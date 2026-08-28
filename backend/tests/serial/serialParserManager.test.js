const assert = require('assert');
const {
  createSerialParserManager,
} = require('@shroom/backend/serial/serialParserManager.js');

const manager = createSerialParserManager({
  frameDelimiter: Buffer.from([0xaa, 0x55]),
  smallBed12BDelimiter: Buffer.from([0x0d, 0x0a]),
});

const sitFrames = [];
const smallBedFrames = [];
const fixedFrames = [];
const customFrames = [];
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

manager.registerChannel('custom-fixed', {
  baudRate: 115200,
  framing: { type: 'fixedLength', frameLength: 3 },
  decoding: { valueType: 'uint8' },
});
manager.onData('custom-fixed', (frame) => fixedFrames.push([...frame]));
manager.getParser('custom-fixed').write(Buffer.from([1, 2, 3, 4, 5, 6]));

manager.registerChannel('custom-delimiter', {
  baudRate: 921600,
  framing: { type: 'delimiter', delimiter: [0xfe, 0xff] },
  decoding: { valueType: 'uint8' },
});
manager.onData('custom-delimiter', (frame) => customFrames.push([...frame]));
manager.getParser('custom-delimiter').write(Buffer.from([7, 8, 0xfe, 0xff]));

assert.deepStrictEqual(sitFrames, [[1, 2]]);
assert.deepStrictEqual(smallBedFrames, [[3, 4]]);
assert.deepStrictEqual(fixedFrames, [[1, 2, 3], [4, 5, 6]]);
assert.deepStrictEqual(customFrames, [[7, 8]]);
assert.strictEqual(manager.hasChannel('custom-fixed'), true);
assert.ok(manager.listChannels().includes('custom-delimiter'));
assert.throws(() => manager.getParser('missing'), /unknown serial parser channel/);

console.log('serialParserManager.test.js passed');
