import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { PortalDisplayPanel, PortalQuickTools, PortalSessionBar } from './PortalMonitoringChrome';
import PortalPlaybackDialog from './PortalPlaybackDialog';
import PortalWorkspaceTools from './PortalWorkspaceTools';
import PortalSystemSelector from './PortalSystemSelector';
import HumanBodyOptimized from '../../visualization/human-body/HumanBodyOptimized';
import { PRESSURE_VEST_PROFILE } from '../../components/video/pressureVestConfig';

vi.mock('antd', async (original) => ({
  ...await original(),
  /** Keep the real dialog content visible during server-side text verification. */
  Modal: ({ title, children }) => <section>{title}{children}</section>,
}));

afterEach(() => i18n.changeLanguage('zh'));

describe('monitoring interface language coverage', () => {
  it.each(['zh', 'en', 'ja'])('renders monitoring controls, playback and tools in %s', async (language) => {
    await i18n.changeLanguage(language);
    const html = renderToStaticMarkup(<>
      <PortalDisplayPanel />
      <PortalQuickTools chartsVisible />
      <PortalSessionBar mode="now" collecting elapsed={12} />
      <PortalPlaybackDialog open records={[{ value: 'test', label: 'Recording A' }]} downloadValues={['test']} />
      <PortalWorkspaceTools open rendererRef={{ current: null }} />
    </>);
    expect(html).toContain(i18n.t('monitorUi.renderDisplay'));
    expect(html).toContain(i18n.t('monitorUi.stopElapsed', { value0: 12 }));
    expect(html).toContain(i18n.t('monitorUi.recordsSummary', { count: 1, selected: 1 }));
    expect(html).toContain(i18n.t('monitorUi.viewTools'));
    expect(html).not.toContain('monitorUi.');
    expect(html).not.toContain('{{');
    if (language === 'en') expect(html).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it.each(['en', 'ja'])('translates system navigation in %s while retaining customer labels and IDs', async (language) => {
    await i18n.changeLanguage(language);
    const html = renderToStaticMarkup(<PortalSystemSelector open systems={[
      { value: 'customer-system-17', systemId: 'customer-system-17', label: '客户自定名称', source: 'manifest', category: 'custom' },
    ]} scope={null} category="all" selectedId="customer-system-17" phase="idle" accessKey=""
    sceneStatus={{ state: 'ready', key: 'none' }} />);
    expect(html).toContain('客户自定名称');
    expect(html).toContain('data-system="customer-system-17"');
    expect(html).toContain(i18n.t('monitorUi.chooseSystemTitle'));
    expect(html).toContain(i18n.t('monitorUi.customTitle'));
    expect(html).not.toContain('选择你的展示系统');
    expect(html).not.toContain('monitorUi.');
  });

  it.each(['en', 'ja'])('translates full-body settings and anatomical views in %s', async (language) => {
    await i18n.changeLanguage(language);
    const html = renderToStaticMarkup(<HumanBodyOptimized />);
    expect(html).toContain(i18n.t('monitorUi.bodyTitle'));
    expect(html).toContain(i18n.t('monitorUi.regionViews'));
    expect(html).toContain(i18n.t('monitorUi.wholeBody'));
    expect(html).toContain(i18n.t('monitorUi.pauseRotation'));
    expect(html).not.toContain('monitorUi.');
    if (language === 'en') expect(html).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it.each(['en', 'ja'])('translates the vest profile and its number-panel heading in %s', async (language) => {
    await i18n.changeLanguage(language);
    const html = renderToStaticMarkup(<HumanBodyOptimized sensorProfile={PRESSURE_VEST_PROFILE} />);
    expect(html).toContain(i18n.t('sensorPressureVest'));
    expect(html).toContain(i18n.t('monitorUi.numberView', { name: i18n.t('monitorUi.wholeBody') }));
    expect(html).not.toContain('monitorUi.');
    if (language === 'en') expect(html).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
