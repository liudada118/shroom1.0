import { describe, expect, it } from 'vitest';
import { getPortalAccent, getPortalScene, SCENE_MODELS } from './sceneCatalog';

describe('入口模型与真实系统身份', () => {
  it.each([
    ['hand', 'matrix'], ['handSinglePoint', 'matrix'], ['hand-unknown', 'matrix'],
    ['hand0205', 'glove'], ['hand0205Double', 'glove'], ['handGlove115200', 'glove'], ['handGloveFullPacket', 'glove'],
    ['wholeChair', 'chair'], ['minzhen', 'chair'], ['carQX', 'chair'],
    ['bed4096', 'care'], ['smallBed12B', 'care'], ['robotSY', 'robot'],
    ['fast1024', 'matrix'], ['footVideo', 'matrix'], ['humanBodyOptimized', 'matrix'],
  ])('%s 不以无关设备或图标代替', (value, expected) => {
    expect(getPortalScene({ value, source: 'builtin' })).toBe(expected);
  });
  it('自定义名称不冒充内置模型，无选择时使用首页蘑菇', () => {
    expect(getPortalScene({ value: 'hand-custom', source: 'manifest' })).toBe('matrix');
    expect(getPortalScene(null)).toBe('shroom');
  });
  it('所有模型通过打包可用的本地相对地址加载', () => {
    expect(new Set(SCENE_MODELS.map((item) => item.key)).size).toBe(5);
    SCENE_MODELS.forEach((item) => expect(item.url).toMatch(/^\.\/model\/[^/]+\.(glb|fbx)$/));
  });
  it('沿用参考床垫绿、座椅紫、机器人橙和默认青色', () => {
    expect(getPortalAccent({ value: 'bed4096' })).toBe('#3df2a4');
    expect(getPortalAccent({ value: 'wholeChair' })).toBe('#6f83ff');
    expect(getPortalAccent({ value: 'robotSY' })).toBe('#ff9f43');
    expect(getPortalAccent({ value: 'hand' })).toBe('#63d5ff');
    expect(getPortalAccent({ value: 'bed4096', source: 'manifest' })).toBe('#63d5ff');
  });
});
