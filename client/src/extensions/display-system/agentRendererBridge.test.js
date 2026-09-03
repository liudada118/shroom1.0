import { describe, expect, it } from 'vitest';
import {
  AGENT_RENDERER_MESSAGE_TYPES,
  buildAgentRendererFrame,
  buildAgentRendererInit,
  buildAgentRendererReadyMessages,
  getAgentRendererInitSignature,
  hasAgentRendererFrameData,
  normalizeAgentRendererApps,
  parseAgentChartId,
  parseAgentRendererId,
  readAgentRendererResponse,
  resolveAgentRendererEntryUrl,
} from './agentRendererBridge.js';

describe('agent renderer bridge', () => {
  it('parses IDs and normalizes the HttpResult app catalog', () => {
    expect(parseAgentRendererId('agent:pressure-map')).toBe('pressure-map');
    expect(parseAgentRendererId('heatmap')).toBeNull();
    expect(parseAgentChartId('agent-chart:pressure-map:cop-track')).toEqual({
      appId: 'pressure-map',
      chartId: 'cop-track',
    });
    expect(normalizeAgentRendererApps({
      code: 0,
      data: {
        apps: [{
          id: 'pressure-map',
          name: '压力地图',
          rendererId: 'agent:pressure-map',
          entryUrl: '/api/agent-apps/pressure-map/files/renderer.html',
          renderer: { label: 'Agent 压力地图', entry: 'renderer.html', height: 9000 },
          charts: [{
            id: 'cop-track',
            chartId: 'agent-chart:pressure-map:cop-track',
            label: '重心轨迹',
            entryUrl: '/api/agent-apps/pressure-map/files/charts/cop.html',
            height: 260,
          }],
        }],
      },
    })).toEqual([{
      appId: 'pressure-map',
      id: 'agent:pressure-map',
      rendererId: 'agent:pressure-map',
      name: '压力地图',
      label: 'Agent 压力地图',
      entryUrl: '/api/agent-apps/pressure-map/files/renderer.html',
      height: 2000,
      permissions: [],
      charts: [{
        appId: 'pressure-map',
        id: 'agent-chart:pressure-map:cop-track',
        chartId: 'agent-chart:pressure-map:cop-track',
        localChartId: 'cop-track',
        rendererId: 'agent:pressure-map',
        name: '压力地图',
        label: '重心轨迹',
        entryUrl: '/api/agent-apps/pressure-map/files/charts/cop.html',
        height: 260,
        permissions: [],
      }],
    }]);
    expect(normalizeAgentRendererApps({
      apps: [
        { id: 'short', entryUrl: '/api/agent-apps/short/files/index.html', renderer: { height: 1 } },
        { id: 'default', entryUrl: '/api/agent-apps/default/files/index.html', renderer: {} },
      ],
    }).map((app) => app.height)).toEqual([160, 480]);
    expect(normalizeAgentRendererApps({
      apps: [{
        id: 'chart-only',
        rendererId: null,
        renderer: null,
        charts: [{
          id: 'trend',
          chartId: 'agent-chart:chart-only:trend',
          entryUrl: '/api/agent-apps/chart-only/files/trend.html',
        }],
      }],
    })[0]).toMatchObject({
      appId: 'chart-only',
      rendererId: '',
      entryUrl: '',
      charts: [{ chartId: 'agent-chart:chart-only:trend' }],
    });
  });

  it('builds v1 init/frame DTOs and strips non-serializable host values', () => {
    const identity = {
      displaySystemId: 'chair',
      sensorId: 'seat',
      sensorLabel: '座椅',
      sensorType: 'seat-pressure',
      outputChannel: 'seat',
      channelId: 'chair:seat',
    };
    expect(buildAgentRendererInit({
      rendererId: 'agent:pressure-map',
      widgetId: 'main',
      label: '主视图',
      identity,
      surface: 'chart',
      surfaceId: 'agent-chart:pressure-map:cop-track',
      config: { trail: 60, unsafe: () => {} },
    })).toMatchObject({
      type: AGENT_RENDERER_MESSAGE_TYPES.INIT,
      schemaVersion: 1,
      payload: {
        appId: 'pressure-map',
        rendererId: 'agent:pressure-map',
        surface: 'chart',
        surfaceId: 'agent-chart:pressure-map:cop-track',
        config: { trail: 60 },
        channelId: 'chair:seat',
      },
    });

    const frame = buildAgentRendererFrame({
      identity,
      timestamp: 123,
      values: [1, null, undefined, '3', Number.NaN, 3],
      rawValues: new Uint8Array([9, 8]),
      matrix: { rows: 1, cols: 3, electronHandle: () => {} },
      metrics: { maxPressure: 3, callback: () => {} },
      algorithmMetrics: { balance: 0.5, owner: { close: () => {} } },
      serial: {
        role: 'seat',
        portId: 'serial-1',
        path: 'COM3',
        baudRate: 1000000,
        isOpen: true,
        close: () => {},
      },
      channels: [{
        ...identity,
        values: [1, 2, 3],
        rawValues: [4, 5, 6],
        matrix: { rows: 1, cols: 3 },
        metrics: { totalPressure: 6 },
        algorithmMetrics: { balance: 0.5 },
        serial: { path: 'COM4', status: 'open', close: () => {} },
      }],
    });

    expect(frame).toMatchObject({
      type: AGENT_RENDERER_MESSAGE_TYPES.FRAME,
      schemaVersion: 1,
      payload: {
        channelId: 'chair:seat',
        values: [1, null, null, null, null, 3],
        rawValues: [9, 8],
        matrix: { rows: 1, cols: 3, total: 3 },
        metrics: { maxPressure: 3 },
        algorithmMetrics: { balance: 0.5, owner: {} },
        serial: {
          role: 'seat',
          portId: 'serial-1',
          path: 'COM3',
          baudRate: 1000000,
          parserChannel: null,
          status: null,
          isOpen: true,
          openedAt: null,
        },
        channels: [{
          channelId: 'chair:seat',
          values: [1, 2, 3],
          rawValues: [4, 5, 6],
          serial: { path: 'COM4', status: 'open' },
        }],
      },
    });
    expect(JSON.stringify(frame)).not.toContain('close');
    expect(buildAgentRendererReadyMessages(
      buildAgentRendererInit({ rendererId: 'agent:pressure-map' }),
      frame,
    ).map((message) => message.type)).toEqual([
      AGENT_RENDERER_MESSAGE_TYPES.INIT,
      AGENT_RENDERER_MESSAGE_TYPES.FRAME,
    ]);
    expect(buildAgentRendererReadyMessages(
      buildAgentRendererInit({ rendererId: 'agent:pressure-map' }),
      frame,
      { initPosted: true },
    ).map((message) => message.type)).toEqual([AGENT_RENDERER_MESSAGE_TYPES.FRAME]);
    expect(getAgentRendererInitSignature(buildAgentRendererInit({
      rendererId: 'agent:pressure-map',
      identity: { ...identity, channelId: 'chair:seat' },
    }))).not.toBe(getAgentRendererInitSignature(buildAgentRendererInit({
      rendererId: 'agent:pressure-map',
      identity: { ...identity, sensorId: 'back', channelId: 'chair:back' },
    })));
    expect(hasAgentRendererFrameData(frame)).toBe(false);
  });

  it('omits declared-but-missing or wrong-sized optional sensor frames', () => {
    const identity = {
      displaySystemId: 'chair',
      sensorId: 'seat',
      outputChannel: 'seat',
      channelId: 'chair:seat',
    };
    const frame = buildAgentRendererFrame({
      identity,
      values: [1, 2, 3, 4],
      matrix: { rows: 2, cols: 2 },
      channels: [
        { ...identity, values: [], matrix: { rows: 32, cols: 32 } },
        {
          displaySystemId: 'chair',
          sensorId: 'back',
          outputChannel: 'back',
          channelId: 'chair:back',
          values: [1, 2, 3],
          matrix: { rows: 2, cols: 2 },
        },
      ],
    });

    expect(hasAgentRendererFrameData(frame)).toBe(true);
    expect(frame.payload.channels).toHaveLength(1);
    expect(frame.payload.channels[0]).toMatchObject({
      channelId: 'chair:seat',
      values: [1, 2, 3, 4],
      matrix: { rows: 2, cols: 2, total: 4 },
    });

    const waiting = buildAgentRendererFrame({
      identity,
      values: [],
      matrix: { rows: 32, cols: 32 },
      channels: [{ ...identity, values: [], matrix: { rows: 32, cols: 32 } }],
    });
    expect(hasAgentRendererFrameData(waiting)).toBe(false);
    expect(waiting.payload.channels).toEqual([]);
    expect(buildAgentRendererReadyMessages(
      buildAgentRendererInit({ rendererId: 'agent:pressure-map', identity }),
      null,
    ).map((message) => message.type)).toEqual([AGENT_RENDERER_MESSAGE_TYPES.INIT]);
  });

  it('accepts only ready/error messages from the bound iframe window', () => {
    const source = {};
    const otherSource = {};
    const ready = {
      source,
      data: { type: AGENT_RENDERER_MESSAGE_TYPES.READY, schemaVersion: 1, payload: {} },
    };
    expect(readAgentRendererResponse(ready, source)).toEqual({ status: 'ready', message: '' });
    expect(readAgentRendererResponse(ready, otherSource)).toBeNull();
    expect(readAgentRendererResponse({
      source,
      data: { type: AGENT_RENDERER_MESSAGE_TYPES.FRAME, schemaVersion: 1 },
    }, source)).toBeNull();
    expect(readAgentRendererResponse({
      source,
      data: {
        type: AGENT_RENDERER_MESSAGE_TYPES.ERROR,
        schemaVersion: 1,
        payload: { message: 'renderer crashed' },
      },
    }, source)).toEqual({ status: 'error', message: 'renderer crashed' });
  });

  it('accepts only the app file route on the trusted API origin', () => {
    expect(resolveAgentRendererEntryUrl(
      '/api/agent-apps/pressure-map/files/index.html',
      'http://127.0.0.1:19245/',
      'pressure-map',
    )).toBe('http://127.0.0.1:19245/api/agent-apps/pressure-map/files/index.html');
    expect(resolveAgentRendererEntryUrl(
      'https://evil.example/api/agent-apps/pressure-map/files/index.html',
      'http://127.0.0.1:19245/',
      'pressure-map',
    )).toBe('');
    expect(resolveAgentRendererEntryUrl(
      'javascript:alert(1)',
      'http://localhost:19245/',
      'pressure-map',
    )).toBe('');
  });
});
