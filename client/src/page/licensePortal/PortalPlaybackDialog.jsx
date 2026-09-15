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
    if (!blocked && selection.downloadValues.length) onDownload?.([...selection.downloadValues]);
  }

  return <Modal
    open={open}
    onCancel={onClose}
    centered
    width={880}
    className="portal-playback-dialog"
    rootClassName="portal-playback-dialog-root"
    title={<span className="portal-playback-title"><HistoryOutlined aria-hidden="true" />回放与下载</span>}
    footer={null}
  >
    <section className="portal-playback-content" aria-label="当前系统采集记录" aria-busy={blocked}>
      <p className="portal-playback-hint">圆形按钮单选回放，方形按钮多选下载；两种选择互不影响。</p>
      <div className="portal-playback-searchbar">
        <label className="portal-playback-search" htmlFor={searchId}>
          <SearchOutlined aria-hidden="true" />
          <span className="portal-playback-sr-only">搜索采集记录</span>
          <input id={searchId} type="search" placeholder="搜索记录名称或时间" value={query} onChange={changeQuery} />
        </label>
        <button type="button" onClick={onRefresh} disabled={blocked || !onRefresh}>
          <ReloadOutlined aria-hidden="true" spin={loading} />{loading ? '正在刷新' : '刷新记录'}
        </button>
      </div>
      <div className="portal-playback-batch">
        <span aria-live="polite" aria-atomic="true">{filtered.length} 条记录 · 已勾选 {selectedDownloads.size} 条下载</span>
        <div>
          <button type="button" disabled={blocked || !onDownloadsChange || !filtered.some((record) => !record.disabled)}
            onClick={() => onDownloadsChange?.(selectFilteredDownloads(normalized, downloadValues, query))}>全选筛选结果</button>
          <button type="button" disabled={blocked || !onDownloadsChange || !selectedDownloads.size}
            onClick={() => onDownloadsChange?.([])}>清空勾选</button>
        </div>
      </div>
      {error && <p className="portal-playback-error" role="alert">{error}</p>}
      <div className="portal-playback-list">
        {pageRecords.length ? <table>
          <thead><tr><th scope="col">回放</th><th scope="col">下载</th><th scope="col">采集记录</th></tr></thead>
          <tbody>{pageRecords.map((record) => <tr key={record.key}
            className={selection.playbackValue === record.value ? 'is-playback-selected' : ''}>
            <td><label className="portal-playback-choice">
              <input type="radio" name={radioName} aria-label={`回放：${record.label}`}
                checked={selection.playbackValue === record.value}
                disabled={blocked || record.disabled || !onPlaybackChange}
                onChange={() => onPlaybackChange?.(record.value)} />
            </label></td>
            <td><label className="portal-playback-choice">
              <input type="checkbox" aria-label={`下载：${record.label}`} checked={selectedDownloads.has(record.value)}
                disabled={blocked || record.disabled || !onDownloadsChange}
                onChange={(event) => onDownloadsChange?.(togglePlaybackDownload(normalized, downloadValues, record.value, event.target.checked))} />
            </label></td>
            <td><div className="portal-playback-record"><strong>{record.label}</strong>
              {record.label !== String(record.value) && <small>{String(record.value)}</small>}
              {record.disabled && <small>此记录暂不可用</small>}
            </div></td>
          </tr>)}</tbody>
        </table> : <div className="portal-playback-empty" role="status">
          <HistoryOutlined aria-hidden="true" />
          <strong>{loading ? '正在读取采集记录' : query.trim() ? '没有匹配的记录' : '当前系统暂无采集记录'}</strong>
          <span>{loading ? '请稍候' : query.trim() ? '换个名称或时间试试，已有勾选会保留。' : '完成采集后，点击“刷新记录”查看。'}</span>
        </div>}
      </div>
      {pageCount > 1 && <nav className="portal-playback-pagination" aria-label="记录分页">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button>
        <span>第 {currentPage + 1} / {pageCount} 页</span>
        <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>下一页</button>
      </nav>}
      <footer className="portal-playback-footer">
        <div className="portal-playback-current"><span>准备回放</span><strong>{playbackRecord?.label || '尚未选择记录'}</strong></div>
        <div className="portal-playback-actions">
          {onDelete && <button type="button" className="portal-playback-delete" disabled={blocked || selection.playbackValue === null}
            onClick={() => onDelete(selection.playbackValue)}>删除单选记录</button>}
          <button type="button" onClick={downloadSelected} disabled={blocked || !selection.downloadValues.length || !onDownload}>
            <DownloadOutlined aria-hidden="true" />下载已勾选 ({selection.downloadValues.length})
          </button>
          <button type="button" className="is-primary" onClick={playSelected} disabled={blocked || selection.playbackValue === null || !onPlay}>
            <PlayCircleOutlined aria-hidden="true" />{busy ? '正在处理' : '载入回放'}
          </button>
        </div>
      </footer>
    </section>
  </Modal>;
}
