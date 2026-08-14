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
});
