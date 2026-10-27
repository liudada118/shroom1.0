import { Vector3 } from 'three';
import { createWorkspaceViewTools } from '../../renderers/workspaceViewTools';

/** 给偏置或倾斜的旧点图接入统一工具，镜头围绕真实垫面中心移动。 */
export function createPointViewTools({ object, camera, controls, plane = object, localCenter = null }) {
  const tools = createWorkspaceViewTools({ object, camera, controls });
  /** 使用固定底面中心，避免压力高度变化带着旋转中心漂移。 */
  const centerTarget = () => {
    if (localCenter) {
      plane.updateWorldMatrix(true, false);
      controls.target.copy(localCenter).applyMatrix4(plane.matrixWorld);
    } else {
      object.updateWorldMatrix(true, true);
      object.getWorldPosition(controls.target);
    }
  };
  /** 同步当前观察目标与镜头方向，不覆盖初始复位快照。 */
  const recenter = () => {
    if (!tools.getState().available) return false;
    centerTarget();
    controls.update();
    camera.updateMatrixWorld(true);
    return true;
  };
  /** 以点图底面中心变换对象，补偿父空间位移并保持镜头与观察目标不动。 */
  const transformAtCenter = (transform) => {
    plane.updateWorldMatrix(true, false);
    const before = plane.localToWorld(localCenter.clone());
    const changed = transform();
    if (!changed) return false;
    plane.updateWorldMatrix(true, false);
    const after = plane.localToWorld(localCenter.clone());
    if (object.parent) {
      object.parent.worldToLocal(before);
      object.parent.worldToLocal(after);
    }
    object.position.add(before.sub(after));
    object.updateWorldMatrix(true, true);
    return true;
  };
  if (localCenter) {
    recenter();
    controls.target0.copy(controls.target);
  }
  return {
    ...tools,
    recenter,
    /** 小床每次绕自身局部轴转30°，混合点击时保持底面中心与镜头不动。 */
    rotate(axis, direction = 1) {
      if (!localCenter) return tools.rotate(axis, direction);
      if (!tools.getState().available || !['x', 'y', 'z'].includes(axis) || !Number.isFinite(direction)) return false;
      return transformAtCenter(() => {
        object.rotateOnAxis(new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), Math.sign(direction) * Math.PI / 6);
        return true;
      });
    },
    /** 小床镜像围绕同一底面中心，不修改压力顶点或镜头。 */
    flip(axis) {
      if (!localCenter) return tools.flip(axis);
      if (!tools.getState().available || !['x', 'y'].includes(axis)) return false;
      return transformAtCenter(() => tools.flip(axis));
    },
    /** 恢复初始姿态和镜头；先耗尽Trackball未被reset清除的输入惯性。 */
    reset() {
      if (!tools.getState().available) return false;
      if (localCenter) {
        const damping = controls.dynamicDampingFactor;
        controls.dynamicDampingFactor = 1;
        controls.update();
        controls.update();
        controls.dynamicDampingFactor = damping;
      }
      const changed = tools.reset();
      if (changed && localCenter) recenter();
      return changed;
    },
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
