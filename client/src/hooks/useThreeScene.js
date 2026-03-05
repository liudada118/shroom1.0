/**
 * useThreeScene.js
 * Three.js 场景初始化自定义 Hook
 *
 * 将 three/ 目录下 47 个组件中完全相同的 Scene、Camera、Renderer、
 * Controls 初始化代码抽取为可复用的 Hook。
 *
 * 原始问题：
 *   - 47 个组件各自创建 new THREE.Scene()
 *   - 47 个组件各自创建 new THREE.WebGLRenderer()
 *   - 43 个组件各自创建 new THREE.PerspectiveCamera()
 *   - 42 个组件各自创建 TrackballControls
 *   每个组件约 50-80 行完全相同的初始化代码
 *
 * 使用示例：
 *   const { scene, camera, renderer, controls, containerRef } = useThreeScene({
 *     cameraPosition: [0, 100, 200],
 *     backgroundColor: 0x1a1a2e,
 *     enableControls: true,
 *   });
 *
 *   // 在 useEffect 中添加自定义网格
 *   useEffect(() => {
 *     const mesh = new THREE.Mesh(geometry, material);
 *     scene.add(mesh);
 *   }, [scene]);
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';

/**
 * @param {object} options - 场景配置选项
 * @param {number[]} [options.cameraPosition=[0, 100, 200]] - 相机初始位置 [x, y, z]
 * @param {number} [options.cameraFov=45] - 相机视角
 * @param {number} [options.cameraNear=0.1] - 近裁剪面
 * @param {number} [options.cameraFar=10000] - 远裁剪面
 * @param {number} [options.backgroundColor=0x1a1a2e] - 背景颜色
 * @param {boolean} [options.enableControls=true] - 是否启用轨迹球控制
 * @param {boolean} [options.enableStats=false] - 是否显示性能统计
 * @param {boolean} [options.antialias=true] - 是否启用抗锯齿
 * @param {number} [options.pixelRatio] - 像素比（默认为设备像素比）
 * @returns {{
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   renderer: THREE.WebGLRenderer,
 *   controls: TrackballControls,
 *   containerRef: React.RefObject,
 *   resetCamera: function,
 *   resize: function,
 * }}
 */
export function useThreeScene(options = {}) {
  const {
    cameraPosition = [0, 100, 200],
    cameraFov = 45,
    cameraNear = 0.1,
    cameraFar = 10000,
    backgroundColor = 0x1a1a2e,
    enableControls = true,
    antialias = true,
    pixelRatio,
  } = options;

  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animationIdRef = useRef(null);

  const [isReady, setIsReady] = useState(false);

  // 初始化场景
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      cameraFov, width / height, cameraNear, cameraFar
    );
    camera.position.set(...cameraPosition);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio || window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    let controls = null;
    if (enableControls) {
      controls = new TrackballControls(camera, renderer.domElement);
      controls.rotateSpeed = 2.0;
      controls.zoomSpeed = 1.2;
      controls.panSpeed = 0.8;
      controlsRef.current = controls;
    }

    // 默认灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    scene.add(directionalLight);

    // 动画循环
    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    animate();

    setIsReady(true);

    // 窗口大小变化处理
    function handleResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);
      if (controls) controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      // 清理场景中的对象
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, []); // 只在挂载时初始化一次

  /**
   * 重置相机到初始位置
   */
  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (camera) {
      camera.position.set(...cameraPosition);
      camera.lookAt(0, 0, 0);
    }
    const controls = controlsRef.current;
    if (controls) controls.reset();
  }, [cameraPosition]);

  /**
   * 手动触发尺寸更新
   */
  const resize = useCallback(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!container || !camera || !renderer) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }, []);

  return {
    scene: sceneRef.current,
    camera: cameraRef.current,
    renderer: rendererRef.current,
    controls: controlsRef.current,
    containerRef,
    isReady,
    resetCamera,
    resize,
  };
}
