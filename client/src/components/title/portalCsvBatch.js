/** 保留合法批次 ID 的首次顺序，不把空输入变成一次全量导出。 */
function normalizeDates(dates) {
  return [...new Set((Array.isArray(dates) ? dates : []).filter((date) =>
    (typeof date === 'string' && date.trim())
    || (typeof date === 'number' && Number.isFinite(date))))];
}

/** 把已返回的文件路径和元信息合并成最终摘要，保留中途失败前的产物。 */
function appendUnique(target, values) {
  const keys = new Set(target.map((value) => JSON.stringify(value)));
  for (const value of Array.isArray(values) ? values : []) {
    const key = JSON.stringify(value);
    if (!keys.has(key)) {
      target.push(value);
      keys.add(key);
    }
  }
}

/**
 * 串行导出采集批次，HTTP 接受和 WS 完成同时到达才发送下一条。
 * 明确的导出失败会继续；请求拒绝或超时因结果不确定而停止，不自动重试。
 * ⚠️ WS 终态没有批次 ID，调用方必须保证当前窗口只有这一个导出队列。
 */
export function createPortalCsvBatch({
  dates,
  exportOne,
  onStatus = () => {},
  onState = () => {},
  timeoutMs = 120000,
}) {
  const queue = normalizeDates(dates);
  const total = queue.length;
  const failures = [];
  const files = [];
  const artifacts = [];
  const skippedChannels = [];
  const waitMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000;
  let phase = 'idle';
  let completed = 0;
  let current = null;
  let nextTimer = null;
  let downloadDir = '';

  /** 上报不可变状态快照，completed 只统计已确认终态的记录。 */
  function publishState() {
    onState({ phase, completed, total, currentDate: current?.date ?? null,
      failures: failures.map((failure) => ({ ...failure })) });
  }

  /** 保存文件摘要，让最后一次终态包含先前记录产生的全部文件。 */
  function rememberArtifacts(detail) {
    appendUnique(files, detail.downloadFiles);
    appendUnique(artifacts, detail.downloadArtifacts);
    appendUnique(skippedChannels, detail.downloadSkippedChannels);
    downloadDir = detail.downloadDir || detail.csvDownloadProgress?.dir || downloadDir;
  }

  /** 输出下载产物快照，不允许接收方原地改动队列内部集合。 */
  function artifactSnapshot() {
    return { downloadFiles: [...files], downloadArtifacts: [...artifacts],
      downloadSkippedChannels: [...skippedChannels], downloadDir };
  }

  /** 每个批次有自己的无活动看门狗；结束或卸载必须释放它。 */
  function clearCurrentTimer() {
    if (current?.timer != null) {
      clearTimeout(current.timer);
      current.timer = null;
    }
  }

  /** 当前请求收到有效活动后续期，旧请求或卸载后的响应不能恢复计时器。 */
  function renewActivityTimer(item) {
    if (phase !== 'running' || current !== item || item.finished) return;
    clearCurrentTimer();
    item.timer = setTimeout(() => {
      if (phase === 'running' && current === item && !item.finished) {
        stopUncertain(new Error(`记录 ${item.date} 长时间未收到导出活动`));
      }
    }, waitMs);
  }

  /** 将单条记录的进度折算成整个批量下载的百分比。 */
  function publishProgress(detail = {}, currentPercent = current?.percent || 0) {
    const { download, csvDownloadProgress, ...rest } = detail;
    onStatus({ ...rest, ...artifactSnapshot(), downloadStatus: 'progress',
      csvDownloadProgress: { ...csvDownloadProgress,
        percent: total ? Math.min(100, ((completed + currentPercent / 100) / total) * 100) : 0,
        batchCompleted: completed, batchTotal: total, date: current?.date ?? csvDownloadProgress?.date,
      } });
  }

  /** 结果不确定时只停后续调度，不宣称已经取消服务端正在写入的文件。 */
  function stopUncertain(error) {
    if (phase !== 'running') return;
    const date = current?.date;
    clearCurrentTimer();
    if (nextTimer != null) clearTimeout(nextTimer);
    nextTimer = null;
    const message = error instanceof Error ? error.message : String(error || '导出状态未确认');
    failures.push({ date, error: message, uncertain: true });
    phase = 'stopped';
    publishState();
    onStatus({ ...artifactSnapshot(), download: 'export csv failed', downloadStatus: 'failed',
      downloadError: `${message}；本条导出结果尚未确认，后续记录已停止。服务端可能仍在写入，请确认后再操作。`,
      downloadBatchFailures: failures.map((failure) => ({ ...failure })),
    });
    current = null;
  }

  /** 一条记录的 ACK 和终态均确认后才结算，重复终态不得重复计数。 */
  function finishCurrent() {
    if (phase !== 'running' || !current || current.finished || !current.ack || !current.terminal) return;
    current.finished = true;
    clearCurrentTimer();
    const detail = current.terminal;
    rememberArtifacts(detail);
    if (detail.download === 'export csv failed') {
      failures.push({ date: current.date, error: detail.downloadError || '本条记录导出失败', uncertain: false });
    }
    completed += 1;
    if (completed === total) {
      phase = 'completed';
      current = null;
      publishState();
      const { csvDownloadProgress, ...terminalDetail } = detail;
      onStatus({ ...terminalDetail, ...artifactSnapshot(),
        download: failures.length ? 'export csv failed' : 'export csv success',
        downloadStatus: failures.length ? 'failed' : 'success',
        downloadError: failures.map((failure) => `${failure.date}：${failure.error}`).join('；'),
        downloadBatchFailures: failures.map((failure) => ({ ...failure })),
        displayMsg: `已处理 ${completed} / ${total} 条记录，${completed - failures.length} 条成功${failures.length ? `，${failures.length} 条失败` : ''}。`,
      });
      return;
    }
    publishProgress(detail, 0);
    publishState();
    // ⚠️ 终态缺少记录身份；下一轮任务再调度，避免同轮重复终态误算下一条。
    nextTimer = setTimeout(beginNext, 0);
  }

  /** 仅发出当前一个请求；ACK 和匹配记录的进度会续期无活动时限。 */
  function beginNext() {
    nextTimer = null;
    if (phase !== 'running') return;
    current = { date: queue[completed], ack: false, terminal: null, finished: false, percent: 0, timer: null };
    const item = current;
    renewActivityTimer(item);
    publishState();
    try {
      Promise.resolve(exportOne(item.date)).then(() => {
        if (phase !== 'running' || current !== item) return;
        item.ack = true;
        renewActivityTimer(item);
        finishCurrent();
      }, (error) => {
        if (phase === 'running' && current === item) stopUncertain(error);
      });
    } catch (error) {
      stopUncertain(error);
    }
  }

  /** 队列只能启动一次；空集合不发送导出，也不伪造导出成功。 */
  function start() {
    if (phase !== 'idle') return false;
    if (!total) {
      phase = 'completed';
      publishState();
      return false;
    }
    phase = 'running';
    beginNext();
    return true;
  }

  /**
   * 接收当前串行请求的 WS 进度或终态，返回是否消费本条事件。
   * 有 date 的进度必须匹配；无身份的迟到终态无法跨不同导出方可靠区分。
   */
  function handleStatus(detail = {}) {
    if (phase !== 'running' || !current || !detail || typeof detail !== 'object') return false;
    const terminal = ['export csv success', 'export csv failed'].includes(detail.download);
    if (!terminal && !detail.csvDownloadProgress) return false;
    if (current.finished || current.terminal) return true;
    const progress = detail.csvDownloadProgress;
    const eventDate = progress?.date ?? detail.date;
    if (eventDate != null && String(eventDate) !== String(current.date)) return false;
    if (terminal || eventDate != null) renewActivityTimer(current);
    rememberArtifacts(detail);
    if (terminal) {
      current.terminal = detail;
      finishCurrent();
    } else {
      current.percent = Math.max(current.percent, Math.min(100, Math.max(0, Number(progress.percent) || 0)));
      publishProgress(detail);
    }
    return true;
  }

  /** 卸载时停止回调和后续调度；不发送后端取消命令或自动重试。 */
  function dispose() {
    clearCurrentTimer();
    if (nextTimer != null) clearTimeout(nextTimer);
    nextTimer = null;
    phase = 'disposed';
    current = null;
  }

  return { start, handleStatus, dispose };
}
