import { describe, expect, it } from 'vitest';
import {
  collectCsvDownloadArtifacts,
  getUnmatchedLegacyDownloadFiles,
  mergeCsvDownloadArtifacts,
  normalizeCsvDownloadArtifact,
  resolveManifestDownloadChannelIds,
} from './csvDownloadArtifacts';

describe('csvDownloadArtifacts', () => {
  it('保留业务标签、canonical 通道与显式物理串口', () => {
    expect(normalizeCsvDownloadArtifact({
      channelId: 'glove:left-hand',
      sensorId: 'left-hand',
      sensorLabel: '左手',
      file: 'D:/export/left.csv',
      serial: { path: 'COM3', role: 'left-hand', baudRate: 115200 },
    })).toMatchObject({
      channelId: 'glove:left-hand',
      sensorId: 'left-hand',
      sensorLabel: '左手',
      filePath: 'D:/export/left.csv',
      serialPortPath: 'COM3',
      serialRole: 'left-hand',
      baudRate: 115200,
    });
  });

  it('按 channelId 和 filePath 合并乱序的进度与最终产物', () => {
    const progress = [
      { channelId: 'chair:back', currentFile: 'D:/back.csv' },
      { channelId: 'chair:seat', currentFile: 'D:/seat.csv' },
    ];
    const finalArtifacts = [
      { channelId: 'chair:seat', sensorLabel: '座椅', file: 'D:/seat.csv', serialPortPath: 'COM4' },
      { channelId: 'chair:back', sensorLabel: '靠背', file: 'D:/back.csv', serialPortPath: 'COM5' },
    ];

    const merged = mergeCsvDownloadArtifacts(progress, finalArtifacts);
    expect(merged.find((item) => item.channelId === 'chair:seat')).toMatchObject({
      sensorLabel: '座椅',
      serialPortPath: 'COM4',
      filePath: 'D:/seat.csv',
    });
    expect(merged.find((item) => item.channelId === 'chair:back')).toMatchObject({
      sensorLabel: '靠背',
      serialPortPath: 'COM5',
      filePath: 'D:/back.csv',
    });
  });

  it('同一传感器多个采集文件各自保留，同文件进度与终态仍合并', () => {
    const merged = mergeCsvDownloadArtifacts([
      { channelId: 'chair:seat', currentFile: 'D:/morning.csv', serialPortPath: 'COM3' },
      { channelId: 'chair:seat', currentFile: 'D:/afternoon.csv', serialPortPath: 'COM4' },
    ], [
      { channelId: 'chair:seat', file: 'D:/afternoon.csv', sensorLabel: '座椅', written: 200 },
      { channelId: 'chair:seat', file: 'D:/morning.csv', sensorLabel: '座椅', written: 100 },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ filePath: 'D:/morning.csv', serialPortPath: 'COM3', written: 100 });
    expect(merged[1]).toMatchObject({ filePath: 'D:/afternoon.csv', serialPortPath: 'COM4', written: 200 });
    expect(merged[0].serialPortPaths).toEqual(['COM3']);
    expect(merged[1].serialPortPaths).toEqual(['COM4']);
  });

  it('后到的无路径进度不猜测归属，不污染已经明确的文件元信息', () => {
    const merged = mergeCsvDownloadArtifacts([
      { channelId: 'chair:seat', file: 'D:/morning.csv', serialPortPath: 'COM3' },
      { channelId: 'chair:seat', file: 'D:/afternoon.csv', serialPortPath: 'COM4' },
    ], [
      { channelId: 'chair:seat', serialPortPath: 'COM9', sensorLabel: '待确认记录' },
    ]);

    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({ filePath: 'D:/morning.csv', serialPortPaths: ['COM3'] });
    expect(merged[1]).toMatchObject({ filePath: 'D:/afternoon.csv', serialPortPaths: ['COM4'] });
    expect(merged[2]).toMatchObject({ filePath: '', serialPortPaths: ['COM9'], sensorLabel: '待确认记录' });
  });

  it('先到的无路径进度也不能仅凭通道写进后续文件', () => {
    const merged = mergeCsvDownloadArtifacts([
      { channelId: 'chair:seat', serialPortPath: 'COM9' },
    ], [
      { channelId: 'chair:seat', file: 'D:/morning.csv', serialPortPath: 'COM3' },
      { channelId: 'chair:seat', file: 'D:/afternoon.csv', serialPortPath: 'COM4' },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged.map((item) => item.serialPortPaths)).toEqual([['COM9'], ['COM3'], ['COM4']]);
  });

  it('legacy 路径可补充唯一已知文件，但同路径多通道时必须独立保留', () => {
    const unique = mergeCsvDownloadArtifacts([
      { file: 'D:/seat.csv', written: 40 },
    ], [{ channelId: 'chair:seat', file: 'D:/seat.csv', sensorLabel: '座椅' }]);
    expect(unique).toHaveLength(1);
    expect(unique[0]).toMatchObject({ channelId: 'chair:seat', written: 40, sensorLabel: '座椅' });

    const ambiguous = mergeCsvDownloadArtifacts([
      { channelId: 'glove:left', file: 'D:/shared.csv', sensorLabel: '左手' },
      { channelId: 'glove:right', file: 'D:/shared.csv', sensorLabel: '右手' },
    ], [{ file: 'D:/shared.csv', serialPortPath: 'COM9' }]);
    expect(ambiguous).toHaveLength(3);
    expect(ambiguous[0].serialPortPaths).toEqual([]);
    expect(ambiguous[1].serialPortPaths).toEqual([]);
    expect(ambiguous[2]).toMatchObject({ channelId: '', filePath: 'D:/shared.csv', serialPortPaths: ['COM9'] });
  });

  it('两个 canonical 通道即使文件名相同也不能按数组或路径合并', () => {
    const merged = mergeCsvDownloadArtifacts([], [
      { channelId: 'glove:left-hand', file: 'D:/shared.csv', sensorLabel: '左手' },
      { channelId: 'glove:right-hand', file: 'D:/shared.csv', sensorLabel: '右手' },
    ]);

    expect(merged.map((item) => item.channelId)).toEqual([
      'glove:left-hand',
      'glove:right-hand',
    ]);
  });

  it('从进度和最终状态收集通道产物，并保留 downloadFiles 兼容项', () => {
    expect(collectCsvDownloadArtifacts({
      csvDownloadProgress: {
        channelId: 'glove:right-hand',
        currentFile: 'D:/right.csv',
      },
    })).toEqual([expect.objectContaining({
      channelId: 'glove:right-hand',
      filePath: 'D:/right.csv',
    })]);

    expect(getUnmatchedLegacyDownloadFiles(
      ['D:/right.csv', 'D:/legacy.csv', 'D:/legacy.csv'],
      [{ channelId: 'glove:right-hand', file: 'D:/right.csv' }],
    )).toEqual(['D:/legacy.csv']);
  });

  it('保留同一业务通道采集中使用过的全部物理串口', () => {
    const merged = mergeCsvDownloadArtifacts([
      { channelId: 'chair:seat', serialPortPaths: ['COM3'], serialPortPath: 'COM3' },
    ], [
      { channelId: 'chair:seat', serialPortPaths: ['COM3', 'COM8'], serialChanged: true },
    ]);

    expect(merged[0]).toMatchObject({
      serialPortPath: 'COM3',
      serialPortPaths: ['COM3', 'COM8'],
      serialChanged: true,
    });
  });

  it('manifest 下载通道由 displaySystemId 与 sensorId 生成，不依赖数组位置', () => {
    expect(resolveManifestDownloadChannelIds({
      source: 'manifest',
      displaySystemId: 'chair',
      sensors: [
        { id: 'right-hand' },
        { channelId: 'chair:seat', id: 'seat' },
        { sensorId: 'backrest' },
        { id: 'right-hand' },
      ],
    })).toEqual(['chair:right-hand', 'chair:seat', 'chair:backrest']);
    expect(resolveManifestDownloadChannelIds({ source: 'builtin' })).toEqual([]);
  });
});
