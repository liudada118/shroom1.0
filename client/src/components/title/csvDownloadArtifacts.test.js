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

  it('按 channelId 合并乱序的进度与最终产物', () => {
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
