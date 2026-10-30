import { Vector3 } from 'three';

/** 校验有限的展示变换快照，不接收设备姿态、帧数据或可变 Three.js 对象。 */
export function validateWorkspaceViewSnapshot(value) {
  /** 接受长度固定、有限且有界的向量，避免坏缓存移走整个场景。 */
  const vector = (input, length, limit = 1e7) => Array.isArray(input) && input.length === length
    && input.every((number) => typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= limit);
  if (!value || value.schemaVersion !== 1 || typeof value.flipX !== 'boolean' || typeof value.flipY !== 'boolean'
    || !vector(value.object?.position, 3) || !vector(value.object?.quaternion, 4, 1)
    || !vector(value.object?.scale, 3, 1e6) || value.object.scale.some((number) => Math.abs(number) < 1e-6)
    || Math.abs(Math.hypot(...value.object.quaternion) - 1) > 1e-6
    || !vector(value.camera?.position, 3) || !vector(value.camera?.target, 3) || !vector(value.camera?.up, 3, 1)
    || Math.abs(Math.hypot(...value.camera.up) - 1) > 1e-6
    || typeof value.camera.zoom !== 'number' || !Number.isFinite(value.camera.zoom) || value.camera.zoom < 1e-4 || value.camera.zoom > 1e4) return false;
  const direction = new Vector3().fromArray(value.camera.position).sub(new Vector3().fromArray(value.camera.target));
  return direction.lengthSq() > 1e-12 && new Vector3().fromArray(value.camera.up).cross(direction.normalize()).lengthSq() > 1e-12;
}

/** 为原生 3D 场景提供局部视角工具；只改对象与相机，不重排压力数组。 */
export function createWorkspaceViewTools({ object, camera, controls, localPlane = false }) {
  const initial = { position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() };
  let disposed = false, notificationPending = false;
  let flipX = false, flipY = false;
  const listeners = new Set();
  /** 复制展示对象和镜头，设备姿态及传感器数据不进入快照。 */
  const getSnapshot = () => disposed ? null : ({ schemaVersion: 1,
    object: { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray() },
    camera: { position: camera.position.toArray(), up: camera.up.toArray(), target: controls.target.toArray(), zoom: camera.zoom },
    flipX, flipY });
  /** 同步交付最终视角，订阅方异常不能中断画布操作或释放。 */
  const publish = () => {
    if (disposed) return;
    for (const listener of [...listeners]) { try { listener(getSnapshot()); } catch { /* 本地保存失败不影响场景。 */ } }
  };
  /** 合并同一操作内的控制器和对象通知，待中心补偿完成再读取快照。 */
  const notifyChange = () => {
    if (disposed || notificationPending || !listeners.size) return;
    notificationPending = true;
    queueMicrotask(() => { notificationPending = false; publish(); });
  };
  controls.addEventListener?.('change', notifyChange);
  /** 更新世界矩阵，让同一帧的投影与交互读取最新视角。 */
  const update = () => {
    object.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    notifyChange();
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
    getSnapshot,
    notifyChange,
    /** 监听按钮与鼠标视角变化；取消订阅不改变画布状态。 */
    subscribe(listener) {
      if (disposed || typeof listener !== 'function') return () => {};
      listeners.add(listener); return () => listeners.delete(listener);
    },
    /** 原子恢复有效快照，保留系统默认复位镜头并清除旧控制惯性。 */
    restoreSnapshot(snapshot) {
      if (disposed || !validateWorkspaceViewSnapshot(snapshot)) return false;
      const expected = [initial.scale.x * (snapshot.flipX ? -1 : 1), initial.scale.y, initial.scale.z * (snapshot.flipY ? -1 : 1)];
      if (snapshot.object.scale.some((number, index) => Math.abs(number - expected[index]) > 1e-8 * Math.max(1, Math.abs(expected[index])))) return false;
      const damping = controls.dynamicDampingFactor, enabledDamping = controls.enableDamping;
      if (Number.isFinite(damping)) controls.dynamicDampingFactor = 1;
      if (typeof enabledDamping === 'boolean') controls.enableDamping = false;
      controls.update(); controls.update();
      controls.dynamicDampingFactor = damping;
      if (typeof enabledDamping === 'boolean') controls.enableDamping = enabledDamping;
      object.position.fromArray(snapshot.object.position); object.quaternion.fromArray(snapshot.object.quaternion);
      object.scale.fromArray(snapshot.object.scale); flipX = snapshot.flipX; flipY = snapshot.flipY;
      camera.position.fromArray(snapshot.camera.position); camera.up.fromArray(snapshot.camera.up);
      camera.zoom = snapshot.camera.zoom; controls.target.fromArray(snapshot.camera.target);
      camera.updateProjectionMatrix(); camera.lookAt(controls.target); controls.update(); update(); return true;
    },
    /** 当前状态供工具栏展示，不泄漏可变 Three.js 对象。 */
    getState() { return { available: !disposed, flipX, flipY,
      selectionSafe: !flipX && !flipY && ['x', 'y', 'z'].every((axis) => Math.abs(object.rotation[axis] - initial.rotation[axis]) < 1e-9) }; },
    /** 每次沿模型轴旋转准确的 30°，支持反向操作。 */
    rotate(axis, direction = 1) {
      if (disposed || !['x', 'y', 'z'].includes(axis) || !Number.isFinite(direction)) return false;
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
      if (disposed || !Number.isFinite(direction)) return false;
      const delta = camera.position.clone().sub(controls.target);
      const distance = Math.max(camera.near * 4, Math.min(camera.far / 4, delta.length() * (direction > 0 ? .85 : 1 / .85)));
      camera.position.copy(controls.target).add(delta.setLength(distance));
      controls.update(); update(); return true;
    },
    /** 从垫面法向俯视；恢复视角可回到进入系统时的镜头。 */
    top() {
      if (disposed) return false;
      const distance = camera.position.distanceTo(controls.target);
      object.updateMatrixWorld(true);
      const direction = localPlane ? new Vector3(0, 1, 0).transformDirection(object.matrixWorld) : new Vector3(0, 1, 0);
      camera.position.copy(controls.target).add(direction.multiplyScalar(distance));
      if (!localPlane) camera.position.z += .001;
      camera.up.copy(localPlane ? new Vector3(0, 0, -1).transformDirection(object.matrixWorld) : new Vector3(0, 0, -1));
      camera.lookAt(controls.target);
      controls.update(); update(); return true;
    },
    /** 同时恢复模型变换和相机初始状态。 */
    reset() {
      if (disposed) return false;
      restoreObject(); controls.reset(); update(); return true;
    },
    /** 卸载时撤销展示镜像，防止旧模块共享 group 污染下一次挂载。 */
    dispose() {
      if (disposed) return;
      publish(); disposed = true;
      controls.removeEventListener?.('change', notifyChange); listeners.clear(); restoreObject();
    },
  };
}
