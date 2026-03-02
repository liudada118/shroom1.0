/**
 * disposeThree.js
 * Three.js 资源清理工具
 *
 * 统一处理 Three.js 组件卸载时的资源释放，防止 WebGL 上下文泄漏和 GPU 内存泄漏。
 *
 * 使用方式：
 *   import { cleanupThree } from './disposeThree';
 *
 *   useEffect(() => {
 *     // ... init Three.js scene ...
 *     return () => {
 *       cleanupThree({ renderer: rendererRef.current, scene, controls });
 *     };
 *   }, []);
 */

/**
 * 递归释放 scene 中所有 geometry、material、texture 资源，
 * 然后销毁 controls 和 renderer，并强制释放 WebGL 上下文。
 *
 * @param {object} options
 * @param {THREE.WebGLRenderer} [options.renderer] - 渲染器实例
 * @param {THREE.Scene} [options.scene] - 场景实例
 * @param {THREE.Controls} [options.controls] - 控制器实例（TrackballControls 等）
 * @param {number} [options.animationId] - requestAnimationFrame 返回的 ID
 */
export function cleanupThree({ renderer, scene, controls, animationId }) {
  // 1. 取消动画帧
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // 2. 递归释放场景中的所有资源
  if (scene) {
    scene.traverse((obj) => {
      // 释放几何体
      if (obj.geometry) {
        obj.geometry.dispose();
      }

      // 释放材质及其纹理
      if (obj.material) {
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];

        materials.forEach((material) => {
          // 释放材质上的所有纹理贴图
          const textureKeys = [
            'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
            'envMap', 'alphaMap', 'aoMap', 'displacementMap',
            'emissiveMap', 'gradientMap', 'metalnessMap', 'roughnessMap',
          ];
          textureKeys.forEach((key) => {
            if (material[key]) {
              material[key].dispose();
            }
          });

          material.dispose();
        });
      }
    });
  }

  // 3. 释放控制器
  if (controls && typeof controls.dispose === 'function') {
    controls.dispose();
  }

  // 4. 释放渲染器并强制回收 WebGL 上下文
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    const canvas = renderer.domElement;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }
}
