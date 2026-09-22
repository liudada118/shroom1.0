import { describe, expect, it } from 'vitest';
import { getPortalAccent, getPortalScene, SCENE_MODELS, supportsDirectSceneEntry } from './sceneCatalog';
import { NATIVE_SCENE_ASSETS } from '../../../displays/nativeSceneAssets';

describe('入口模型与真实系统身份', () => {
  it.each([
    ['hand', 'matrix'], ['handSinglePoint', 'matrix'], ['hand-unknown', 'matrix'],
    ['hand0205', 'glove'], ['hand0205Double', 'glove'], ['handGlove115200', 'glove'], ['handGloveFullPacket', 'glove'],
    ['wholeChair', 'chair'], ['minzhen', 'wheelchair'], ['carQX', 'chairQX'],
    ['bed4096', 'heatmap64'], ['bed4096num', 'matrix64'], ['smallBed12B', 'matrix'],
    ['robotSY', 'robotSY'], ['robotLCF', 'robotLCF'], ['robot-unknown', 'matrix'],
    ['fast1024', 'matrix'], ['footVideo', 'foot'], ['humanBodyOptimized', 'humanBody'],
    ['jqbed', 'smallBed'], ['petCare', 'matrix'], ['petCareMini', 'matrix'],
  ])('%s 不以无关设备或图标代替', (value, expected) => {
    expect(getPortalScene({ value, source: 'builtin' })).toBe(expected);
  });
  it('自定义名称不冒充内置模型，无选择时使用首页蘑菇', () => {
    expect(getPortalScene({ value: 'hand-custom', source: 'manifest' })).toBe('matrix');
    expect(getPortalScene(null)).toBe('shroom');
  });
  it('所有模型通过打包可用的本地相对地址加载', () => {
    expect(new Set(SCENE_MODELS.map((item) => item.key)).size).toBe(SCENE_MODELS.length);
    SCENE_MODELS.forEach((item) => expect(item.url).toMatch(/^\.\/model\/.+\.(glb|gltf|fbx)$/));
  });
  it.each(['robot1', 'robotSY', 'robotLCF', 'wholeChair', 'carQX', 'minzhen', 'humanBodyOptimized'])('%s 与原生页共用主资源及回退资源，独立副本继承同一外形', (value) => {
    const scene = getPortalScene({ value, source: 'builtin' });
    expect(SCENE_MODELS.find((item) => item.key === scene)).toMatchObject(NATIVE_SCENE_ASSETS[value]);
    expect(getPortalScene({ value: 'custom-copy', source: 'builtin-template', nativeSourceType: value })).toBe(scene);
  });
  it('三个看护系统及高速点阵使用单段交接，未接入接口的页面不冒充支持', () => {
    for (const value of ['jqbed', 'petCare', 'petCareMini', 'bed4096num', 'wholeChair', 'carQX', 'minzhen', 'footVideo', 'robot1', 'robotSY', 'robotLCF']) {
      expect(supportsDirectSceneEntry({ value })).toBe(true);
      expect(supportsDirectSceneEntry({ value: 'copy', nativeSourceType: value })).toBe(true);
    }
    expect(supportsDirectSceneEntry({ value: 'jqbed', source: 'manifest' })).toBe(false);
    expect(supportsDirectSceneEntry({ value: 'robot-unknown' })).toBe(false);
  });
  it('沿用参考床垫绿、座椅紫、机器人橙和默认青色', () => {
    expect(getPortalAccent({ value: 'bed4096' })).toBe('#3df2a4');
    expect(getPortalAccent({ value: 'wholeChair' })).toBe('#6f83ff');
    expect(getPortalAccent({ value: 'robotSY' })).toBe('#ff9f43');
    expect(getPortalAccent({ value: 'hand' })).toBe('#63d5ff');
    expect(getPortalAccent({ value: 'bed4096', source: 'manifest' })).toBe('#63d5ff');
  });
});
