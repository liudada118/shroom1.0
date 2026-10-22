import { describe, expect, it } from 'vitest';
import { buildGloveExhibitionFrame, getGloveFingerPoints, isGloveExhibitionMode, gloveExhibitionConfig, resolveGloveQuaternionResetSide } from './gloveExhibition';

/** 构造当前矩阵、未清零映射与左右手独立基准。 */
function input(overrides = {}) {
  return { message: { newArr147: Array(147).fill(2), newArr147Raw: Array(147).fill(10), rotate: [0, 0, 0, 1] },
    channel: 'sit', channelPressure: Array(256).fill(2), rawPressure: Array(256).fill(80),
    calibration: [Array(5).fill(0), Array(5).fill(60)], ...overrides };
}

describe('手套展示输入', () => {
  it('四元数置零按当前系统和明确手侧分派，不将双手旧裸事件当成同时置零', () => {
    const dual = { dual: true, acceptedIdentities: ['glove-copy'] };
    expect(resolveGloveQuaternionResetSide({ handReset: true, displaySystemId: 'glove-copy', handSide: 'left' }, dual)).toBe('left');
    expect(resolveGloveQuaternionResetSide({ handReset: true, displaySystemId: 'glove-copy', outputChannel: 'back' }, dual)).toBe('right');
    expect(resolveGloveQuaternionResetSide({ handReset: true, displaySystemId: 'other-system', handSide: 'right' }, dual)).toBeNull();
    expect(resolveGloveQuaternionResetSide({ handReset: true }, dual)).toBeNull();
    expect(resolveGloveQuaternionResetSide({ handReset: true, handSide: 'both' }, dual)).toBeNull();
    expect(resolveGloveQuaternionResetSide({ handReset: false, handSide: 'right' }, dual)).toBeNull();
    expect(resolveGloveQuaternionResetSide({ handReset: true }, { hand: false })).toBe('right');
    expect(resolveGloveQuaternionResetSide({ handReset: true, backFlag: false }, dual)).toBe('left');
  });

  it('地形独立默认色阶/高度，不沿用其他视图参数，保留本模式有效缓存', () => {
    expect(gloveExhibitionConfig('gloveTerrain')).toEqual({ valuej1: 170, value1: 4.8, valuelInit1: .6 });
    expect(gloveExhibitionConfig('gloveTerrain', { valuej1: 90, value1: 7, terrainBaseGain: 0 }))
      .toEqual({ valuej1: 90, value1: 7, valuelInit1: 0 });
    expect(gloveExhibitionConfig('gloveTerrain', { valuelInit1: 500 })).toHaveProperty('valuelInit1', .6);
    expect(gloveExhibitionConfig('gloveTerrain', { valuelInit1: 0 })).toHaveProperty('valuelInit1', .6);
    expect(gloveExhibitionConfig('gloveTerrain', { terrainBaseGain: 500 })).toHaveProperty('valuelInit1', .6);
    expect(gloveExhibitionConfig('normal', { valuej1: 90 })).toEqual({});
  });
  it('展示名仅作用于两个专用模式', () => {
    expect(isGloveExhibitionMode('gloveMotion')).toBe(true);
    expect(isGloveExhibitionMode('gloveTerrain')).toBe(true);
    expect(isGloveExhibitionMode('normal')).toBe(false);
  });

  it('热力使用当前扣零矩阵，弯指仍使用未清零映射和校准', () => {
    const value = input();
    value.message.processedData = Array(256).fill(0);
    const frame = buildGloveExhibitionFrame(value);
    expect(frame.rawPressure).toEqual(Array(256).fill(0));
    expect(frame.pressure).toEqual(Array(147).fill(2));
    expect(frame.fingers).toEqual(Array(5).fill(.5));
    expect(frame.quaternion).toEqual([0, 0, 0, 1]);
  });

  it('两路身份独立，显式手侧优先于通道后备值', () => {
    expect(buildGloveExhibitionFrame(input({ channel: 'back' })).side).toBe('right');
    const value = input({ channel: 'sit' });
    value.message.handSide = 'right';
    expect(buildGloveExhibitionFrame(value).side).toBe('right');
    value.message.handSide = 'left';
    expect(buildGloveExhibitionFrame({ ...value, channel: 'back' }).side).toBe('left');
  });

  it('坏姿态不变成有效四元数，压力数组不共享可变引用', () => {
    const value = input();
    value.message.rotate = [null, 0, 0, 1];
    const frame = buildGloveExhibitionFrame(value);
    expect(frame.quaternion).toBeNull();
    frame.pressure.splice(0, 4);
    frame.rawPressure[0] = 900;
    expect(value.message.newArr147).toHaveLength(147);
    expect(value.channelPressure[0]).toBe(2);
  });

  it('整包195点只呈真实压力，不能按旧147线序虚构弯指', () => {
    const value = input();
    value.message.mappedArr195 = Array(195).fill(3);
    const frame = buildGloveExhibitionFrame(value);
    expect(frame.pressure).toHaveLength(195);
    expect(frame.fingers).toBeNull();
    expect(frame.rawPressure).toHaveLength(256);
  });

  it('兼容旧字符串帧与10列线序，缺少有效点位保持无弯指', () => {
    const value = input({ message: { newArr: JSON.stringify(Array(147).fill(4)) } });
    expect(buildGloveExhibitionFrame(value).fingerPoints).toEqual(Array(5).fill(24));
    expect(getGloveFingerPoints({}, [])).toBeNull();
  });
});
