import { useCallback } from 'react';
import { WS_URLS } from '../../constants';
import useWebSocket, { ReadyState } from '../../hooks/useWebSocket';
import { commandClient } from '../command/commandClient';

export function useMainWebSocket(options = {}) {
  const { url = WS_URLS.MAIN, onCommandError, ...socketOptions } = options;
  const socket = useWebSocket(url, socketOptions);
  const connected = socket.readyState === ReadyState.OPEN;
  const sendCommand = useCallback(async (type, payload = {}) => {
    try {
      return await commandClient.execute(type, payload);
    } catch (error) {
      onCommandError?.(error);
      console.warn('[command] request failed', error);
      return null;
    }
  }, [onCommandError]);

  const submitLicenseKey = useCallback((key, commandOptions) => (
    sendCommand('license.activate', {
      key,
      ...(commandOptions?.includeStartTime === false ? {} : { startTime: Date.now() }),
    })
  ), [sendCommand]);

  const requestSensorTypes = useCallback(() => (
    sendCommand('sensor.types.list')
  ), [sendCommand]);

  const refreshLicense = useCallback(() => (
    sendCommand('license.refresh')
  ), [sendCommand]);

  return {
    ...socket,
    connected,
    sendCommand,
    submitLicenseKey,
    requestSensorTypes,
    refreshLicense,
  };
}

export default useMainWebSocket;
