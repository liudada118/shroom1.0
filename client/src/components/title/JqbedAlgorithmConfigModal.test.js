import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { resources } from '../../i18n/resources';
import JqbedAlgorithmConfigModal from './JqbedAlgorithmConfigModal';

const testLocale = vi.hoisted(() => ({ language: 'zh' }));

vi.mock('antd', async () => {
  const { createElement } = await import('react');
  const Container = ({ children }) => createElement('div', null, children);
  return {
    Alert: () => null,
    Button: Container,
    InputNumber: () => null,
    Modal: Container,
    Select: () => null,
    Space: { Compact: Container },
    Spin: () => null,
    Switch: () => null,
    Tag: Container,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key.split('.').reduce((copy, part) => copy?.[part], resources[testLocale.language].translation) ?? key,
    i18n: { language: testLocale.language },
  }),
}));

function renderReturnedSettings(props = {}, language = 'zh') {
  testLocale.language = language;
  const markup = renderToStaticMarkup(React.createElement(JqbedAlgorithmConfigModal, {
    open: true,
    connected: true,
    onRequest: () => 'load-test',
    ...props,
  }));
  return markup.match(/<section class="jqbedAlgorithmConfig__returnedSettings"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
}

const modalSource = fs.readFileSync(
  fileURLToPath(new URL('./JqbedAlgorithmConfigModal.jsx', import.meta.url)),
  'utf8',
);
const titleSource = fs.readFileSync(
  fileURLToPath(new URL('./Title.jsx', import.meta.url)),
  'utf8',
);
const styleSource = fs.readFileSync(
  fileURLToPath(new URL('./jqbedAlgorithmConfig.scss', import.meta.url)),
  'utf8',
);
const homeSource = fs.readFileSync(
  fileURLToPath(new URL('../../page/home/Home.jsx', import.meta.url)),
  'utf8',
);

describe('jqbed algorithm configuration UI contract', () => {
  it('uses a modal with scrollable form and fixed action footer', () => {
    expect(modalSource).toContain('width={920}');
    expect(modalSource).toContain('jqbedAlgorithmConfig__formScroll');
    expect(modalSource).toContain('jqbedAlgorithmConfig__footer');
  });

  it('keeps the raw log tab separate from configuration fields and wires its subscription props', () => {
    expect(modalSource).toContain("onClick={() => setActiveGroup('log')}");
    expect(modalSource).toContain("active={activeGroup === 'log'}");
    expect(modalSource).toContain('algorithmLogFrame={algorithmLogFrame}');
    expect(modalSource).not.toContain('algorithmLogFrames');
    expect(modalSource).toContain('logSubscription={logSubscription}');
    expect(modalSource).toContain('onLogSubscription={onLogSubscription}');
    expect(modalSource).toContain("activeGroup === 'log' ? null : loading");
    expect(styleSource).toMatch(/&__logList\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(styleSource).toMatch(/pre\s*\{[^}]*white-space:\s*pre-wrap;[^}]*overflow-wrap:\s*anywhere;/s);
  });

  it('renders valid returned zeroes independently of saved configuration and before every settings tab', () => {
    const markup = renderReturnedSettings({
      returnedSettings: { sensitivity: 0, bedType: 0 },
      envelope: { values: { sensitivity_threshold: 3, isLowBed: 1 } },
    });
    expect(markup).toContain('算法最近有效返回');
    expect(markup).toContain('<dt>算法返回灵敏度</dt><dd>0 默认</dd>');
    expect(markup).toContain('<dt>算法返回床型</dt><dd>0 高床（正常床）</dd>');
    expect(markup).not.toContain('3 灵敏');
    expect(markup).not.toContain('1 矮床');
    expect(modalSource.indexOf('className="jqbedAlgorithmConfig__returnedSettings"')).toBeLessThan(
      modalSource.indexOf('className="jqbedAlgorithmConfig__groups"'),
    );
    expect(styleSource).toMatch(/&__returnedSettings\s*\{[^}]*flex:\s*0 0 auto;[^}]*flex-wrap:\s*wrap;/s);
    expect(styleSource).toMatch(/&__returnedValues\s*\{[^}]*flex-wrap:\s*wrap;/s);
    expect(styleSource).toMatch(/&__returnedHelp\s*\{[^}]*flex:\s*0 0 100%;/s);
  });

  it('shows missing returned values instead of substituting a saved configuration', () => {
    const markup = renderReturnedSettings({
      envelope: { values: { sensitivity_threshold: 3, isLowBed: 1 } },
    });
    expect(markup.match(/<dd>未返回<\/dd>/g)).toHaveLength(2);
    expect(markup).not.toContain('3 灵敏');
    expect(markup).not.toContain('1 矮床');
  });

  it('renders each returned value independently and treats invalid or null values as not returned', () => {
    expect(renderReturnedSettings({ returnedSettings: { sensitivity: 3, bedType: null } }))
      .toContain('<dt>算法返回床型</dt><dd>未返回</dd>');
    expect(renderReturnedSettings({ returnedSettings: { sensitivity: -1, bedType: 1 } }))
      .toContain('<dt>算法返回灵敏度</dt><dd>未返回</dd>');
    expect(renderReturnedSettings({ returnedSettings: { sensitivity: '0', bedType: 1 } }))
      .toContain('<dt>算法返回床型</dt><dd>1 矮床</dd>');
    expect(renderReturnedSettings({ returnedSettings: { sensitivity: 0.5, bedType: 2 } })
      .match(/<dd>未返回<\/dd>/g)).toHaveLength(2);
  });

  it.each(['zh', 'en', 'ja'])('renders returned values and missing state in %s', (language) => {
    const copy = resources[language].translation.jqbedAlgorithmConfig;
    const returned = renderReturnedSettings({ returnedSettings: { sensitivity: 2, bedType: 1 } }, language);
    expect(returned).toContain(copy.returnedSettings.title);
    expect(returned).toContain(copy.returnedSettings.sensitivity);
    expect(returned).toContain(copy.returnedSettings.bedType);
    expect(returned).toContain(copy.returnedSettings.help);
    expect(returned).toContain(copy.sensitivityModes[2]);
    expect(returned).toContain(copy.bedTypes[1]);
    expect(renderReturnedSettings({}, language)).toContain(copy.returnedSettings.unavailable);
  });

  it('explains that the panel keeps the latest valid values without claiming the draft is applied', () => {
    const markup = renderReturnedSettings({ returnedSettings: { sensitivity: 2, bedType: 1 } });
    expect(markup).toContain('仅收到有效回传时更新；间歇未返回时保留最近值，页面连接断开或切换系统时清空。');
    expect(markup).not.toMatch(/当前已生效|已保存|saved|applied/i);
  });

  it('provides a labelled bed-type select with only the two supported algorithm values', () => {
    const bedTypeControl = modalSource.split("if (field.kind === 'bedType') {")[1]
      .split("if (field.kind === 'sensitivityMode') {")[0];
    expect(bedTypeControl).toContain('<Select');
    expect(bedTypeControl).toContain('value={Number(value)}');
    expect(bedTypeControl).toContain('aria-label={t(field.labelKey)}');
    expect(bedTypeControl).toContain('options={[0, 1].map((bedType)');
    expect(bedTypeControl).toContain('onChange={setValue}');
    expect(bedTypeControl).toContain('jqbedAlgorithmConfig.bedTypes.${bedType}');
    expect(bedTypeControl).not.toMatch(/defaultValue|i18n\./);
  });

  it('sends backend-owned read, save and reset requests', () => {
    expect(titleSource).toContain('getJqbedAlgorithmConfig: true');
    expect(titleSource).toContain('setJqbedAlgorithmConfig: values');
    expect(titleSource).toContain('resetJqbedAlgorithmConfig: true');
    expect(titleSource).not.toContain("localStorage.setItem('jqbedAlgorithmConfig'");
  });

  it('places SlidersOutlined before the existing option image', () => {
    expect(titleSource.indexOf('SlidersOutlined')).toBeLessThan(titleSource.indexOf("className='optionImg'"));
  });

  it('passes a stable request callback so backend updates do not reload the open draft', () => {
    expect(titleSource).toContain('onRequest={this.requestJqbedAlgorithmConfig}');
  });

  it('keeps disabled playback tooltip interactive through a focusable span', () => {
    expect(titleSource).toContain('className="jqbedAlgorithmConfigTooltipTarget"');
    expect(titleSource).toContain('tabIndex={jqbedConfigAccess.disabled ? 0 : undefined}');
  });

  it('uses a flex modal body so variable alerts cannot clip the footer', () => {
    expect(styleSource).toMatch(/\.ant-modal-body\s*\{[^}]*display:\s*flex;/s);
    expect(styleSource).toMatch(/\.ant-modal-body\s*\{[^}]*min-height:\s*0;/s);
    expect(styleSource).toMatch(/&__formScroll\s*\{[^}]*flex:\s*1;/s);
    expect(styleSource).toMatch(/&__formScroll\s*\{[^}]*min-height:\s*0;/s);
    expect(styleSource).not.toContain('max-height: calc(80vh - 176px)');
  });

  it('closes on invalid access and guards mutation callbacks with fresh access', () => {
    expect(titleSource).toContain('this.state.jqbedAlgorithmConfigOpen && !this.canUseJqbedAlgorithmConfig()');
    expect(titleSource.match(/if \(!this\.canUseJqbedAlgorithmConfig\(\)\) return null;/g)).toHaveLength(3);
  });

  it('correlates save and reset payloads with opaque request ids', () => {
    expect(titleSource).toContain('const requestId = crypto.randomUUID();');
    expect(titleSource).toContain('setJqbedAlgorithmConfig: values, requestId');
    expect(titleSource).toContain('resetJqbedAlgorithmConfig: true, requestId');
    expect(titleSource).toContain('getJqbedAlgorithmConfig: true, requestId');
    expect(titleSource.match(/return sent \? requestId : null;/g)).toHaveLength(4);
  });

  it('wires real socket send outcomes and reconnect state through Home, Title, and the modal', () => {
    expect(homeSource).toContain('const sent = sendWebSocketJson(ws, obj);');
    expect(homeSource).toContain('return sent;');
    expect(homeSource).toContain('wsConnected={this.state.wsConnected}');
    expect(homeSource).toContain('wsConnectionEpoch={this.state.wsConnectionEpoch}');
    expect(titleSource).toContain('connected={this.props.wsConnected}');
    expect(titleSource).toContain('connectionEpoch={this.props.wsConnectionEpoch}');
    expect(modalSource).toContain("type: 'timeout', action: 'load'");
    expect(modalSource).toContain("dispatch({ type: 'disconnect' });");
    expect(modalSource).toContain('connectionEpoch !== connectionEpochAtOpen.current');
  });
});
