import { useCallback } from 'react';
import { commandClient as defaultCommandClient } from '../services/command/commandClient';

export function useSerialControl(client = defaultCommandClient) {
  const execute = useCallback((type, payload = {}) => client.execute(type, payload), [client]);

  const openPort = useCallback((path) => execute('serial.open', { role: 'sit', path }), [execute]);
  const openBackPort = useCallback((path) => execute('serial.open', { role: 'back', path }), [execute]);
  const openHeadPort = useCallback((path) => execute('serial.open', { role: 'head', path }), [execute]);
  const closePort = useCallback(() => execute('serial.close', { roles: ['sit'] }), [execute]);
  const resetSerial = useCallback(() => execute('serial.refresh'), [execute]);
  const switchSensor = useCallback((sensorType) => execute('sensor.switch', { sensorType }), [execute]);
  const setChannels = useCallback((sitClose, backClose) => execute('serial.close', {
    roles: [sitClose ? 'sit' : null, backClose ? 'back' : null].filter(Boolean),
  }), [execute]);
  const startRecord = useCallback((name) => execute('collection.control', { active: true, name }), [execute]);
  const stopRecord = useCallback(() => execute('collection.control', { active: false }), [execute]);
  const setPlayback = useCallback((play) => execute('playback.control', { play }), [execute]);
  const seekToFrame = useCallback((value) => execute('playback.control', { value }), [execute]);
  const switchHistory = useCallback((date) => execute('history.load', { date }), [execute]);
  const setZero = useCallback((enabled) => execute('calibration.zero', { enabled }), [execute]);
  const setCompensation = useCallback((compensation) => execute('runtime.configure', { compensation }), [execute]);
  const setGaussBlur = useCallback((gauss) => execute('runtime.configure', { gauss }), [execute]);
  const setUpperThreshold = useCallback((up) => execute('playback.control', { up }), [execute]);
  const setLowerThreshold = useCallback((down) => execute('playback.control', { down }), [execute]);
  const downloadCsv = useCallback((date) => execute('export.csv', {
    date,
    options: { language: localStorage.getItem('language') || 'zh' },
  }), [execute]);
  const deleteRecord = useCallback((date) => execute('history.delete', { date }), [execute]);
  const exchangeMatrix = useCallback(() => execute('serial.exchange'), [execute]);

  return {
    openPort,
    openBackPort,
    openHeadPort,
    closePort,
    resetSerial,
    switchSensor,
    setChannels,
    startRecord,
    stopRecord,
    setPlayback,
    seekToFrame,
    switchHistory,
    setZero,
    setCompensation,
    setGaussBlur,
    setUpperThreshold,
    setLowerThreshold,
    downloadCsv,
    deleteRecord,
    exchangeMatrix,
  };
}

export default useSerialControl;
