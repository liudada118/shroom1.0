import { Vector3 } from 'three';

/** 为原生 3D 场景提供局部视角工具；只改对象与相机，不重排压力数组。 */
export function createWorkspaceViewTools({ object, camera, controls }) {
  const initial = { position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() };
  let disposed = false;
  let flipX = false, flipY = false;
  /** 更新世界矩阵，让同一帧的投影与交互读取最新视角。 */
  const update = () => {
    object.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  };
  /** 恢复初始模型姿态；不重置设备姿态、归零或算法。 */
  const restoreObject = () => {
    object.position.copy(initial.position);
    object.rotation.copy(initial.rotation);
    object.scale.copy(initial.scale);
    flipX = false; flipY = false;
    update();
  };
  return {
    /** 当前状态供工具栏展示，不泄漏可变 Three.js 对象。 */
    getState() { return { available: !disposed, flipX, flipY,
      selectionSafe: !flipX && !flipY && ['x', 'y', 'z'].every((axis) => Math.abs(object.rotation[axis] - initial.rotation[axis]) < 1e-9) }; },
    /** 每次沿模型轴旋转准确的 30°，支持反向操作。 */
    rotate(axis, direction = 1) {
      if (disposed || !['x', 'y', 'z'].includes(axis)) return false;
      object.rotation[axis] += Math.sign(direction) * Math.PI / 6;
      update(); return true;
    },
    /** 沿水平 X 或垫面 Z 轴镜像；压力高度轴保持不变。 */
    flip(axis) {
      if (disposed || !['x', 'y'].includes(axis)) return false;
      if (axis === 'x') { flipX = !flipX; object.scale.x = initial.scale.x * (flipX ? -1 : 1); }
      else { flipY = !flipY; object.scale.z = initial.scale.z * (flipY ? -1 : 1); }
      update(); return true;
    },
    /** 相对观察目标缩放相机距离，不改变数据值或模型比例。 */
    zoom(direction) {
      if (disposed) return false;
      const delta = camera.position.clone().sub(controls.target);
      const distance = Math.max(camera.near * 4, Math.min(camera.far / 4, delta.length() * (direction > 0 ? .85 : 1 / .85)));
      camera.position.copy(controls.target).add(delta.setLength(distance));
      controls.update(); update(); return true;
    },
    /** 从垫面法向俯视；恢复视角可回到进入系统时的镜头。 */
    top() {
      if (disposed) return false;
      const distance = camera.position.distanceTo(controls.target);
      camera.position.copy(controls.target).add(new Vector3(0, distance, .001));
      camera.up.set(0, 0, -1);
      camera.lookAt(controls.target);
      controls.update(); update(); return true;
    },
    /** 同时恢复模型变换和相机初始状态。 */
    reset() {
      if (disposed) return false;
      restoreObject(); controls.reset(); update(); return true;
    },
    /** 卸载时撤销展示镜像，防止旧模块共享 group 污染下一次挂载。 */
    dispose() { restoreObject(); disposed = true; },
  };
}
