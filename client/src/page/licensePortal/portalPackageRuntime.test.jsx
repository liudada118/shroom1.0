import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { packageDisabledReason, packageMetricValue } from './portalPackageRuntime';
import PortalPackageOutputs from './PortalPackageOutputs';

describe('算法超市真实输出及输入限制', () => {
  it('已运行、断线、授权及点数不匹配都有可读说明', () => {
    const item = { compatibility: { matrixTotals: [1024] } };
    expect(packageDisabledReason(item, { live: true, matrix: { total: 256 } }, { allowed: true })).toContain('当前 256');
    expect(packageDisabledReason({ ...item, reserved: true }, null, { allowed: true })).toContain('已内置');
    expect(packageDisabledReason(item, null, { allowed: true })).toContain('连接');
    expect(packageDisabledReason(item, null, { allowed: false, reason: '未授权' })).toBe('未授权');
  });
  it('呼吸负值与 88 不是测量值，CoP 不受生命体征异常影响', () => {
    expect(packageMetricValue('mattress-vitals', 'respirationRate', { respirationRate: -1 }).value).toBeNull();
    expect(packageMetricValue('mattress-vitals', 'respirationRate', { respirationRate: 88 }).label).toBe('检测中');
    expect(packageMetricValue('mattress-vitals', 'respirationRate', { respirationRate: 18, onbedFilterHealthy: 0 }).value).toBeNull();
    expect(packageMetricValue('mattress-vitals', 'copX', { copX: 12, onbedFilterHealthy: 0 }).value).toBe(12);
    expect(packageMetricValue('pet-care', 'breathRate', { breathRate: 88 }).value).toBe(88);
  });
  it('收到旧帧后显示具体输入错误，合法 32×32 输入可选而 64×64 算法仍受限制', () => {
    const item = { compatibility: { matrixTotals: [1024] } };
    expect(packageDisabledReason(item, { live: true, matrix: null }, { allowed: true })).toContain('缺少矩阵尺寸');
    expect(packageDisabledReason(item, { live: true, inputError: '收到 256 点' }, { allowed: true })).toBe('收到 256 点');
    const channel = { live: true, matrix: { rows: 32, cols: 32, total: 1024 } };
    expect(packageDisabledReason(item, channel, { allowed: true })).toBe('');
    expect(packageDisabledReason({ compatibility: { matrixTotals: [4096] } }, channel, { allowed: true })).toContain('需要 4096');
  });
  it('用真实标量队列绘图并提供所有声明指标，未收帧不伪造零值', () => {
    const item = { id: 'mattress-vitals', name: '生命体征', metricDefinitions: [{ id: 'respirationRate', label: '呼吸率', unit: '次/分', decimals: 1 }, { id: 'copX', label: '重心 X' }] };
    const instance = { status: 'running', history: [{ timestamp: 1000, metrics: { respirationRate: 18 } }, { timestamp: 2000, metrics: { respirationRate: 20 } }] };
    const html = renderToStaticMarkup(<PortalPackageOutputs item={item} instance={instance} />);
    expect(html).toContain('20.0'); expect(html).toContain('重心 X'); expect(html).toContain('真实算法输出趋势');
    const empty = renderToStaticMarkup(<PortalPackageOutputs item={item} instance={{ status: 'waiting', history: [] }} />);
    expect(empty).toContain('等待实时数据'); expect(empty).not.toContain('0.0');
  });
});
