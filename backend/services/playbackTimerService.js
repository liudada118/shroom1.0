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

  /**
   * 清理当前定时器句柄，但不修改播放状态。
   */
  function clearTimer() {
    if (timer) {
      clearInterval(timer);
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
   * 按当前 interval 启动历史回放定时器。
   * 当 onTick 返回 false 时自动停止播放。
   */
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
