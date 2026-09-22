const { performance } = require('node:perf_hooks');

/** 按单调时钟推进回放；onTick(steps) 接收实际经过的帧数，不补发积压的中间帧。 */
function createPlaybackTimerService({
  getInterval,
  onTick,
  onStop,
  now = () => performance.now(),
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let timer = null;
  let playing = false;

  /**
   * 清理当前定时器句柄，但不修改播放状态。
   */
  function clearTimer() {
    if (timer != null) {
      cancel(timer);
      timer = null;
    }
  }

  /**
   * 停止历史回放，并通知调用方同步运行时状态。
   */
  function stop() {
    playing = false;
    clearTimer();
    onStop?.();
  }

  /**
   * 从当前位置按新 interval 计时，onTick 返回 false 时停止。
   * ⚠️ 按已过时间合并帧推进，忙时只发布最新到期帧，否则卡顿后会拖慢或突发追帧。
   */
  function start() {
    playing = true;
    clearTimer();
    const requestedInterval = Number(getInterval?.());
    const interval = Number.isFinite(requestedInterval) && requestedInterval > 0 ? requestedInterval : 1;
    let lastFrameTime = now();

    /** 每次唤醒最多发布一次，把处理耗时计入下一次到期时间。 */
    function tick() {
      timer = null;
      if (!playing) return;
      const steps = Math.floor((now() - lastFrameTime) / interval);
      if (steps > 0) {
        lastFrameTime += steps * interval;
        if (onTick?.(steps) === false) {
          stop();
          return;
        }
      }
      if (playing) timer = schedule(tick, Math.max(1000 / 60, lastFrameTime + interval - now()));
    }

    timer = schedule(tick, Math.max(1000 / 60, interval));
  }

  /**
   * 查询当前是否处于播放状态。
   *
   * @returns {boolean} 是否正在播放。
   */
  function isPlaying() {
    return playing;
  }

  return {
    isPlaying,
    start,
    stop,
  };
}

module.exports = {
  createPlaybackTimerService,
};
