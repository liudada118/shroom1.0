const assert = require('node:assert/strict');
const { createPlaybackTimerService } = require('../../kernel/playback/playbackTimerService');
const { createRuntimeControlService } = require('../../kernel/platform/commands/runtimeControlService');

/** 可控单调时钟；fireAt 可模拟事件循环晚唤醒，不使用真实睡眠。 */
function createClock() {
  let time = 0;
  let nextId = 1;
  const tasks = new Map();
  return {
    now: () => time,
    schedule: (callback, delay) => {
      const id = nextId++;
      tasks.set(id, { callback, due: time + delay });
      return id;
    },
    cancel: (id) => tasks.delete(id),
    fireAt: (value) => {
      time = value;
      const due = [...tasks].filter(([, task]) => task.due <= time);
      for (const [id, task] of due) { tasks.delete(id); task.callback(); }
    },
    pending: () => tasks.size,
    advance: (value) => { time += value; },
  };
}

/** 将真实命令服务和定时器连在一起，记录每次实际使用的 interval。 */
function createPlayback() {
  const clock = createClock();
  const runtime = { detectedInterval: 10, interval: 10, playFlag: false, nowIndex: 0 };
  const ticks = [];
  const starts = [];
  const timer = createPlaybackTimerService({
    ...clock,
    getInterval: () => runtime.interval,
    onTick: (steps) => { runtime.nowIndex += steps; ticks.push(steps); },
    onStop: () => { runtime.playFlag = false; },
  });
  const service = createRuntimeControlService({
    getRuntime: () => ({ ...runtime }),
    setRuntime: (patch) => Object.assign(runtime, patch),
    startPlaybackTimer: () => { starts.push(runtime.interval); runtime.playFlag = true; timer.start(); },
    stopPlaybackTimer: () => timer.stop(),
  });
  return { clock, runtime, ticks, starts, timer, service };
}

{
  const { service, clock, runtime, starts } = createPlayback();
  service.updateHistoryPlayback({ play: true });
  clock.fireAt(100);
  assert.equal(runtime.nowIndex, 10);
  service.updateHistoryPlayback({ speed: 2 });
  clock.fireAt(200);
  assert.equal(runtime.nowIndex, 30, '选 2X 后立即按新速度推进');
  service.updateHistoryPlayback({ speed: 0.25 });
  clock.fireAt(300);
  assert.equal(runtime.nowIndex, 32, '切换回慢速立即生效');
  service.updateHistoryPlayback({ speed: 1.5 });
  assert.deepEqual(starts, [10, 5, 40, 10 / 1.5], '不截断小数且重启前已经写入间隔');
  clock.fireAt(500);
  assert.equal(runtime.nowIndex, 62);
  service.updateHistoryPlayback({ play: false });
  clock.fireAt(10000);
  assert.equal(runtime.nowIndex, 62, '暂停时间不计入回放');
  service.updateHistoryPlayback({ speed: 2 });
  assert.equal(clock.pending(), 0, '暂停时改倍速不能自动播放');
  service.updateHistoryPlayback({ play: true });
  clock.fireAt(10100);
  assert.equal(runtime.nowIndex, 82, '恢复播放不会追赶暂停时间');
  service.updateHistoryPlayback({ history: false, play: true });
  assert.equal(runtime.playFlag, false);
  assert.equal(clock.pending(), 0);
}

{
  const { service, clock, runtime, ticks } = createPlayback();
  service.updateHistoryPlayback({ play: true, speed: 2 });
  clock.fireAt(17);
  clock.fireAt(81);
  clock.fireAt(199);
  clock.fireAt(1000);
  assert.equal(runtime.nowIndex, 200, '抖动唤醒仍按经过的一秒推进，不随回调次数减速');
  assert.equal(ticks.length, 4, '晚唤醒只发布最新到期帧，不突发补发所有积压帧');
  assert.equal(clock.pending(), 1, '重复变速后只保留一个计时器');
}

{
  const clock = createClock();
  let frames = 0;
  const timer = createPlaybackTimerService({
    ...clock, getInterval: () => 2.5,
    onTick: (steps) => { frames += steps; clock.advance(8); return frames < 20; },
  });
  timer.start();
  clock.fireAt(20);
  clock.fireAt(50);
  assert.equal(frames, 20, '帧处理耗时和小数间隔不累积为慢放');
  assert.equal(timer.isPlaying(), false);
  assert.equal(clock.pending(), 0);
}

{
  const { service, runtime, starts } = createPlayback();
  for (const speed of [0, -1, NaN, Infinity, 'invalid']) {
    assert.throws(() => service.updateHistoryPlayback({ speed, play: true }), /倍速必须是正数/);
  }
  assert.equal(runtime.interval, 10);
  assert.equal(starts.length, 0, '非法倍速不得先变更运行态或启动定时器');
}

console.log('playbackTiming.test.js passed');
