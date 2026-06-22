/**
 * 历史回放定时器服务。
 *
 * 只管理播放定时器生命周期，不关心帧内容、数据库和 WebSocket。
 */
function createPlaybackTimerService({
  getInterval,
  onTick,
  onStop,
}) {
  let timer = null;
  let playing = false;

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function stop() {
    playing = false;
    clearTimer();
    onStop?.();
  }

  function start() {
    playing = true;
    clearTimer();
    timer = setInterval(() => {
      const shouldContinue = onTick?.();
      if (shouldContinue === false) {
        stop();
      }
    }, Math.max(1, Number(getInterval?.() || 1)));
  }

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
