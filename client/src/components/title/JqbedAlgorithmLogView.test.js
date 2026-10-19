import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { resources } from '../../i18n/resources';
import JqbedAlgorithmLog, { JqbedAlgorithmLogValues } from './JqbedAlgorithmLog.jsx';

const locale = vi.hoisted(() => ({ language: 'zh' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => {
      const copy = key.split('.').reduce((node, part) => node?.[part], resources[locale.language].translation) ?? key;
      return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), copy);
    },
    i18n: { language: locale.language },
  }),
}));

describe('jqbed per-field latest valid log rendering', () => {
  it('shows readable field names and visible descriptions while retaining protocol keys and values', () => {
    locale.language = 'zh';
    const markup = renderToStaticMarkup(React.createElement(JqbedAlgorithmLogValues, {
      frame: {
        sensorType: 'jqbed', sequence: 7, receivedAt: '2026-10-16T12:34:56.789Z',
        outputs: { rate: 18, reserved_bytes: [10, 20, 0, 0, 3, 1], future_protocol_value: 0 },
      },
    }));
    expect(markup).toContain('实时呼吸率');
    expect(markup).toContain('>rate</code>');
    expect(markup).toContain('<p class="jqbedAlgorithmConfig__logFieldDescription">算法返回的实时呼吸率指标。</p>');
    expect(markup).toMatch(/<code[^>]*>18<\/code>/);
    expect(markup).toContain('预留诊断数组');
    expect(markup).toContain('>reserved_bytes</code>');
    expect(markup).toContain('第5位为灵敏度档位，第6位为床型');
    expect(markup).toContain('未定义字段');
    expect(markup).toContain('>future_protocol_value</code>');
    expect(markup).toContain('当前没有该字段的协议说明，保留算法原值，不推测含义。');
    expect(markup).toMatch(/<code[^>]*>0<\/code>/);
  });

  it('shows held fields directly and marks initial -1 fields as pending, with arrays remaining lazy', () => {
    const matrix = Array.from({ length: 1024 }, (_, index) => index === 1023 ? 987654321 : index);
    const reserved = [-1, 0, 5, 6, -1, 0, 99887766];
    const frame = {
      sensorType: 'jqbed', sequence: 42, receivedAt: '2026-10-16T12:34:56.789Z',
      outputs: { breath_rate: -1, in_bed: 0, future_number: 7, future_text: '<unsafe>', nullable: null, future_boolean: false, full_matrix: matrix, reserved_bytes: reserved, future_object: { complete: [0, -1] } },
    };
    const stringify = vi.spyOn(JSON, 'stringify');
    const markup = renderToStaticMarkup(React.createElement(JqbedAlgorithmLogValues, { frame }));
    expect(markup).toContain('#42');
    expect(markup).toContain('2026-10-16T12:34:56.789Z');
    const displayedTime = markup.match(/<time[^>]*>(.*?)<\/time>/)?.[1];
    expect(displayedTime).toContain('2026');
    expect(displayedTime).toMatch(/\d{2}:\d{2}:\d{2}\.789/);
    expect(displayedTime).not.toMatch(/^\d{3}$/);
    Object.keys(frame.outputs).forEach((key) => expect(markup).toContain(`>${key}</code>`));
    expect(markup).toContain('等待有效返回');
    expect(markup).not.toMatch(/<code[^>]*>-1<\/code>/);
    expect(markup).toMatch(/<code[^>]*>0<\/code>/);
    expect(markup).toMatch(/<code[^>]*>null<\/code>/);
    expect(markup).toMatch(/<code[^>]*>false<\/code>/);
    expect(markup).toContain('&lt;unsafe&gt;');
    expect(markup).toContain('9 个字段');
    expect(markup).not.toContain('987654321');
    expect(markup).not.toContain('99887766');
    expect(markup).not.toContain('<pre>');
    expect(stringify.mock.calls.some(([value]) => value === matrix || value === reserved || value === frame.outputs)).toBe(false);
    stringify.mockRestore();
  });

  it.each(['zh', 'en', 'ja'])('shows date, hours, minutes, seconds and milliseconds in %s', (language) => {
    locale.language = language;
    const markup = renderToStaticMarkup(React.createElement(JqbedAlgorithmLogValues, {
      frame: { sensorType: 'jqbed', sequence: 1, receivedAt: '2026-10-16T12:34:56.789Z', outputs: { raw: -1 } },
    }));
    const time = markup.match(/<time[^>]*>(.*?)<\/time>/)?.[1];
    expect(time).toContain('2026');
    expect(time).toMatch(/\d{2}:\d{2}:\d{2}\.789/);
  });

  it.each(['zh', 'en', 'ja'])('shows initial missing fields as waiting while keeping zero visible in %s', (language) => {
    locale.language = language;
    const copy = resources[language].translation.jqbedAlgorithmConfig.log;
    const markup = renderToStaticMarkup(React.createElement(JqbedAlgorithmLogValues, {
      frame: { sensorType: 'jqbed', sequence: 1, receivedAt: '2026-10-16T12:34:56.789Z', outputs: { initial_scalar: -1, initial_array: [[-1], [-1, -1]], zero: 0, nullable: null } },
    }));
    expect(markup.split(copy.pendingValue)).toHaveLength(3);
    ['initial_scalar', 'initial_array', 'zero', 'nullable'].forEach((key) => expect(markup).toContain(`>${key}</code>`));
    expect(markup).toMatch(/<code[^>]*>0<\/code>/);
    expect(markup).toMatch(/<code[^>]*>null<\/code>/);
    expect(markup).not.toMatch(/<code[^>]*>-1<\/code>/);
    expect(markup).toContain(copy.lastReceived);
    expect(markup).toContain(copy.rawJson);
  });

  it('does not render or serialize entries while the log tab is hidden', () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    expect(renderToStaticMarkup(React.createElement(JqbedAlgorithmLog, { active: false, open: true, connected: true }))).toBe('');
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
  });

  it.each(['zh', 'en', 'ja'])('provides a live log title and honest pending status without history controls in %s', (language) => {
    locale.language = language;
    const markup = renderToStaticMarkup(React.createElement(JqbedAlgorithmLog, { active: true, open: true, connected: true }));
    const copy = resources[language].translation.jqbedAlgorithmConfig.log;
    [copy.title, copy.waiting, copy.help, copy.empty].forEach((text) => expect(markup).toContain(text));
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<input');
    expect(markup).not.toMatch(/100|已保留|entries retained/);
    expect(markup).not.toContain('aria-live');
    expect(markup).not.toContain('role="log"');
  });
});
