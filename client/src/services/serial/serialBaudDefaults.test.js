import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { getNativeSerialBaudDefault } from './serialBaudDefaults';
import { BUILTIN_SYSTEM_ENTRIES } from '../displaySystemOptions';

const require = createRequire(import.meta.url);
const registry = require('../../../../sdk/backend/sensors/registry.js');

describe('旧宿主显示默认波特率', () => {
  it('与生产注册表的全部型号及公开入口保持一致，后端改值时及时发现显示漂移', () => {
    const types = new Set([...Object.keys(registry.SENSOR_DEFINITIONS), ...BUILTIN_SYSTEM_ENTRIES.map(([type]) => type)]);
    for (const type of types) expect(getNativeSerialBaudDefault(type), type).toBe(registry.getSensorBaudRate(type));
  });
});
