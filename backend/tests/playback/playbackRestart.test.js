const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ensureChannelHistorySchema } = require('../../kernel/storage/dbManager');
const { createServerHistoryLoader } = require('../fixtures/serverHistoryLoader.cjs');

/** 可控时钟只触发当前到期定时器，保留生产调度器的暂停和重新计时行为。 */
function createClock() {
  let time = 0, nextId = 0;
  const tasks = new Map();
  return { now: () => time,
    schedule: (callback, delay) => { const id = ++nextId; tasks.set(id, { callback, due: time + delay }); return id; },
    cancel: id => tasks.delete(id), pending: () => tasks.size,
    advance: milliseconds => {
      time += milliseconds;
      for (const [id, task] of [...tasks]) if (task.due <= time) { tasks.delete(id); task.callback(); }
    } };
}

const db = ensureChannelHistorySchema(new Database(':memory:'));
try {
  const insert = db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)');
  for (let index = 0; index < 4; index++) insert.run(JSON.stringify([index]), 1000 + index * 50, 'record');
  insert.run('[9]', 2000, 'single');
  const clock = createClock();
  const loader = createServerHistoryLoader({ sit: db }, 'smallBedNoAlg', clock);
  loader.load('record');
  loader.start();
  clock.advance(50); clock.advance(50); clock.advance(50);
  assert.deepEqual(loader.frames, [1, 2, 3]);
  assert.equal(loader.timer.isPlaying(), false);
  assert.equal(loader.events.at(-1).playbackStatus.playing, false, '自然结束必须发出按钮停止回执');
  assert.equal(loader.events.at(-1).playbackStatus.recordKey, 'record');
  assert.equal(loader.events.at(-1).playbackStatus.systemId, 'smallBedNoAlg');

  loader.start();
  assert.equal(loader.frames.at(-1), 0, '再次播放立即显示首帧');
  assert.equal(loader.events.at(-1).playbackStatus.playing, true);
  clock.advance(50);
  loader.stop();
  const pausedIndex = loader.state.get('nowIndex');
  clock.advance(10000);
  assert.equal(loader.state.get('nowIndex'), pausedIndex, '暂停不推进');
  loader.start();
  assert.equal(loader.state.get('nowIndex'), pausedIndex, '普通继续不回到首帧');
  clock.advance(50); clock.advance(50);
  assert.deepEqual(loader.frames, [1, 2, 3, 0, 1, 2, 3]);
  assert.equal(loader.timer.isPlaying(), false);

  loader.state.set('indexArr', [1, 2]);
  loader.setInterval(25);
  loader.start();
  assert.equal(loader.frames.at(-1), 1, '选区播放完后回到选区起点');
  clock.advance(25); clock.advance(25);
  assert.deepEqual(loader.frames.slice(-3), [1, 2, 3], '沿用原区间末端加一帧约定');
  assert.equal(loader.getTiming().interval, 25, '重新播放保留选中倍速');
  assert.equal(loader.timer.isPlaying(), false);
  const statuses = loader.events.filter(event => event.playbackStatus).map(event => event.playbackStatus);
  assert.ok(statuses.every((status, index) => index === 0 || status.sequence > statuses[index - 1].sequence));

  loader.load('single');
  const previous = loader.frames.length;
  loader.start(); clock.advance(50);
  assert.deepEqual(loader.frames.slice(previous), [0], '单帧能重新显示，不访问不存在的第二帧');
  assert.equal(loader.events.at(-1).playbackStatus.playing, false);
  loader.start(); clock.advance(50);
  assert.deepEqual(loader.frames.slice(previous), [0, 0], '单帧可反复播放');

  const empty = createServerHistoryLoader({ sit: db }, 'smallBedNoAlg', createClock());
  empty.start();
  assert.equal(empty.timer.isPlaying(), false);
  assert.deepEqual(empty.frames, []);
  assert.equal(empty.events.at(-1).playbackStatus.playing, false, '无记录不留下播放中状态');
} finally { db.close(); }
console.log('playbackRestart.test.js passed');
