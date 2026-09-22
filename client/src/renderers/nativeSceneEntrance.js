import { installModelParticleEntrance } from './modelParticleEntrance';
import { createNativeModelSamples, createFootPlaneSamples } from './nativeSceneSamples';

/** 回收卸载后迟到的加载结果；只释放该次原生加载拥有的资源。 */
function disposeLateModel(model) {
  model.traverse((object) => {
    object.geometry?.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}

/** 将异步原生模型接入门户单段粒子过渡；由调用方负责 renderer 和 controls 的生命周期。 */
export function createNativeSceneEntrance(renderer, scene, camera, container) {
  const canvas = renderer.domElement;
  let disposed = false, failed = false, entrance;
  const status = document.createElement('div');
  status.className = 'portal-model-status';
  status.setAttribute('role', 'status');
  status.textContent = '正在加载场景…';
  container.appendChild(status);
  canvas.dataset.modelState = container.dataset.modelState = 'loading';
  renderer.setClearAlpha(0);
  scene.traverse((object) => { if (['GridHelper', 'PointLightHelper'].includes(object.type)) object.visible = false; });
  /** 按宿主尺寸更新投影；入口切换不会继续使用旧窗口比例。 */
  const resize = () => {
    if (disposed || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const originalRender = renderer.render;
  /** 原生数据和控制器更新后同步样本，直接绘制时也保持终点一致。 */
  renderer.render = function (...args) { entrance?.update(); return originalRender.apply(this, args); };
  const api = {
    resize,
    /** 卸载或超时后的模型不得再加入场景或覆盖新系统。 */
    accept(model) {
      if (!disposed && !failed) return true;
      disposeLateModel(model);
      return false;
    },
    /** 完成姿态和材质设置后再调用，避免向未准备好的模型交接。 */
    setModel(model, { footPlanes = false } = {}) {
      if (disposed || failed) return;
      try {
        const samples = footPlanes ? createFootPlaneSamples(model) : createNativeModelSamples(model);
        if (!samples) throw new Error('场景没有可采样的表面');
        entrance?.dispose();
        entrance = installModelParticleEntrance(renderer, scene, camera, model, { samples, adaptiveSize: true });
        canvas.dataset.modelState = container.dataset.modelState = 'ready';
      } catch { api.fail(); }
    },
    /** 资源失败保留可返回的错误状态，不在稍后突然弹出模型。 */
    fail() {
      if (disposed) return;
      failed = true;
      canvas.style.visibility = 'hidden';
      canvas.dataset.modelState = container.dataset.modelState = 'error';
      status.textContent = '场景加载失败，请返回系统列表重试';
    },
    /** 取消形变并清理观察器、临时提示与渲染包装。 */
    dispose() {
      if (disposed) return;
      disposed = true;
      entrance?.dispose();
      disposeLateModel(scene);
      observer.disconnect();
      renderer.render = originalRender;
      status.remove();
      delete canvas.shroomSceneLoading;
      delete container.dataset.modelState;
    },
  };
  canvas.shroomSceneLoading = api;
  return api;
}
