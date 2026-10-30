export const COLLECTION_NOTICE_DURATION_MS = 6000;
const STORAGE_KEY = 'shroom.collection-notices.v1';
const MAX_RECEIPTS = 100;

/** 用会话与实际保存结果标识回执，忽略广播字段顺序及非结果元数据。 */
export function getCollectionNoticeKey(summary) {
  if (!summary || summary.phase === 'collecting') return '';
  const channels = Object.entries(summary.channels || {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([id, counts]) => [id, counts.committed ?? null, counts.pending ?? null, counts.failed ?? null]);
  return JSON.stringify([summary.id || summary.startedAt || summary.stoppedAt || summary.completedAt || '',
    summary.phase, summary.result, summary.reason || '', channels]);
}

/** 获取本标签页的提示缓存；存储受限时继续使用内存状态。 */
function getSessionStorage() {
  try { return globalThis.sessionStorage; } catch { return null; }
}

/** 管理有限的提示寿命和关闭记录；仅确认保存成功的终态自动收起。 */
export function createCollectionNoticeTracker({ storage = getSessionStorage(), now = Date.now } = {}) {
  const receipts = new Map();
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) {
      for (const entry of saved.slice(-MAX_RECEIPTS)) {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[0].length <= 10000
          && Number.isFinite(entry[1]?.firstSeen) && typeof entry[1]?.dismissed === 'boolean') {
          receipts.set(entry[0], entry[1]);
        }
      }
    }
  } catch { /* 缓存损坏不影响采集结果展示。 */ }

  /** 保存少量已见回执，使切换系统和刷新页面不重置提示寿命。 */
  function persist() {
    while (receipts.size > MAX_RECEIPTS) receipts.delete(receipts.keys().next().value);
    try { storage?.setItem(STORAGE_KEY, JSON.stringify([...receipts])); } catch { /* 继续使用内存去重。 */ }
  }

  /** 首次展示记时；宿主完成时间更早时优先按真实时间过期。 */
  function remaining(summary) {
    const key = getCollectionNoticeKey(summary);
    if (!key) return 0;
    if (summary.phase === 'finalizing') return Infinity;
    if (!receipts.has(key)) {
      receipts.set(key, { firstSeen: now(), dismissed: false });
      persist();
    }
    const receipt = receipts.get(key);
    if (receipt.dismissed) return 0;
    const saved = ['completed', 'interrupted'].includes(summary.phase) && summary.result === 'saved'
      && Object.values(summary.channels || {}).every(channel => !(channel.pending > 0) && !(channel.failed > 0));
    if (!saved) return Infinity;
    const endedAt = summary.completedAt || summary.stoppedAt;
    const started = Number.isFinite(endedAt) && endedAt > 0 ? Math.min(endedAt, receipt.firstSeen) : receipt.firstSeen;
    return Math.max(0, started + COLLECTION_NOTICE_DURATION_MS - now());
  }

  /** 关闭当前结果；同一会话后续出现不同保存结果时仍可提示。 */
  function dismiss(key) {
    if (!key) return;
    receipts.set(key, { firstSeen: receipts.get(key)?.firstSeen ?? now(), dismissed: true });
    persist();
  }

  return { remaining, dismiss };
}

export const collectionNotices = createCollectionNoticeTracker();
