import { describe, expect, it } from 'vitest';
import {
  buildDetectedProtocolFormPatch,
  buildProtocolGeometryDefaults,
  buildSerialPortOptions,
  buildSerialTemplateFormPatch,
  formatProtocolCandidateLabels,
  getDetectableProtocolCandidateIds,
  unwrapControlApiData,
} from './protocolAutoDetect.js';

describe('display system protocol auto detection helpers', () => {
  it('unwraps HttpResult without changing legacy raw payloads', () => {
    expect(unwrapControlApiData({ code: 0, data: { ports: ['COM3'] }, msg: 'success' }))
      .toEqual({ ports: ['COM3'] });
    expect(unwrapControlApiData({ catalog: { serialTemplates: [] } }))
      .toEqual({ catalog: { serialTemplates: [] } });
    expect(() => unwrapControlApiData({ code: 1, data: {}, msg: '串口正被使用' }))
      .toThrow('串口正被使用');
    expect(() => unwrapControlApiData({ code: 1, data: {}, message: 'COM7 已被占用' }))
      .toThrow('COM7 已被占用');
  });

  it('derives detectable candidates from catalog metadata instead of hardcoded ids', () => {
    const templates = [
      {
        id: 'preset-u8',
        valueCount: 256,
        defaults: { framingType: 'delimiter' },
      },
      {
        id: 'preset-full',
        protocol: {
          framing: { type: 'delimiter' },
          decoding: { valueCount: 72 },
        },
      },
      {
        id: 'legacy-shortcut',
        defaults: { framingType: 'delimiter' },
      },
      {
        id: 'fixed-length',
        valueCount: 262,
        defaults: { framingType: 'fixedLength' },
      },
      {
        id: 'explicit-custom-detector',
        detectable: true,
        defaults: { framingType: 'fixedLength' },
      },
      {
        id: 'disabled-preset',
        detectable: false,
        valueCount: 1024,
        defaults: { framingType: 'delimiter' },
      },
    ];

    expect(getDetectableProtocolCandidateIds(templates)).toEqual([
      'preset-u8',
      'preset-full',
      'explicit-custom-detector',
    ]);
  });

  it('builds stable cross-platform serial port choices', () => {
    expect(buildSerialPortOptions([
      { path: 'COM7', friendlyName: 'USB-SERIAL CH340', serialNumber: 'ABC' },
      { path: 'COM7', friendlyName: 'duplicate' },
      '/dev/ttyUSB0',
      {},
    ])).toEqual([
      {
        value: 'COM7',
        label: 'COM7 · USB-SERIAL CH340 · ABC',
        port: { path: 'COM7', friendlyName: 'USB-SERIAL CH340', serialNumber: 'ABC' },
      },
      {
        value: '/dev/ttyUSB0',
        label: '/dev/ttyUSB0',
        port: { path: '/dev/ttyUSB0' },
      },
    ]);
  });

  it('keeps manual template application on the same protocol mapping path', () => {
    const patch = buildSerialTemplateFormPatch({
      template: {
        id: 'matrix-tail',
        defaults: {
          transportType: 'binary',
          baudRate: 921600,
          framingType: 'delimiter',
          delimiter: 'aa 55 03 99',
          dataBits: 8,
          valueType: 'uint8',
          byteOffset: 0,
          bytesPerValue: 1,
        },
      },
      currentValues: { frameLength: 1024, valueCount: 1024 },
      pointCount: 256,
    });

    expect(patch).toMatchObject({
      serialTemplate: 'matrix-tail',
      baudRate: 921600,
      framingType: 'delimiter',
      delimiter: 'AA 55 03 99',
      valueType: 'uint8',
      valueCount: 256,
    });
  });

  it('maps a detected full preset without touching sensor identity or downstream configuration', () => {
    const patch = buildDetectedProtocolFormPatch({
      match: {
        id: 'small-bed-12b',
        label: '小床 12B',
        protocol: {
          baudRate: 1500000,
          framing: {
            type: 'delimiter',
            delimiter: [0xaa, 0, 0x55, 0, 3, 0, 0x99, 0],
            includeDelimiter: true,
          },
          decoding: {
            valueType: 'uint16le',
            byteOffset: 2,
            valueCount: 1024,
          },
          validation: {
            header: [0x12, 0x34],
            headerOffset: 3,
            checksum: { type: 'xor8', byteOffset: -1, range: [0, -1] },
          },
        },
      },
      serialTemplates: [{ id: 'small-bed-12b', defaults: { transportType: 'binary' } }],
      currentValues: {
        sensorLabel: '左手',
        outputChannel: 'leftHand',
        coordinateMapJson: '{"points":[]}',
        lineOrderJson: '{"order":[]}',
        backendAlgorithm: 'code',
        rendererId: 'heatmap',
      },
    });

    expect(patch).toEqual({
      serialTemplate: 'small-bed-12b',
      transportType: 'binary',
      baudRate: 1500000,
      framingType: 'delimiter',
      delimiter: 'AA 00 55 00 03 00 99 00',
      includeDelimiter: true,
      frameLength: undefined,
      valueType: 'uint16le',
      dataBits: 12,
      byteOffset: 2,
      valueCount: 1024,
      validationHeader: '12 34',
      validationHeaderOffset: 3,
      checksumType: 'xor8',
      checksumByteOffset: -1,
      checksumRangeExplicit: true,
      checksumRangeStart: 0,
      checksumRangeEnd: -1,
    });
    [
      'sensorLabel',
      'outputChannel',
      'coordinateMapJson',
      'pointOrderJson',
      'lineOrderJson',
      'backendAlgorithm',
      'rendererId',
    ].forEach((field) => expect(patch).not.toHaveProperty(field));
  });

  it('clears stale validation when the matched full preset has none', () => {
    const patch = buildDetectedProtocolFormPatch({
      match: {
        id: 'plain',
        protocol: {
          baudRate: 1000000,
          framing: { type: 'delimiter', delimiter: [0xaa] },
          decoding: { valueType: 'uint8', valueCount: 72 },
        },
      },
      currentValues: {
        validationHeader: 'FF',
        checksumType: 'sum8',
        checksumByteOffset: 10,
      },
    });

    expect(patch).toMatchObject({
      validationHeader: '',
      validationHeaderOffset: 0,
      checksumType: 'none',
      checksumByteOffset: -1,
      checksumRangeExplicit: false,
      checksumRangeStart: 0,
      checksumRangeEnd: -1,
    });
  });

  it('preserves an omitted checksum range instead of inventing [0, -1]', () => {
    const patch = buildDetectedProtocolFormPatch({
      match: {
        id: 'checksum-default-range',
        protocol: {
          baudRate: 1000000,
          framing: { type: 'delimiter', delimiter: [0xaa], includeDelimiter: false },
          decoding: { valueType: 'uint8', valueCount: 72 },
          validation: {
            checksum: { type: 'crc16-modbus', byteOffset: -1 },
          },
        },
      },
    });

    expect(patch.checksumRangeExplicit).toBe(false);
  });

  it('keeps the detected protocol value count when geometry has another point count', () => {
    const patch = buildSerialTemplateFormPatch({
      template: {
        id: 'wire-1024',
        protocol: {
          baudRate: 1000000,
          framing: { type: 'delimiter', delimiter: [0xaa] },
          decoding: { valueType: 'uint8', valueCount: 1024 },
        },
      },
      currentValues: { valueCount: 256 },
      pointCount: 256,
    });

    expect(patch.valueCount).toBe(1024);
  });

  it('keeps wire value count and fixed frame length independent from display geometry', () => {
    expect(buildProtocolGeometryDefaults({
      valueCount: 1024,
      frameLength: 2056,
      pointCount: 256,
      bytesPerValue: 2,
      fixedLength: true,
    })).toEqual({ valueCount: 1024, frameLength: 2056 });

    expect(buildProtocolGeometryDefaults({
      valueCount: null,
      frameLength: null,
      pointCount: 256,
      bytesPerValue: 2,
      fixedLength: true,
    })).toEqual({ valueCount: 256, frameLength: 512 });

    expect(buildSerialTemplateFormPatch({
      template: {
        id: 'fixed-wire-four',
        protocol: {
          baudRate: 115200,
          framing: { type: 'fixedLength' },
          decoding: { valueType: 'uint16le', valueCount: 4 },
        },
      },
      pointCount: 2,
    }).frameLength).toBe(8);
  });

  it('formats ambiguous candidates from ids or summaries', () => {
    expect(formatProtocolCandidateLabels([
      'preset-a',
      { id: 'preset-b', label: '协议 B' },
      null,
    ])).toBe('preset-a、协议 B');
  });
});
