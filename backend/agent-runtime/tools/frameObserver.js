const { isSensorFrameV1Envelope } = require('@shroom/backend/contract');

/** 生成可由任务运行层辨认的诊断错误。 */
function error(code, message) { return Object.assign(new Error(message), { code }); }

/** 有界订阅真实 canonical 帧，只保留统计和八个采样点，结束后关闭 socket。 */
function observeFrames({ WebSocketImpl, wsUrl, systemId, sensorId, durationMs = 3000, maxFrames = 30, expectedPointCount, expectedMatrix, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(error('AGENT_CANCELLED', 'Frame inspection cancelled')); return; }
    const channelId = `${systemId}:${sensorId}`;
    const started = Date.now();
    let socket; let timer; let done = false; let frameCount = 0; let invalidFrames = 0; let unmatchedFrames = 0; let sequenceGaps = 0; let outOfOrder = 0; let pointCountMismatch = 0; let latest = null;
    let emptyFrames = 0; let invalidSampleFrames = 0; let usableRealtimeFrames = 0; let staleFrames = 0;
    let matrixMismatch = 0; let matrixMissing = 0;
    let previousRealtimeTimestamp = null; let duplicateTimestamps = 0; let reverseTimestamps = 0;
    const realtimeIntervals = [];
    const sourceCounts = { realtime: 0, playback: 0 };
    const sequences = { realtime: null, playback: null };
    /** 清理所有观察资源，并返回已获得的证据。 */
    function finish(failure) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (socket) {
        socket.removeAllListeners?.();
        // 连接仍在握手时 terminate 会异步发 error；兜底监听必须留到关闭。
        socket.on?.('error', () => {});
        if (socket.readyState === 0) socket.terminate?.();
        else { try { socket.close(); } catch { socket.terminate?.(); } }
      }
      if (failure) { reject(failure); return; }
      const status = !frameCount ? 'no_frames_observed' : pointCountMismatch ? 'point_count_mismatch'
        : emptyFrames === frameCount ? 'no_valid_samples' : !sourceCounts.realtime ? 'playback_only'
          : sourceCounts.playback ? 'mixed_sources' : matrixMismatch ? 'matrix_mismatch' : matrixMissing ? 'matrix_unavailable'
            : usableRealtimeFrames ? 'realtime_frames_observed' : 'realtime_data_invalid';
      const orderedIntervals = [...realtimeIntervals].sort((a, b) => a - b);
      const timing = { intervalCount: orderedIntervals.length, duplicateTimestamps, reverseTimestamps,
        medianIntervalMs: orderedIntervals.length ? orderedIntervals[Math.floor(orderedIntervals.length / 2)] : null,
        p90IntervalMs: orderedIntervals.length ? orderedIntervals[Math.ceil(orderedIntervals.length * .9) - 1] : null,
        minIntervalMs: orderedIntervals[0] ?? null, maxIntervalMs: orderedIntervals.at(-1) ?? null };
      resolve({ channelId, observedAt: new Date().toISOString(), durationMs: Date.now() - started,
        status, frameCount, invalidFrames, unmatchedFrames, sequenceGaps, outOfOrder, pointCountMismatch, matrixMismatch, matrixMissing, expectedMatrix, latest, sourceCounts, emptyFrames, invalidSampleFrames, staleFrames, usableRealtimeFrames,
        timing,
        liveVerified: usableRealtimeFrames > 0 && pointCountMismatch === 0 && matrixMismatch === 0 && matrixMissing === 0 && invalidSampleFrames === 0 && staleFrames === 0 && invalidFrames === 0 && unmatchedFrames === 0 && sourceCounts.playback === 0 && outOfOrder === 0,
        findings: [!frameCount ? 'No valid canonical frame was observed during this bounded interval; check active system, device connection and protocol.'
          : !sourceCounts.realtime ? 'Only playback frames were observed; this does not verify the connected device.' : 'Canonical realtime frames were observed; inspect the quality counts before accepting the data.',
        ...(pointCountMismatch ? ['Observed point count differs from the saved mapping.'] : []),
        ...(matrixMismatch ? ['Observed matrix rows/cols differ from the saved mapping, even if the point count matches.'] : []),
        ...(matrixMissing ? ['Frame matrix metadata was absent; dimensions remain unverified.'] : []),
        ...(emptyFrames ? ['Some frames were empty or contained no finite measurements.'] : []),
        ...(invalidSampleFrames ? ['Some samples were null or absent; these are not zero pressure measurements.'] : []),
        ...(staleFrames ? ['Some frames were stale or carried a non-good quality flag.'] : []),
        'This observation does not verify frontend rendering or physical calibration.'],
      });
    }
    /** 响应任务取消，不继续等待硬件帧。 */
    function onAbort() { finish(error('AGENT_CANCELLED', 'Frame inspection cancelled')); }
    /** 检查帧身份、版本和数值，再计算有界统计。 */
    function onMessage(raw) {
      if (done) return;
      if (Buffer.byteLength(raw) > 2 * 1024 * 1024) { invalidFrames += 1; return; }
      let frame; try { frame = JSON.parse(String(raw)); } catch { invalidFrames += 1; return; }
      if (frame?.type !== 'sensor.frame') return;
      if (frame.channelId !== channelId) { unmatchedFrames += 1; return; }
      const values = frame.payload?.value;
      if (!isSensorFrameV1Envelope(frame) || frame.displaySystemId !== systemId || frame.sensorId !== sensorId
        || !['realtime', 'playback'].includes(frame.source) || !Number.isSafeInteger(frame.sequence) || frame.sequence < 0
        || !Number.isFinite(frame.timestamp) || frame.timestamp <= 0 || !['good', 'stale', 'error'].includes(frame.quality)
        || values.length > 65536) { invalidFrames += 1; return; }
      let min = Infinity; let max = -Infinity; let sum = 0; let valid = 0;
      for (const value of values) if (value !== null) { min = Math.min(min, value); max = Math.max(max, value); sum += value; valid += 1; }
      const lastSequence = sequences[frame.source];
      if (lastSequence !== null) {
        if (frame.sequence > lastSequence + 1) sequenceGaps += frame.sequence - lastSequence - 1;
        if (frame.sequence <= lastSequence) outOfOrder += 1;
      }
      sequences[frame.source] = frame.sequence;
      if (expectedPointCount && values.length !== expectedPointCount) pointCountMismatch += 1;
      const matrix = frame.payload.matrix;
      if (expectedMatrix) {
        if (!matrix) matrixMissing += 1;
        else if (matrix.rows !== expectedMatrix.rows || matrix.cols !== expectedMatrix.cols) matrixMismatch += 1;
      }
      sourceCounts[frame.source] += 1;
      if (!valid) emptyFrames += 1;
      if (!values.length || valid !== values.length) invalidSampleFrames += 1;
      const stale = frame.quality !== 'good' || (frame.source === 'realtime' && Math.abs(Date.now() - frame.timestamp) > 15000);
      if (stale) staleFrames += 1;
      if (frame.source === 'realtime' && valid > 0 && valid === values.length && (!expectedPointCount || values.length === expectedPointCount) && !stale) {
        usableRealtimeFrames += 1;
        if (previousRealtimeTimestamp !== null) {
          const interval = frame.timestamp - previousRealtimeTimestamp;
          if (interval > 0) realtimeIntervals.push(interval);
          else if (interval === 0) duplicateTimestamps += 1;
          else reverseTimestamps += 1;
        }
        previousRealtimeTimestamp = frame.timestamp;
      }
      frameCount += 1;
      latest = { sequence: frame.sequence, timestamp: frame.timestamp, source: frame.source, quality: frame.quality, matrix: matrix ? { rows: matrix.rows, cols: matrix.cols } : null, pointCount: values.length, validPointCount: valid,
        min: valid ? min : null, max: valid ? max : null, average: valid ? sum / valid : null, sample: values.slice(0, 8) };
      if (frameCount >= maxFrames) finish();
    }
    try {
      socket = new WebSocketImpl(wsUrl, { maxPayload: 2 * 1024 * 1024, handshakeTimeout: Math.min(durationMs, 5000) });
      socket.on('open', () => {
        if (done) return;
        try { socket.send(JSON.stringify({ type: 'subscribe', channels: [channelId], replace: true })); }
        catch { finish(error('AGENT_WS_UNAVAILABLE', 'Local realtime subscription failed')); }
      });
      socket.on('message', onMessage);
      socket.on('error', () => finish(error('AGENT_WS_UNAVAILABLE', 'Local realtime WebSocket is unavailable')));
      socket.on('close', () => finish());
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => finish(), durationMs);
    } catch (cause) { finish(error('AGENT_WS_UNAVAILABLE', cause.message)); }
  });
}

module.exports = { observeFrames };
