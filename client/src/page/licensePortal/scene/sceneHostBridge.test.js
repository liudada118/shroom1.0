import { describe, expect, it } from 'vitest';
import { getSceneHostTransform } from './sceneHostBridge';

describe('粒子跨容器等比投影', () => {
  const home = { x: 210, y: 24, width: 1180, height: 850 };
  const selector = { x: 490, y: 110, width: 720, height: 680 };

  it.each([[home, selector], [selector, home],
    [home, { x: 24, y: 260, width: 327, height: 540 }],
  ])('不同横纵比的宿主保持所有投影点的比例与位置', (from, to) => {
    const transform = getSceneHostTransform(from, to);
    expect(transform.scale).toBe(from.height / to.height);
    for (const [x, y] of [[0, 0], [-0.25, 0.15], [0.1, -0.2]]) {
      const before = [from.x + from.width / 2 + x * from.height, from.y + from.height / 2 + y * from.height];
      const after = [to.x + transform.x + (to.width / 2 + x * to.height) * transform.scale,
        to.y + transform.y + (to.height / 2 + y * to.height) * transform.scale];
      expect(after[0]).toBeCloseTo(before[0], 8);
      expect(after[1]).toBeCloseTo(before[1], 8);
    }
  });

  it('快速反向时从当前屏幕矩形接续，而不是回到完整首页尺寸', () => {
    const midway = { x: 280, y: 65, width: 900, height: 730 };
    const transform = getSceneHostTransform(midway, home);
    expect(home.x + transform.x + home.width * transform.scale / 2).toBeCloseTo(midway.x + midway.width / 2);
    expect(home.y + transform.y + home.height * transform.scale / 2).toBeCloseTo(midway.y + midway.height / 2);
  });

  it('同尺寸原位置无需额外变换', () => {
    expect(getSceneHostTransform(home, home)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it.each([null, { ...home, width: 0 }, { ...home, height: -1 }, { ...home, height: Infinity }, { ...home, x: NaN }])('无效或隐藏宿主不产生非法 transform：%s', (rect) => {
    expect(getSceneHostTransform(rect, home)).toBeNull();
    expect(getSceneHostTransform(home, rect)).toBeNull();
  });
});
