const assert = require('assert');
const Database = require('better-sqlite3');
const { ensureChannelHistorySchema } = require('../../kernel/storage/dbManager');
const { createServerHistoryLoader } = require('../fixtures/serverHistoryLoader.cjs');

const sit = ensureChannelHistorySchema(new Database(':memory:'));
const back = ensureChannelHistorySchema(new Database(':memory:'));
try {
  const insert = back.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)');
  back.transaction(() => {
    for (let index = 0; index < 50001; index++) insert.run(JSON.stringify({ pressureData: [12, 24], rotate: [0, 0, 0, 1] }), 1000 + index * 5, 'large');
    for (let index = 0; index < 428; index++) insert.run(JSON.stringify({ pressureData: Array(256).fill(12), rotate: [0, 0, 0, 1] }), 1000 + index * 5, 'right');
  })();
  const loader = createServerHistoryLoader({ sit, back });
  assert.strictEqual(loader.load('right').length, 428);
  assert.deepStrictEqual(Array.from(loader.load('right').availableChannels), ['back']);
  assert.strictEqual(loader.state.get('localDataBack').length, 428);
  assert.strictEqual(loader.events.at(-1).pressArr[0], 3072);
  assert.ok(loader.loads.some(({ count, eager }) => count === 428 && eager));
  assert.strictEqual(loader.load('large').length, 50001);
  assert.ok(loader.loads.some(({ count, eager }) => count === 50001 && !eager));
  assert.strictEqual(loader.state.get('localDataBack')[50000].timestamp, 251000);
  assert.equal(loader.getTiming().interval, 5, '长记录使用连续帧间隔，不能用抽样曲线间隔');
  back.prepare('DELETE FROM matrix WHERE date = ? AND timestamp = ?').run('large', 251000);
  assert.strictEqual(loader.load('large').length, 50000);
  assert.ok(loader.loads.some(({ count, eager }) => count === 50000 && eager));

  sit.prepare('INSERT INTO matrix(data,timestamp,date,channel_id,display_system_id,sensor_id,output_channel) VALUES (?,?,?,?,?,?,?)')
    .run(JSON.stringify({ data: [10, 20] }), 1000, 'canonical', 'custom:sit', 'custom', 'sit', 'sit');
  assert.strictEqual(loader.load('canonical').length, 1);
  assert.strictEqual(loader.events.at(-1).channelIds[0], 'custom:sit');
  assert.strictEqual(loader.errors.length, 0);
  assert.throws(() => loader.load('missing'), /没有可回放的数据/);
  assert.strictEqual(loader.events.at(-1).length, 0);

  let now = 0;
  let scheduledTick = null;
  const scheduled = createServerHistoryLoader({ sit, back }, 'hand0205', {
    now: () => now,
    schedule: (callback) => { scheduledTick = callback; return 1; },
    cancel: () => { scheduledTick = null; },
  });
  scheduled.load('right');
  scheduled.timer.start();
  now = 100;
  scheduledTick();
  assert.equal(scheduled.frames.at(-1), 20, '生产回调使用到期帧数，100ms 推进 20 帧');
  now = 10000;
  scheduledTick();
  assert.deepEqual(scheduled.frames, [20, 427], '只发布到期帧，末帧不越界且不补发积压帧');
  assert.equal(scheduled.timer.isPlaying(), false);
  scheduled.load('canonical');
  scheduled.timer.start();
  now += 100;
  scheduledTick();
  assert.equal(scheduled.frames.length, 2, '单帧记录不能发布不存在的第二帧');
  assert.equal(scheduled.timer.isPlaying(), false);
} finally {
  sit.close(); back.close();
}
console.log('serverHistoryLoader.test.js passed');
