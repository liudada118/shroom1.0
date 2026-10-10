import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { requestJson } from './api.js';
import { findDraftForRelease, isStaleDraft, latestPublishedVersion } from './companyRevisionVersions.js';
import './CompanySystemRevisions.css';

/** 未配置员工令牌时只返回空目录，不请求员工接口或把客户密钥当作令牌。 */
export async function readStaffReleases() {
  const status = await requestJson('/api/system-packages/staff-credential');
  if (status.configured !== true) return { releases: [], staffConfigured: false };
  const result = await requestJson('/api/system-packages/staff/releases');
  return { ...result, staffConfigured: true };
}

/** Show published sources and persistent local revision drafts independently of Agent chat history. */
export default function CompanySystemRevisions({ open, initialSystemId = '', editingSystemId = null, onClose, onEditDraft }) {
  const [releases, setReleases] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [review, setReview] = useState(null);

  /** Refresh staff releases and local drafts separately so a server error cannot hide saved work. */
  async function refresh() {
    setLoading(true);
    const [local, remote] = await Promise.allSettled([
      requestJson('/api/system-packages/revisions'),
      readStaffReleases(),
    ]);
    if (local.status === 'fulfilled') setDrafts(local.value.drafts || []);
    else setNotice({ error: true, message: `本机草稿读取失败：${local.reason.message}` });
    if (remote.status === 'fulfilled') {
      setReleases(remote.value.releases || []);
      if (!remote.value.staffConfigured && local.status === 'fulfilled') {
        setNotice({ error: false, message: '此入口用于员工维护公司系统。客户进入已发布系统只需有效软件密钥，无需员工提交令牌。' });
      }
    }
    else {
      setReleases([]);
      setNotice({ error: true, message: `公司系统目录读取失败：${remote.reason.message}。已保存草稿仍可继续编辑。` });
    }
    setLoading(false);
  }

  useEffect(() => { if (open) { setNotice(null); setReview(null); void refresh(); } }, [open]);

  /** Download and copy one signed release into a local draft with a separate identity. */
  async function create(release) {
    setBusy(`create:${release.systemId}`); setNotice(null); setReview(null);
    try {
      const { result } = await requestJson('/api/system-packages/revisions', {
        method: 'POST', body: JSON.stringify({ systemId: release.systemId, version: release.version }),
      });
      const local = await requestJson('/api/system-packages/revisions');
      setDrafts(local.drafts || []);
      setNotice({ draftId: result.draftId, message: result.reused
        ? `已找到 ${result.targetSystemId} 基于发布版 #${result.baseVersion} 的本机草稿，可继续编辑。`
        : `已从 ${result.targetSystemId} 发布版 #${result.baseVersion} 创建本机草稿。正式版本保持只读。` });
    } catch (error) {
      setNotice({ error: true, message: error.message || '创建草稿失败' });
    } finally { setBusy(''); }
  }

  /** Read a fresh package comparison before offering the submit action. */
  async function inspect(draftId) {
    if (draftId === editingSystemId) {
      setNotice({ error: true, message: '此草稿正在编辑。请先保存并显示，再回到配置器提交保存后的版本。' });
      return;
    }
    setBusy(`inspect:${draftId}`); setNotice(null);
    try {
      const { result } = await requestJson(`/api/system-packages/revisions/${encodeURIComponent(draftId)}`);
      setReview(result);
    } catch (error) { setNotice({ error: true, message: error.message || '读取修订差异失败' }); }
    finally { setBusy(''); }
  }

  /** Submit only the reviewed draft; a stale base version stays local for manual reconciliation. */
  async function submit(draftId) {
    if (draftId === editingSystemId) {
      setNotice({ error: true, message: '此草稿正在编辑。请先保存并显示，再回到配置器提交保存后的版本。' });
      return;
    }
    setBusy(`submit:${draftId}`); setNotice(null);
    try {
      const { result } = await requestJson(`/api/system-packages/revisions/${encodeURIComponent(draftId)}/submit`, {
        method: 'POST', body: JSON.stringify({ expectedSha256: review?.packageSha256 }),
      });
      setNotice({ draftId, message: `更新已提交审核（#${result.id}）。超管发布前，客户仍使用原版本。` });
      setReview(null);
    } catch (error) {
      const stale = error.status === 409 && Number.isSafeInteger(error.currentVersion);
      setNotice({ draftId, error: true, message: stale
        ? `已发布系统已更新到 #${error.currentVersion}，此草稿基于旧版本。请核对新版本后重新创建修订草稿；本机草稿未丢失。`
        : error.message || '提交更新失败' });
    } finally { setBusy(''); }
  }

  const sortedReleases = [...releases].sort((a, b) => Number(b.systemId === initialSystemId) - Number(a.systemId === initialSystemId));
  const sortedDrafts = [...drafts].sort((a, b) => Number(b.targetSystemId === initialSystemId) - Number(a.targetSystemId === initialSystemId)
    || a.targetSystemId.localeCompare(b.targetSystemId) || b.baseVersion - a.baseVersion);
  const reviewedLatest = review ? latestPublishedVersion(releases, review.targetSystemId) : null;
  const reviewedStale = review ? isStaleDraft(review, releases) : false;
  const reviewedEditing = review?.draftId === editingSystemId;
  return <Modal className="company-revision-modal" open={open} width={760} title="公司系统库 · 版本更新" footer={null}
    onCancel={() => { if (!busy) onClose(); }} maskClosable={!busy} destroyOnHidden>
    <p className="company-revision-intro">从已发布版本创建本机草稿，使用独立草稿 ID 编辑和预览。提交后保留原系统 ID，由超管审核发布。</p>
    <div className="company-revision-toolbar"><button type="button" onClick={() => void refresh()} disabled={Boolean(busy) || loading}>刷新系统库</button>
      {loading && <span role="status">正在读取系统库…</span>}</div>
    {notice && <p className={`company-revision-notice${notice.error ? ' is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.message}
      {notice.draftId && !notice.error && <button type="button" disabled={notice.draftId === editingSystemId}
        onClick={() => onEditDraft(notice.draftId)}>{notice.draftId === editingSystemId ? '正在编辑此草稿' : '继续编辑草稿'}</button>}</p>}
    <section className="company-revision-section" aria-label="已发布的公司系统">
      <h3>已发布系统</h3>
      {!sortedReleases.length && <p>当前没有可读取的已发布系统。员工可在 Agent 设置中配置提交令牌。</p>}
      {sortedReleases.map((release) => {
        const existing = findDraftForRelease(drafts, release);
        const older = drafts.filter((item) => item.targetSystemId === release.systemId && item.baseVersion < release.version);
        return <article className="company-revision-row" key={`${release.systemId}:${release.version}`}>
          <div><strong>{release.name || release.systemId}</strong><small>{release.systemId} · 发布版 #{release.version} · {release.kind === 'manifest' ? '矩阵系统' : '原生模板'}</small>
            {older.length > 0 && <small className="company-revision-stale">另有基于旧版 #{older.map((item) => item.baseVersion).join('、#')} 的草稿；不会自动合并到此版本。</small>}</div>
          <button type="button" disabled={Boolean(busy) || loading || Boolean(existing && (!existing.available || existing.draftId === editingSystemId))} onClick={() => existing ? onEditDraft(existing.draftId) : void create(release)}>
            {busy === `create:${release.systemId}` ? '正在创建…' : existing ? existing.draftId === editingSystemId ? '正在编辑此版本草稿' : existing.available ? '继续此版本草稿' : '此版本草稿不可读取' : '从此版本创建草稿'}
          </button>
        </article>;
      })}
    </section>
    <section className="company-revision-section" aria-label="本机修订草稿">
      <h3>本机修订草稿</h3>
      {!drafts.length && <p>暂无草稿。创建后可随时从这里继续，不依赖 Agent 对话记录。</p>}
      {sortedDrafts.map((draft) => <article className="company-revision-row" key={draft.draftId}>
        <div><strong>{draft.name || draft.targetSystemId}</strong><small>目标 {draft.targetSystemId} · 基于发布版 #{draft.baseVersion} · 草稿 {draft.draftId}</small>
          {draft.draftId === editingSystemId && <small className="company-revision-stale">此草稿正在编辑。请先保存并显示，再回到配置器检查变更并提交。</small>}
          {isStaleDraft(draft, releases) && <small className="company-revision-stale">旧基线：最新发布版为 #{latestPublishedVersion(releases, draft.targetSystemId)}。此草稿可继续查看和编辑，但不能直接提交；请从最新版本另建草稿。</small>}</div>
        <div className="company-revision-actions">
          <button type="button" disabled={!draft.available || Boolean(busy) || draft.draftId === editingSystemId}
            onClick={() => onEditDraft(draft.draftId)}>{draft.draftId === editingSystemId ? '正在编辑' : '继续编辑'}</button>
          <button type="button" disabled={!draft.available || Boolean(busy) || draft.draftId === editingSystemId} onClick={() => void inspect(draft.draftId)}>
            {busy === `inspect:${draft.draftId}` ? '正在检查…' : isStaleDraft(draft, releases) ? '查看旧版变更' : '查看变更并提交'}</button>
        </div>
      </article>)}
    </section>
    {review && <section className="company-revision-review" aria-label="待提交的版本差异">
      <h3>{review.name} → {review.targetSystemId} {reviewedStale ? '的旧版修订草稿' : '的下一版本'}</h3>
      <p>基于已发布版本 #{review.baseVersion}。{review.hasChanges ? '以下内容将提交超管审核。' : '草稿尚无修改，保存更改后再提交。'}</p>
      {reviewedEditing && <p className="company-revision-stale">此草稿正在编辑。请先保存并显示，再回到配置器提交保存后的版本。</p>}
      {reviewedStale && <p className="company-revision-stale">最新发布版已是 #{reviewedLatest}，此旧草稿不能直接提交。请从最新发布版创建草稿，本机旧草稿仍保留供核对。</p>}
      {review.changedFiles.length > 0 && <p>已改文件：{review.changedFiles.join('、')}</p>}
      {review.changedBindings && <p>算法或图表绑定已更改。</p>}
      {review.changedConfiguration && <p>原生系统名称或配置已更改。</p>}
      {review.changedAlgorithms && <p>包含新保存的用户分类算法。</p>}
      <button type="button" disabled={!review.hasChanges || reviewedStale || reviewedEditing || Boolean(busy)} onClick={() => void submit(review.draftId)}>
        {busy === `submit:${review.draftId}` ? '正在提交…' : '确认提交更新审核'}
      </button>
    </section>}
  </Modal>;
}
