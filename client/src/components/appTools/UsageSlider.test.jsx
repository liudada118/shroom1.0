import { afterEach, describe, expect, it, vi } from 'vitest';
import UsageSlider from './UsageSlider';
vi.mock('antd', () => ({ Slider: 'fixture-slider' }));
vi.mock('react', async original => ({ ...await original(), useRef: () => ({ current: false }) }));
afterEach(() => vi.unstubAllGlobals());

describe('slider usage', () => {
  it('updates locally during drag and emits one event only at completion', () => {
    const invoke = vi.fn(async () => {}), onChange = vi.fn();
    vi.stubGlobal('window', { electronAPI: { services: { invoke } } });
    const slider = UsageSlider({ usageFeature: 'tuning_filter', onChange, value: 1 });
    for (let i = 0; i < 100; i++) slider.props.onChange(i);
    expect(onChange).toHaveBeenCalledTimes(100); expect(invoke).not.toHaveBeenCalled();
    slider.props.onChangeComplete(99); slider.props.onChangeComplete(99);
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0][1].properties).toMatchObject({ featureId: 'tuning_filter', result: 'success' });
    expect(invoke.mock.calls[0][1].properties).not.toHaveProperty('value');
  });
  it('retains callback errors and never records a false success after a failed completion', () => {
    const invoke = vi.fn(async () => {}), error = new Error('fixture');
    vi.stubGlobal('window', { electronAPI: { services: { invoke } } });
    const slider = UsageSlider({ usageFeature: 'tuning_height', onChangeComplete: () => { throw error; } });
    slider.props.onChange(2); expect(() => slider.props.onChangeComplete(2)).toThrow(error);
    expect(invoke.mock.calls[0][1].properties.result).toBe('failure');
    expect(() => slider.props.onChangeComplete(2)).toThrow(error); expect(invoke).toHaveBeenCalledOnce();
  });
});
