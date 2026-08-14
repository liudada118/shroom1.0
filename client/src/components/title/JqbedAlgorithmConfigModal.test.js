import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
    expect(titleSource.match(/return sent \? requestId : null;/g)).toHaveLength(3);
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
