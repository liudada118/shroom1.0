import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { activateSavedAlgorithm, packageDisabledReason, packageMetricValue } from './portalPackageRuntime';
import PortalPackageOutputs from './PortalPackageOutputs';

describe('算法超市真实输出及输入限制', () => {
  it('Agent 成果仅在同一系统的唯一兼容实时通道上启用，并核对后端实例', async () => {
    const snapshot = { sensorType: 'seatpad2', allowed: true, packages: [{ id: 'user-gesture', compatibility: { matrixTotals: [529] } }],
      channels: [{ channelId: 'seatpad2:sit', live: true, matrix: { rows: 23, cols: 23, total: 529 } }], instances: [] };
    const calls = [];
    const request = async (body) => { calls.push(body); return body ? { ...snapshot, instances: [{ id: 'user-gesture' }] } : snapshot; };
    expect(await activateSavedAlgorithm({ systemId: 'seatpad2', packageId: 'user-gesture' }, request)).toEqual({ alreadyRunning: false });
    expect(calls[1]).toEqual({ sensorType: 'seatpad2', packageId: 'user-gesture', channelId: 'seatpad2:sit', enabled: true });
    await expect(activateSavedAlgorithm({ systemId: 'other', packageId: 'user-gesture' }, request)).rejects.toThrow('所属系统');
    await expect(activateSavedAlgorithm({ systemId: 'seatpad2' }, request)).rejects.toThrow('离线版本');
  });
  it('Agent 不猜测多通道，也不把点数不匹配或未确认当成启用成功', async () => {
    const channel = { channelId: 'seatpad2:sit', live: true, matrix: { rows: 23, cols: 23, total: 529 } };
    const snapshot = { sensorType: 'seatpad2', allowed: true, packages: [{ id: 'user-gesture', compatibility: { matrixTotals: [529] } }], channels: [channel, { ...channel, channelId: 'seatpad2:back' }], instances: [] };
    const result = { systemId: 'seatpad2', packageId: 'user-gesture' };
    await expect(activateSavedAlgorithm(result, async () => snapshot)).rejects.toThrow('多个兼容通道');
    await expect(activateSavedAlgorithm(result, async () => ({ ...snapshot, channels: [{ ...channel, matrix: { rows: 32, cols: 32, total: 1024 } }] }))).rejects.toThrow('当前 1024 点');
    await expect(activateSavedAlgorithm(result, async (body) => body ? snapshot : { ...snapshot, channels: [channel] })).rejects.toThrow('未确认');
  });
  it('分类显示真实类别和阶梯趋势，未知不会伪装成概率', () => {
    const item = { id: 'user-gesture', name: '动作识别', metricDefinitions: [{ id: 'classIndex', label: '识别类别', decimals: 0, values: { '-1': '未知', 0: '抚摸', 1: '拍打' } }] };
    const history = [{ timestamp: 1000, metrics: { classIndex: 0 } }, { timestamp: 2000, metrics: { classIndex: 1 } }];
    const html = renderToStaticMarkup(<PortalPackageOutputs item={item} instance={{ status: 'running', history }} />);
    expect(html).toContain('拍打'); expect(html).toContain('H268V'); expect(html).not.toContain('%');
    const unknown = renderToStaticMarkup(<PortalPackageOutputs item={item} instance={{ status: 'running', history: [{ timestamp: 1000, metrics: { classIndex: -1 } }] }} />);
    expect(unknown).toContain('未知');
  });
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
    const paused = renderToStaticMarkup(<PortalPackageOutputs item={item} instance={{ status: 'waiting', history: [], error: '已暂停识别，输入恢复后自动继续。' }} />);
    expect(paused).toContain('is-paused'); expect(paused).toContain('—'); expect(paused).not.toContain('is-error');
  });
});
