import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { fitPortalPointViewport } from './portalPointViewport';

/** 使用完整画布和偏心安全区建立俯视镜头。 */
function fixture() {
  const camera = new PerspectiveCamera(40, 1470 / 834, 1, 150000);
  camera.position.set(0, 90, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return { camera, canvas: { left: 0, top: 0, width: 1470, height: 834 },
    viewport: { left: 316, top: 100, width: 878, height: 712 }, distance: 90, planeWidth: 80, planeDepth: 40 };
}

/** 将世界点按真实全窗画布投影为屏幕坐标。 */
function project({ camera, canvas }, x = 0, z = 0) {
  camera.updateMatrixWorld();
  const point = new Vector3(x, 0, z).project(camera);
  return { x: canvas.left + (point.x + 1) * canvas.width / 2,
    y: canvas.top + (1 - point.y) * canvas.height / 2 };
}

describe('门户点图安全投影区', () => {
  it('偏心安全区完整容纳默认点面，镜头位置和姿态不变', () => {
    const state = fixture();
    const before = { position: state.camera.position.toArray(), quaternion: state.camera.quaternion.toArray(), zoom: state.camera.zoom };
    fitPortalPointViewport(state);
    expect(project(state).x).toBeCloseTo(755);
    expect(project(state).y).toBeCloseTo(456);
    for (const x of [-40, 40]) for (const z of [-20, 20]) {
      const point = project(state, x, z);
      expect(point.x).toBeGreaterThan(state.viewport.left);
      expect(point.x).toBeLessThan(state.viewport.left + state.viewport.width);
      expect(point.y).toBeGreaterThan(state.viewport.top);
      expect(point.y).toBeLessThan(state.viewport.top + state.viewport.height);
    }
    expect({ position: state.camera.position.toArray(), quaternion: state.camera.quaternion.toArray(), zoom: state.camera.zoom }).toEqual(before);
  });

  it('重新应用布局不抵消用户放大；恢复持久镜头时更新投影仍保留避让', () => {
    const state = fixture();
    fitPortalPointViewport(state);
    const width = project(state, 40).x - project(state, -40).x;
    state.camera.position.y /= 2;
    fitPortalPointViewport(state);
    state.camera.updateProjectionMatrix();
    expect(project(state, 40).x - project(state, -40).x).toBeCloseTo(width * 2);
    expect(project(state).x).toBeCloseTo(755);
  });

  it('纯点图恢复原始完整视口投影，退出后可再次避让', () => {
    const state = fixture();
    const original = state.camera.projectionMatrix.toArray();
    fitPortalPointViewport(state);
    fitPortalPointViewport({ ...state, viewport: state.canvas });
    expect(state.camera.view.enabled).toBe(false);
    expect(state.camera.fov).toBe(40);
    state.camera.projectionMatrix.toArray().forEach((value, index) => expect(value).toBeCloseTo(original[index], 12));
    fitPortalPointViewport(state);
    expect(project(state).x).toBeCloseTo(755);
  });
});
