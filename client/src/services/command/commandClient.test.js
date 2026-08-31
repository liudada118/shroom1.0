import { describe, expect, it, vi } from 'vitest';
import { CommandClient, CommandClientError, commandFromLegacyFields } from './commandClient';

describe('CommandClient', () => {
  it('sends the unified command envelope and returns its ACK', async () => {
    const fetchImpl = vi.fn(async (_url, options) => {
      const command = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          data: {
            type: 'command.ack',
            requestId: command.requestId,
            commandType: command.type,
            ok: true,
            code: 'OK',
          },
        }),
      };
    });
    const client = new CommandClient({ baseUrl: 'http://backend.test', fetchImpl });
    const ack = await client.execute('serial.open', { role: 'sit', path: 'COM3' }, { requestId: 'req-client-1' });
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body);

    expect(fetchImpl.mock.calls[0][0]).toBe('http://backend.test/api/commands');
    expect(request).toEqual({
      type: 'serial.open',
      payload: { role: 'sit', path: 'COM3' },
      requestId: 'req-client-1',
    });
    expect(ack.requestId).toBe('req-client-1');
  });

  it('calls browser fetch with the global receiver', async () => {
    const fetchImpl = vi.fn(function fetchWithReceiverCheck() {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          data: {
            type: 'command.ack',
            requestId: 'req-browser-fetch',
            commandType: 'license.activate',
            ok: true,
            code: 'OK',
          },
        }),
      });
    });
    const client = new CommandClient({ fetchImpl });

    await expect(client.execute(
      'license.activate',
      { key: 'test-key' },
      { requestId: 'req-browser-fetch' },
    )).resolves.toMatchObject({ ok: true, requestId: 'req-browser-fetch' });
  });

  it('splits a combined legacy control message into typed commands', () => {
    const commands = commandFromLegacyFields({
      sitClose: true,
      backClose: true,
      file: 'smallBed12B',
    });
    expect(commands.map((command) => command.type)).toEqual(['serial.close', 'sensor.switch']);
    expect(commands[0].payload.roles).toEqual(['sit', 'back']);
  });

  it('preserves dynamic zero targets while mapping a legacy control message', () => {
    const [command] = commandFromLegacyFields({
      resetZero: true,
      displaySystemId: 'wheelchair-v2',
      channelIds: ['wheelchair-v2:seat-left', 'wheelchair-v2:seat-right'],
    });

    expect(command.type).toBe('calibration.zero');
    expect(command.payload).toEqual({
      enabled: true,
      displaySystemId: 'wheelchair-v2',
      channelIds: ['wheelchair-v2:seat-left', 'wheelchair-v2:seat-right'],
    });
  });

  it('rejects an explicit empty zero target instead of treating it as all channels', () => {
    expect(() => commandFromLegacyFields({ resetZero: false, channelIds: [] })).toThrow(/must not be empty/);
  });

  it('preserves backend error code and requestId', async () => {
    const client = new CommandClient({
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          code: 1,
          data: { ok: false, code: 'INVALID_COMMAND', requestId: 'req-client-2', message: 'bad payload' },
        }),
      }),
    });
    await expect(client.execute('serial.open', { role: 'sit', path: 'COM3' }, { requestId: 'req-client-2' }))
      .rejects.toMatchObject({
        code: 'INVALID_COMMAND',
        requestId: 'req-client-2',
        status: 400,
      });
    await expect(client.execute('serial.open', { role: 'sit', path: 'COM3' }))
      .rejects.toBeInstanceOf(CommandClientError);
  });
});
