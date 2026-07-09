import { useCallback } from 'react';
import { WS_URLS } from '../../constants';
import useWebSocket, { ReadyState } from '../../hooks/useWebSocket';
import { wsCommands } from './messages';

export function useMainWebSocket(options = {}) {
  const { url = WS_URLS.MAIN, ...socketOptions } = options;
  const socket = useWebSocket(url, socketOptions);
  const connected = socket.readyState === ReadyState.OPEN;
  const { sendMessage } = socket;

  const sendCommand = useCallback((command) => {
    if (!connected) return false;
    sendMessage(command);
    return true;
  }, [connected, sendMessage]);

  const submitLicenseKey = useCallback((key, commandOptions) => (
    sendCommand(wsCommands.submitLicenseKey(key, commandOptions))
  ), [sendCommand]);

  const requestSensorTypes = useCallback(() => (
    sendCommand(wsCommands.requestSensorTypes())
  ), [sendCommand]);

  const refreshLicense = useCallback(() => (
    sendCommand(wsCommands.refreshLicense())
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
