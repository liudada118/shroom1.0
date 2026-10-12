import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MobileStreamStatus from './MobileStreamStatus.jsx';

describe('移动数据状态展示', () => {
  it('演示数据具有明确标签，不显示 USB 数据', () => {
    const html = renderToStaticMarkup(<MobileStreamStatus snapshot={{ source: 'demo', status: 'receiving' }} />);
    expect(html).toContain('演示数据');
    expect(html).toContain('正在接收');
    expect(html).not.toContain('USB 数据');
  });

  it('只有接收 USB 数据时显示 USB 标签，断流显示暂停', () => {
    const waiting = renderToStaticMarkup(<MobileStreamStatus snapshot={{ source: null, status: 'waiting' }} />);
    expect(waiting).toContain('尚无数据');
    expect(waiting).toContain('等待数据');
    const stale = renderToStaticMarkup(<MobileStreamStatus snapshot={{ source: 'usb', status: 'stale' }} />);
    expect(stale).toContain('USB 数据');
    expect(stale).toContain('数据已暂停');
    expect(stale).not.toContain('正在接收');
  });
});
