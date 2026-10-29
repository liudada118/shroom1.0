import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { message } from 'antd';
import { PortalSessionBar } from '../../page/licensePortal/PortalMonitoringChrome';

vi.mock('../onestep/heatmap', () => ({ bthClickHandle: vi.fn() }));
vi.mock('../../i18n', async (loadOriginal) => ({ ...await loadOriginal(), getLanguageLocale: () => 'zh-CN' }));
import TranslatedTitle from './Title';
const Title = TranslatedTitle.render({}, null).type.WrappedComponent;
const expired = { schemaVersion: 1, state: 'expired', canAcquire: false, canReadHistory: true,
  canAnalyzeHistory: true, canExport: false, canConfigure: false, canStop: true };

/** Exercise real entry methods with an explicit host contract, without opening devices or exporting files. */
function titleFor(access = expired) {
  const title = new Title();
  title.props = { licenseAccess: access, matrixName: 'hand', colFlag: false, dataArr: [],
    t: key => key, i18n: { language: 'zh' }, wsSendObj: vi.fn(), changeStateData: vi.fn(), setColValueFlag: vi.fn() };
  title.setState = patch => Object.assign(title.state, typeof patch === 'function' ? patch(title.state) : patch);
  return title;
}

describe('到期后保留历史与停止入口', () => {
  beforeEach(() => { localStorage.clear(); vi.spyOn(message, 'warning').mockImplementation(() => {}); });

  it('采集、连接和导出方法在到期时不发出动作，停止仍可用', async () => {
    const title = titleFor();
    title.openCollectionModal(); title.startCollectionWithOptions(); title.openCsvDownloadModal();
    title.openPortalBatchDownload(['record']); title.openOneStepPdfModal();
    await title.startCsvDownload(); await title.generateOneStepPdfReport();
    expect(await title.connectSerialChannel('sit', 'COM4')).toBe(false);
    expect(title.props.wsSendObj).not.toHaveBeenCalled();
    expect(title.state.collectionModalOpen).toBe(false);
    expect(title.getSerialSelectProps('sit').disabled).toBe(true);
    title.stopCollection();
    expect(title.props.wsSendObj).toHaveBeenCalledWith(expect.objectContaining({ flag: false }));
    expect(title.props.setColValueFlag).toHaveBeenCalledWith(false);
  });

  it('会话栏只禁新增采集，允许停止和历史入口', () => {
    const html = renderToStaticMarkup(<PortalSessionBar mode="now" collecting canAcquire={false} />);
    expect(html).toMatch(/aria-label="开始采集"[^>]*disabled=""/);
    expect(html).not.toMatch(/aria-label="结束采集" disabled=""/);
    const playback = renderToStaticMarkup(<PortalSessionBar mode="playback" collecting={false} canAcquire={false} />);
    expect(playback).not.toMatch(/aria-label="回放"[^>]*disabled/);
  });

  it('旧宿主仍可打开采集设置，保存收尾期间不能开始下一轮', () => {
    const legacy = titleFor(); legacy.props.licenseAccess = undefined; legacy.props.wsConnected = true; legacy.props.history = 'now';
    legacy.props.collectionLocalFrameReady = true;
    legacy.state.serialStates.sit = { status: 'open', isOpen: true };
    legacy.openCollectionModal();
    expect(legacy.state.collectionModalOpen).toBe(true);
    const finalizing = titleFor({ ...expired, state: 'active', canAcquire: true });
    finalizing.props.collectionSummary = { phase: 'finalizing' };
    finalizing.openCollectionModal(); finalizing.startCollectionWithOptions();
    expect(finalizing.props.wsSendObj).not.toHaveBeenCalled();
  });
});
