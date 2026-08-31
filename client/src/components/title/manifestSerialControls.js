export function resolveManifestSerialSensors(definition) {
  if (definition?.source !== 'manifest' || !Array.isArray(definition.sensors)) return [];

  return definition.sensors
    .map((sensor) => {
      const sensorId = String(sensor?.sensorId || sensor?.id || '').trim();
      const serialRole = String(sensor?.serialRole || sensor?.serial?.role || sensorId).trim();
      if (!sensorId || !serialRole) return null;
      const parsedBaudRate = Number(sensor?.baudRate ?? sensor?.serial?.baudRate);
      return {
        ...sensor,
        sensorId,
        serialRole,
        sensorLabel: String(sensor?.sensorLabel || sensor?.label || sensorId).trim(),
        baudRate: Number.isFinite(parsedBaudRate) && parsedBaudRate > 0
          ? parsedBaudRate
          : null,
      };
    })
    .filter(Boolean);
}

export function buildManifestSerialPortOptions(
  ports = [],
  selections = {},
  currentRole,
  sensorLabel,
) {
  const occupiedPaths = new Set(
    Object.entries(selections)
      .filter(([role, path]) => role !== currentRole && path)
      .map(([, path]) => path),
  );

  return ports.map((port) => {
    const value = port?.value ?? port?.path ?? port;
    const portLabel = port?.label ?? port?.path ?? port?.value ?? port;
    return {
      ...(port && typeof port === 'object' ? port : {}),
      value,
      label: `${sensorLabel} · ${portLabel}`,
      disabled: port?.disabled === true || occupiedPaths.has(value),
    };
  });
}
