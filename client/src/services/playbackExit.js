import { commandClient } from './command/commandClient';
import i18n from '../i18n';

/** 退出前等待暂停回放的真实回执；不切实时或开串口，历史专用许可也能退出。 */
export async function stopPlaybackBeforeExit({ signal, timeoutMs = 10000,
  stop = () => commandClient.execute('playback.control', { play: false, history: false }) } = {}) {
  if (signal?.aborted) throw signal.reason || new DOMException('退出已取消', 'AbortError');
  let timer;
  let cancel;
  try {
    await new Promise((resolve, reject) => {
      cancel = () => reject(signal.reason || new DOMException('退出已取消', 'AbortError'));
      signal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => reject(new Error(i18n.t('monitorUi.playbackExitTimeout'))), timeoutMs);
      Promise.resolve(stop()).then(resolve, reject);
    });
    if (signal?.aborted) throw signal.reason || new DOMException('退出已取消', 'AbortError');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
