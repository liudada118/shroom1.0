import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentTrainingReport from './AgentTrainingReport';
import AgentResults from './AgentResults';

const report = { evaluation: 'group-cross-validation', windows: 20, accuracy: 0.8, unknown: 2,
  candidates: [{ kind: 'linear', macroF1: 0.79, accuracy: 0.8 }], warnings: ['每类还需新的独立采集。'],
  perClass: [{ label: '左倾', recall: 0.7, support: 10 }], records: [{ id: 'left', date: '左倾记录' }],
  mistakes: [{ recordId: 'left', startFrame: 32, expected: '左倾', predicted: '右倾' }] };

describe('AgentTrainingReport', () => {
  it('区分分组交叉验证与独立验证并定位具体错例', () => {
    const html = renderToStaticMarkup(<AgentTrainingReport report={report} modelSummary={{ kind: 'linear' }} />);
    expect(html).toContain('按采集分组交叉验证');
    expect(html).toContain('尚未通过另一批独立采集验证');
    expect(html).toContain('左倾记录'); expect(html).toContain('33'); expect(html).toContain('70.0%');
    expect(html).toContain('查看模型比较'); expect(html).toContain('0.790');
    expect(html).not.toContain('查看算法源码');
  });
  it('独立验证报告不附加未验证提示，缺失候选分数不显示NaN', () => {
    const html = renderToStaticMarkup(<AgentTrainingReport report={{ ...report, evaluation: 'independent-validation', candidates: [{ kind: 'forest' }] }} modelSummary={{ kind: 'forest' }} />);
    expect(html).toContain('独立采集验证'); expect(html).not.toContain('尚未通过另一批');
    expect(html).not.toContain('NaN'); expect(html).toContain('随机森林');
  });
  it('保存后的成果仍准确标注分组交叉验证，旧报告不会默认冒充独立验证', () => {
    const result = { key: 'cpu', name: '左右分类', kind: 'algorithm', systemId: 'seat', packageId: 'user-cpu', report };
    const html = renderToStaticMarkup(<AgentResults results={[result]} expanded />);
    expect(html).toContain('按采集分组交叉验证'); expect(html).not.toContain('（独立记录）');
    expect(html).toContain('直接使用算法');
    const unknown = renderToStaticMarkup(<AgentResults results={[{ ...result, report: { windows: 2, accuracy: 1 } }]} expanded />);
    expect(unknown).toContain('验证方式未注明'); expect(unknown).not.toContain('（独立记录）');
  });
});
