import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESSURE_SCENE,
  PRESSURE_SCENES,
  PRESSURE_SCENE_STORAGE_KEY,
  normalizePressureScene,
  readPressureScene,
  resolveDisplaySwitchZero,
  resolvePressureSceneChangeZero,
  writePressureScene,
} from './displaySwitchZeroPolicy';

// Title.jsx 里的 calibratableGloveTypes_title，写死一份免得测试跟着组件走
const GLOVES = ['hand0205', 'handGlove115200'];

const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
};

describe('切展示模式的清零策略', () => {
  it('演示场景：任何传感器切任何模式都做一次预压力清零', () => {
    ['jqbed', 'petCare', 'humanBody', 'smallBed', 'hand0205'].forEach((sensorType) => {
      ['num', 'num3D', 'numoriginal', 'skin'].forEach((nextMode) => {
        expect(resolveDisplaySwitchZero({
          sensorType,
          nextMode,
          scene: PRESSURE_SCENES.demo,
          cancelZeroSensorTypes: GLOVES,
        })).toEqual({ resetZero: true });
      });
    });
  });

  it('真实场景：切换不发任何清零命令，基准只由手动按钮改', () => {
    ['jqbed', 'petCare', 'hand0205'].forEach((sensorType) => {
      ['num', 'num3D', 'numoriginal', 'skin'].forEach((nextMode) => {
        expect(resolveDisplaySwitchZero({
          sensorType,
          nextMode,
          scene: PRESSURE_SCENES.real,
          cancelZeroSensorTypes: GLOVES,
        })).toBeNull();
      });
    });
  });

  it('手套切 3D 遥操：两种场景都取消清零，遥操要用未清零数据配手指校准', () => {
    GLOVES.forEach((sensorType) => {
      [PRESSURE_SCENES.demo, PRESSURE_SCENES.real].forEach((scene) => {
        expect(resolveDisplaySwitchZero({
          sensorType,
          nextMode: 'normal',
          scene,
          cancelZeroSensorTypes: GLOVES,
        })).toEqual({ resetZero: false });
      });
    });
  });

  it('非手套传感器切到 normal 不吃取消清零那条特例', () => {
    expect(resolveDisplaySwitchZero({
      sensorType: 'jqbed',
      nextMode: 'normal',
      scene: PRESSURE_SCENES.demo,
      cancelZeroSensorTypes: GLOVES,
    })).toEqual({ resetZero: true });

    expect(resolveDisplaySwitchZero({
      sensorType: 'jqbed',
      nextMode: 'normal',
      scene: PRESSURE_SCENES.real,
      cancelZeroSensorTypes: GLOVES,
    })).toBeNull();
  });

  it('场景值缺失或写坏一律落到真实场景，不会意外静默清零', () => {
    expect(DEFAULT_PRESSURE_SCENE).toBe(PRESSURE_SCENES.real);
    [undefined, null, '', 'Demo', 'presentation', 0].forEach((value) => {
      expect(normalizePressureScene(value)).toBe(PRESSURE_SCENES.real);
    });
    expect(resolveDisplaySwitchZero({ sensorType: 'jqbed', nextMode: 'num' })).toBeNull();
  });
});

describe('场景按钮的即时清零指令', () => {
  it('进入演示场景立即记录预压力，进入真实测量立即取消清零', () => {
    expect(resolvePressureSceneChangeZero(PRESSURE_SCENES.demo)).toEqual({ resetZero: true });
    expect(resolvePressureSceneChangeZero(PRESSURE_SCENES.real)).toEqual({ resetZero: false });
  });

  it('未知场景按安全默认值处理为真实测量并取消清零', () => {
    expect(resolvePressureSceneChangeZero('broken')).toEqual({ resetZero: false });
  });
});

describe('场景设置的持久化', () => {
  it('存进 localStorage 并读回来', () => {
    const storage = memoryStorage();
    expect(readPressureScene(storage)).toBe(PRESSURE_SCENES.real);

    expect(writePressureScene(PRESSURE_SCENES.demo, storage)).toBe(PRESSURE_SCENES.demo);
    expect(storage.getItem(PRESSURE_SCENE_STORAGE_KEY)).toBe('demo');
    expect(readPressureScene(storage)).toBe(PRESSURE_SCENES.demo);

    writePressureScene(PRESSURE_SCENES.real, storage);
    expect(readPressureScene(storage)).toBe(PRESSURE_SCENES.real);
  });

  it('localStorage 不可用时退回真实场景而不是抛错', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(readPressureScene(broken)).toBe(PRESSURE_SCENES.real);
    expect(writePressureScene(PRESSURE_SCENES.demo, broken)).toBe(PRESSURE_SCENES.demo);
    expect(readPressureScene(null)).toBe(PRESSURE_SCENES.real);
  });
});
