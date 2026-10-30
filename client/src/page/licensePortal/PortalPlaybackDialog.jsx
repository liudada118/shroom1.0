import i18n from '../../i18n';
import React, { useId, useMemo, useState } from 'react';
import { Modal } from 'antd';
import { DownloadOutlined, HistoryOutlined, PlayCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  filterPlaybackRecords,
  normalizePlaybackRecords,
  resolvePlaybackSelection,
  selectFilteredDownloads,
  togglePlaybackDownload,
} from './portalPlaybackSelection';
import './PortalPlaybackDialog.css';

const PAGE_SIZE = 30;

/**
 * 在当前系统内选择一条回放记录，或独立勾选多条记录交给宿主下载。
 * 父组件持有两份选择并在系统切换时清空；用系统 ID 作 key 可重置本地搜索。
 * 此组件只调用回调，不请求历史数据、不切换实时/回放状态。
 */
export default function PortalPlaybackDialog({
  open,
  records = [],
  playbackValue = null,
  downloadValues = [],
  onPlaybackChange,
  onDownloadsChange,
  onPlay,
  onDownload,
  onDelete,
  onRefresh,
  onClose,
  loading = false,
  busy = false,
  error = '',
  canExport = true,
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const searchId = useId();
  const radioName = useId();
  const normalized = useMemo(() => normalizePlaybackRecords(records), [records]);
  const filtered = useMemo(() => filterPlaybackRecords(normalized, query), [normalized, query]);
  const selection = useMemo(() => resolvePlaybackSelection(normalized, playbackValue, downloadValues),
    [normalized, playbackValue, downloadValues]);
  const selectedDownloads = new Set(selection.downloadValues);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRecords = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const playbackRecord = normalized.find((record) => record.value === selection.playbackValue);
  const blocked = loading || busy;

  /** 输入筛选条件时回到第一页，不改变已选回放或下载集合。 */
  function changeQuery(event) {
    setQuery(event.target.value);
    setPage(0);
  }

  /** 只提交仍属于当前系统且可用的单条记录。 */
  function playSelected() {
    if (!blocked && selection.playbackValue !== null) onPlay?.(selection.playbackValue);
  }

  /** 下载拿到独立快照，不能覆盖正在查看的回放记录。 */
  function downloadSelected() {
    if (canExport && !blocked && selection.downloadValues.length) onDownload?.([...selection.downloadValues]);
  }

  return <Modal
    open={open}
    onCancel={onClose}
    centered
    width={880}
    className="portal-playback-dialog"
    rootClassName="portal-playback-dialog-root"
    title={<span className="portal-playback-title"><HistoryOutlined aria-hidden="true" />{i18n.t('monitorUi.playbackDownload')}</span>}
    footer={null}
  >
    <section className="portal-playback-content" aria-label={i18n.t('monitorUi.systemRecords')} aria-busy={blocked}>
      <p className="portal-playback-hint">{i18n.t('monitorUi.selectionHint')}</p>
      {!canExport && <p role="status">{i18n.t('monitorUi.exportDenied')}</p>}
      <div className="portal-playback-searchbar">
        <label className="portal-playback-search" htmlFor={searchId}>
          <SearchOutlined aria-hidden="true" />
          <span className="portal-playback-sr-only">{i18n.t('monitorUi.searchRecords')}</span>
          <input id={searchId} type="search" placeholder={i18n.t('monitorUi.searchRecordsPlaceholder')} value={query} onChange={changeQuery} />
        </label>
        <button type="button" onClick={onRefresh} disabled={blocked || !onRefresh}>
          <ReloadOutlined aria-hidden="true" spin={loading} />{loading ? i18n.t('monitorUi.refreshing') : i18n.t('monitorUi.refreshRecords')}
        </button>
      </div>
      <div className="portal-playback-batch">
        <span aria-live="polite" aria-atomic="true">{i18n.t('monitorUi.recordsSummary', { count: filtered.length, selected: selectedDownloads.size })}</span>
        <div>
          <button type="button" disabled={!canExport || blocked || !onDownloadsChange || !filtered.some((record) => !record.disabled)}
            onClick={() => onDownloadsChange?.(selectFilteredDownloads(normalized, downloadValues, query))}>{i18n.t('monitorUi.selectFiltered')}</button>
          <button type="button" disabled={blocked || !onDownloadsChange || !selectedDownloads.size}
            onClick={() => onDownloadsChange?.([])}>{i18n.t('monitorUi.clearSelection')}</button>
        </div>
      </div>
      {error && <p className="portal-playback-error" role="alert">{error}</p>}
      <div className="portal-playback-list">
        {pageRecords.length ? <table>
          <thead><tr><th scope="col">{i18n.t('monitorUi.playback')}</th><th scope="col">{i18n.t('monitorUi.download')}</th><th scope="col">{i18n.t('monitorUi.recording')}</th></tr></thead>
          <tbody>{pageRecords.map((record) => <tr key={record.key}
            className={selection.playbackValue === record.value ? 'is-playback-selected' : ''}>
            <td><label className="portal-playback-choice">
              <input type="radio" name={radioName} aria-label={i18n.t('monitorUi.playRecord', { value0: record.label })}
                checked={selection.playbackValue === record.value}
                disabled={blocked || record.disabled || !onPlaybackChange}
                onChange={() => onPlaybackChange?.(record.value)} />
            </label></td>
            <td><label className="portal-playback-choice">
              <input type="checkbox" aria-label={i18n.t('monitorUi.downloadRecord', { value0: record.label })} checked={selectedDownloads.has(record.value)}
                disabled={!canExport || blocked || record.disabled || !onDownloadsChange}
                onChange={(event) => onDownloadsChange?.(togglePlaybackDownload(normalized, downloadValues, record.value, event.target.checked))} />
            </label></td>
            <td><div className="portal-playback-record"><strong>{record.label}</strong>
              {record.detail && <small>{record.detail}</small>}
              {record.disabled && <small>{i18n.t('monitorUi.recordUnavailable')}</small>}
            </div></td>
          </tr>)}</tbody>
        </table> : <div className="portal-playback-empty" role="status">
          <HistoryOutlined aria-hidden="true" />
          <strong>{loading ? i18n.t('monitorUi.loadingRecords') : query.trim() ? i18n.t('monitorUi.noMatchingRecords') : i18n.t('monitorUi.noRecords')}</strong>
          <span>{loading ? i18n.t('monitorUi.pleaseWait') : query.trim() ? i18n.t('monitorUi.searchAgain') : i18n.t('monitorUi.refreshAfterCollection')}</span>
        </div>}
      </div>
      {pageCount > 1 && <nav className="portal-playback-pagination" aria-label={i18n.t('monitorUi.recordPagination')}>
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{i18n.t('monitorUi.previousPage')}</button>
        <span>{i18n.t('monitorUi.pageSummary', { page: currentPage + 1, total: pageCount })}</span>
        <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>{i18n.t('monitorUi.nextPage')}</button>
      </nav>}
      <footer className="portal-playback-footer">
        <div className="portal-playback-current"><span>{i18n.t('monitorUi.readyPlayback')}</span><strong>{playbackRecord?.label || i18n.t('monitorUi.noRecordSelected')}</strong></div>
        <div className="portal-playback-actions">
          {onDelete && <button type="button" className="portal-playback-delete" disabled={blocked || selection.playbackValue === null}
            onClick={() => onDelete(selection.playbackValue)}>{i18n.t('monitorUi.deleteSelectedRecord')}</button>}
          <button type="button" onClick={downloadSelected} disabled={!canExport || blocked || !selection.downloadValues.length || !onDownload}>
            <DownloadOutlined aria-hidden="true" />{i18n.t('monitorUi.downloadSelected', { count: selection.downloadValues.length })}
          </button>
          <button type="button" className="is-primary" onClick={playSelected} disabled={blocked || selection.playbackValue === null || !onPlay}>
            <PlayCircleOutlined aria-hidden="true" />{busy ? i18n.t('monitorUi.processing') : i18n.t('monitorUi.loadPlayback')}
          </button>
        </div>
      </footer>
    </section>
  </Modal>;
}
