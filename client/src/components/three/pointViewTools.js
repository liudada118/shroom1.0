import { Vector3 } from 'three';
import { createWorkspaceViewTools } from '../../renderers/workspaceViewTools';

/** 给偏置或倾斜的旧点图接入统一工具，镜头围绕真实垫面中心移动。 */
export function createPointViewTools({ object, camera, controls, plane = object }) {
  const tools = createWorkspaceViewTools({ object, camera, controls });
  /** 只更新观察目标，设备数据、局部点坐标及初始相机快照保持不变。 */
  const centerTarget = () => {
    object.updateWorldMatrix(true, true);
    object.getWorldPosition(controls.target);
  };
  return {
    ...tools,
    /** 沿实际点图所在平面的法线俯视，避免世界原点把矩阵移出画面。 */
    top() {
      if (!tools.getState().available) return false;
      centerTarget();
      plane.updateWorldMatrix(true, false);
      const distance = Math.max(camera.near * 4, camera.position.distanceTo(controls.target));
      const normal = new Vector3(0, 1, 0).transformDirection(plane.matrixWorld);
      camera.position.copy(controls.target).add(normal.multiplyScalar(distance));
      camera.up.copy(new Vector3(0, 0, -1).transformDirection(plane.matrixWorld));
      camera.lookAt(controls.target);
      controls.update();
      camera.updateMatrixWorld(true);
      return true;
    },
    /** 缩放相对点图中心，不拉向偏离垫面的世界原点。 */
    zoom(direction) {
      if (!tools.getState().available) return false;
      centerTarget();
      return tools.zoom(direction);
    },
  };
}
