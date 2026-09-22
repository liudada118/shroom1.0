// 粒子采样、扫掠变形与镜头过渡迁移自 fiber-sensor；此处只展示场景，不生成传感数据。
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { createSceneHostBridge } from './sceneHostBridge';
import { advanceMorph, createMushroomIntro, frameFollowStrength, sweepProgress } from './sceneMorph';
const CAMERA_FRAMING_EVENT = "system-scene:framing-transition";
const CAMERA_FRAMING_CAPTURE_EVENT = "system-scene:framing-capture";
import { SCENE_MODELS as MODEL_SPECS } from './sceneCatalog';
import { captureParticleProjection } from '../../../renderers/particleEntrance';
import { createSceneMotionClock, returnMotionSpeed } from './sceneMotionClock';
import { createLayoutPositions, loadFootLayout } from './sceneLayouts';
import { getMeshSurfaceArea } from './sceneModelSampling';
const PARTICLE_COUNT = 3600;
const AMBIENT_PARTICLE_COUNT = 720;
/** 平滑粒子扫掠进度，避免端点跳变。 */
function smoothstep(start, end, value) {
  const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}
/** 按各网格的面积权重分配固定粒子总数。 */
function allocateCounts(weights, total) {
  const sum = weights.reduce((acc, value) => acc + value, 0) || 1;
  const counts = weights.map((weight) => Math.floor(weight / sum * total));
  let remainder = total - counts.reduce((acc, value) => acc + value, 0);
  let index = 0;
  while (remainder > 0) {
    counts[index % counts.length] += 1;
    remainder -= 1;
    index += 1;
  }
  return counts;
}
/** 创建共用的柔边粒子纹理。 */
function createParticleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create preview particle texture");
  }
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
/** 生成固定分布的背景微粒，仅用于装饰。 */
function createAmbientDustPositions() {
  const positions = new Float32Array(AMBIENT_PARTICLE_COUNT * 3);
  /** 按序号生成稳定的装饰噪声。 */
  const random = (index, salt) => {
    const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let index = 0; index < AMBIENT_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    positions[stride] = (random(index, 1) - 0.5) * 15;
    positions[stride + 1] = (random(index, 2) - 0.5) * 8.5;
    positions[stride + 2] = -0.8 - random(index, 3) * 5.4;
  }
  return positions;
}
/** 将不同单位和朝向的模型归一到同一预览空间。 */
function normalizeModel(root, spec) {
  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
  // 原生机器人从 Y 轴观察；把原相机方向转到预览 Z 轴，避免只复制模型旋转后变成俯视。
  if (spec.viewDirection) {
    const view = new THREE.Matrix4().lookAt(new THREE.Vector3(...spec.viewDirection), new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    wrapper.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(view).invert());
  }
  wrapper.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(wrapper);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);
  const maxDimension = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
  wrapper.scale.setScalar(spec.targetSize / maxDimension);
  wrapper.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  wrapper.position.sub(center);
  if (spec.offset) {
    wrapper.position.add(new THREE.Vector3(...spec.offset));
  }
  wrapper.updateMatrixWorld(true);
  return wrapper;
}
/** 提取可采样的模型网格。 */
function extractMeshes(root) {
  const meshes = [];
  root.traverse((child) => {
    const candidate = child;
    const geometry = candidate.geometry;
    if (!candidate.isMesh || !geometry?.attributes?.position) {
      return;
    }
    meshes.push(candidate);
  });
  return meshes;
}
/** 以空间位置计算粒子揭示次序。 */
function createSweepWeights(positions) {
  const weights = new Float32Array(positions.length / 3);
  let minX = Infinity;
  let maxX = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    maxX = Math.max(maxX, positions[index]);
  }
  const spanX = Math.max(maxX - minX, 1e-3);
  for (let index = 0; index < weights.length; index += 1) {
    const stride = index * 3;
    const x = positions[stride];
    const y = positions[stride + 1];
    const z = positions[stride + 2];
    weights[index] = THREE.MathUtils.clamp(
      (x - minX) / spanX + Math.sin(y * 1.1 + z * 1.4) * 0.055,
      0,
      1
    );
  }
  return weights;
}
/** 计算采样点包围盒中心供镜头跟随。 */
function getTargetCenter(positions) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
    maxZ = Math.max(maxZ, positions[index + 2]);
  }
  return [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
}
/** 将模型表面采样为固定数量的粒子。 */
function sampleTarget(root, spec) {
  const normalizedRoot = normalizeModel(root, spec);
  const meshes = extractMeshes(normalizedRoot);
  if (meshes.length === 0) {
    throw new Error(`No mesh geometry found in ${spec.label}`);
  }
  const counts = allocateCounts(
    meshes.map(
      (mesh) => getMeshSurfaceArea(mesh)
    ),
    PARTICLE_COUNT
  );
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const baseColor = new THREE.Color(spec.color);
  const highlight = baseColor.clone().offsetHSL(0.04, 0.1, 0.16);
  let cursor = 0;
  normalizedRoot.updateMatrixWorld(true);
  meshes.forEach((mesh, meshIndex) => {
    mesh.updateWorldMatrix(true, false);
    const sampler = new MeshSurfaceSampler(mesh).build();
    for (let index = 0; index < counts[meshIndex]; index += 1) {
      sampler.sample(point, normal);
      mesh.localToWorld(point);
      normal.transformDirection(mesh.matrixWorld).normalize();
      point.addScaledVector(normal, (Math.random() - 0.5) * 0.018);
      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;
      const color = baseColor.clone().lerp(highlight, Math.random() * 0.55);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      cursor += 1;
    }
    if (sampler.geometry !== mesh.geometry) sampler.geometry.dispose();
  });
  if (!positions.every(Number.isFinite)) throw new Error('模型采样包含无效坐标');
  return {
    key: spec.key,
    positions,
    colors,
    sweepWeights: createSweepWeights(positions),
    center: getTargetCenter(positions)
  };
}
/** 按模型格式加载本地资源。 */
async function loadModel(spec, gltfLoader, fbxLoader) {
  try {
    const root = await new Promise((resolve, reject) => {
    if (spec.loader === "gltf") {
      gltfLoader.load(
        spec.url,
        (result) => resolve(result.scene),
        void 0,
        reject
      );
      return;
    }
    fbxLoader.load(spec.url, resolve, void 0, reject);
    });
    return { root, spec };
  } catch (error) {
    if (!spec.fallback) throw error;
    return loadModel({ ...spec, ...spec.fallback, fallback: null }, gltfLoader, fbxLoader);
  }
}
/** 采样后释放源模型的几何、材质和纹理，异步迟到的结果也必须清理。 */
function disposeModel(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}

/** 非模型系统从实际矩阵或底图布局生成粒子，颜色只用于预览。 */
function createLayoutTarget(key, { positions, grid }) {
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const color = new THREE.Color('#8bd8ff');
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    colors.set([color.r, color.g, color.b], i * 3);
  }
  return { key, positions, colors, grid, sweepWeights: createSweepWeights(positions), center: getTargetCenter(positions) };
}

/** 创建加载中的装饰形态，不冒充已加载设备。 */
function createLoadingTarget() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sweepWeights = new Float32Array(PARTICLE_COUNT);
  const colorA = new THREE.Color("#0ea5e9");
  const colorB = new THREE.Color("#e0f2fe");
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const angle = index * 0.08;
    const radius = 0.5 + index / PARTICLE_COUNT * 2.8;
    positions[stride] = Math.cos(angle) * radius * 0.52;
    positions[stride + 1] = Math.sin(index * 0.033) * 0.9;
    positions[stride + 2] = Math.sin(angle) * radius * 0.35;
    sweepWeights[index] = index / PARTICLE_COUNT;
    const color = colorA.clone().lerp(colorB, Math.random() * 0.8);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }
  return {
    key: "loading",
    positions,
    colors,
    sweepWeights,
    center: getTargetCenter(positions)
  };
}
/** 在首页和选择弹层之间复用同一个粒子渲染器。 */
function SystemScenePreview({
  activeScene,
  host,
  framing = "home",
  active = true,
  onRootReady,
  onStatus
}) {
  const rootRef = useRef(null);
  const statusRef = useRef(onStatus);
  const hostBridgeRef = useRef(null);
  useEffect(() => { statusRef.current = onStatus; }, [onStatus]);
  const onRootReadyRef = useRef(onRootReady);
  const activeSceneRef = useRef(activeScene);
  const framingRef = useRef(framing);
  const activeRef = useRef(active);
  activeRef.current = active;
  if (rootRef.current === null && typeof document !== "undefined") {
    const root = document.createElement("div");
    root.className = "system-scene-particle-root";
    root.setAttribute("aria-hidden", "true");
    rootRef.current = root;
  }
  useEffect(() => {
    onRootReadyRef.current = onRootReady;
  }, [onRootReady]);
  useLayoutEffect(() => {
    hostBridgeRef.current = createSceneHostBridge(rootRef.current);
    return () => hostBridgeRef.current.dispose();
  }, []);
  useLayoutEffect(() => { hostBridgeRef.current.move(host); }, [host]);
  useEffect(() => {
    activeSceneRef.current = activeScene;
  }, [activeScene]);
  useEffect(() => {
    framingRef.current = framing;
  }, [framing]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    onRootReadyRef.current?.(root);
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(330002, 6, 22);
    const camera = new THREE.PerspectiveCamera(
      34,
      root.clientWidth / Math.max(root.clientHeight, 1),
      0.1,
      70
    );
    camera.position.set(0, 0.25, 8.15);
    const cameraLookAt = new THREE.Vector3(0, 0.25, 0);
    const cameraDesiredPosition = new THREE.Vector3();
    const cameraDesiredLookAt = new THREE.Vector3();
    const morphCenter = new THREE.Vector3();
    camera.lookAt(cameraLookAt);
    /** 仅在预览状态变化时通知 React，避免逐帧刷新页面。 */
    const reportStatus = (state, key) => {
      if (root.dataset.modelStatus === state && root.dataset.scene === key) return;
      root.dataset.modelStatus = state;
      root.dataset.scene = key;
      statusRef.current?.({ state, key });
    };
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      reportStatus('unavailable', activeSceneRef.current);
      return () => onRootReadyRef.current?.(null);
    }
    /** 限制背板像素倍率；容器尺寸独立于 Canvas 像素数。 */
    const updatePixelRatio = () => {
      const compactOrCoarse = window.matchMedia(
        "(max-width: 820px), (pointer: coarse)"
      ).matches;
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, compactOrCoarse ? 1.2 : 1.5)
      );
    };
    updatePixelRatio();
    renderer.setSize(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1), false);
    renderer.setClearColor(0, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    root.appendChild(renderer.domElement);
    const reduceMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    let reduceMotion = reduceMotionQuery.matches;
    /** 响应系统减少动画设置。 */
    const handleMotionPreference = (event) => {
      reduceMotion = event.matches;
      if (reduceMotion) {
        cameraBridge = null;
        camera.clearViewOffset();
      }
    };
    reduceMotionQuery.addEventListener("change", handleMotionPreference);
    const texture = createParticleTexture();
    const ambientDustGeometry = new THREE.BufferGeometry();
    ambientDustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(createAmbientDustPositions(), 3)
    );
    const ambientDustMaterial = new THREE.PointsMaterial({
      size: 0.052,
      map: texture,
      color: "#72c7ff",
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true
    });
    const ambientDust = new THREE.Points(
      ambientDustGeometry,
      ambientDustMaterial
    );
    ambientDust.frustumCulled = false;
    scene.add(ambientDust);
    const motionClock = createSceneMotionClock();
    let returningMotion = false;
    /** 后台 RAF 可能完全停发，必须在隐藏事件中丢弃间隔，不能等下一帧才判断。 */
    const pauseHiddenMotion = () => { if (document.hidden) motionClock.pause(); };
    document.addEventListener('visibilitychange', pauseHiddenMotion);
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const loadingTarget = createLoadingTarget();
    const targetMap = /* @__PURE__ */ new Map();
    const pendingTargets = /* @__PURE__ */ new Map();
    const failedTargets = /* @__PURE__ */ new Set();
    const livePositions = new Float32Array(loadingTarget.positions);
    const renderPositions = new Float32Array(loadingTarget.positions);
    const liveColors = new Float32Array(loadingTarget.colors);
    const noiseSeeds = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * Math.PI * 2)
    );
    const revealJitter = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * 0.12)
    );
    let currentTarget = loadingTarget;
    let fromTarget = loadingTarget;
    let toTarget = loadingTarget;
    let transitionProgress = 1;
    const mushroomIntro = createMushroomIntro();
    let sweepDirection = 1;
    let cameraBridge = null;
    let cameraCapture = null;
    let animationFrame = 0;
    let disposed = false;
    /** 把跨容器切换转换为连续镜头过渡。 */
    const handleCameraFramingTransition = (event) => {
      const { detail } = event;
      if (!detail) return;
      framingRef.current = detail.framing;
      if (reduceMotion) {
        cameraBridge = null;
        camera.clearViewOffset();
        return;
      }
      const capture = cameraCapture;
      const fromHeight = Math.max(capture?.height ?? detail.from.height, 1);
      const toWidth = Math.max(detail.to.width, 1);
      const toHeight = Math.max(detail.to.height, 1);
      const currentFov = THREE.MathUtils.degToRad(capture?.fov ?? camera.fov);
      const compensatedFov = THREE.MathUtils.radToDeg(
        2 * Math.atan(toHeight / fromHeight * Math.tan(currentFov * 0.5))
      );
      const startFov = THREE.MathUtils.clamp(compensatedFov, 16, 58);
      const worldCenter = new THREE.Vector3(
        ...capture?.worldCenter ?? [
          morphCenter.x,
          morphCenter.y,
          morphCenter.z
        ]
      );
      camera.clearViewOffset();
      camera.aspect = toWidth / toHeight;
      camera.fov = startFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const projectedCenter = worldCenter.clone().project(camera);
      const projectedScreenX = detail.to.x + (projectedCenter.x + 1) * 0.5 * toWidth;
      const projectedScreenY = detail.to.y + (1 - projectedCenter.y) * 0.5 * toHeight;
      const capturedScreenX = capture?.screenX ?? detail.from.x + detail.from.width * 0.5;
      const capturedScreenY = capture?.screenY ?? detail.from.y + detail.from.height * 0.5;
      cameraBridge = {
        elapsed: 0,
        duration: detail.duration ?? 1.08,
        startFov,
        startViewOffsetX: projectedScreenX - capturedScreenX,
        startViewOffsetY: projectedScreenY - capturedScreenY
      };
      cameraCapture = null;
      camera.fov = cameraBridge.startFov;
      camera.setViewOffset(
        toWidth,
        toHeight,
        cameraBridge.startViewOffsetX,
        cameraBridge.startViewOffsetY,
        toWidth,
        toHeight
      );
    };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(renderPositions, 3)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(liveColors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.078,
      map: texture,
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    /** 把当前实际显示的点位交给原生点图作为形变起点，不读取传感数据。 */
    const capturePresentation = (event) => {
      // ⚠️ 返回途中预览仍不可见；由同一交接帧驱动它并捕获新落点，避免露出两团点云。
      if (event.detail.resumeProgress !== undefined && !activeRef.current && !reduceMotion && !document.hidden) {
        if (!returningMotion) motionClock.pause();
        returningMotion = true;
        renderFrame(motionClock.advance(performance.now(), returnMotionSpeed(event.detail.resumeProgress)));
      }
      event.detail.snapshot = captureParticleProjection(points, camera, root.getBoundingClientRect());
      if (event.detail.snapshot && currentTarget.grid && transitionProgress >= 1) event.detail.snapshot.grid = currentTarget.grid;
    };
    root.addEventListener('system-scene:capture-particles', capturePresentation);
    /** 捕获切换前模型在屏幕中的位置。 */
    const handleCameraFramingCapture = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      points.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const worldCenter = new THREE.Vector3(
        morphCenter.x,
        morphCenter.y,
        morphCenter.z
      );
      points.localToWorld(worldCenter);
      const projectedCenter = worldCenter.clone().project(camera);
      cameraCapture = {
        screenX: rect.x + (projectedCenter.x + 1) * 0.5 * rect.width,
        screenY: rect.y + (1 - projectedCenter.y) * 0.5 * rect.height,
        height: rect.height,
        fov: camera.fov,
        worldCenter: [worldCenter.x, worldCenter.y, worldCenter.z]
      };
    };
    root.addEventListener(
      CAMERA_FRAMING_CAPTURE_EVENT,
      handleCameraFramingCapture
    );
    root.addEventListener(CAMERA_FRAMING_EVENT, handleCameraFramingTransition);
    const haloGeometry = new THREE.RingGeometry(1.72, 1.75, 160);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: "#1d9fff",
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -1.12;
    scene.add(halo);
    const ambient = new THREE.AmbientLight(16777215, 0.24);
    scene.add(ambient);
    const keyLight = new THREE.PointLight(8246268, 4.2, 16, 2);
    keyLight.position.set(-2.6, 2.4, 4.8);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(3718648, 2.6, 14, 2);
    accentLight.position.set(2.4, -0.8, 3.4);
    scene.add(accentLight);
    /** 开始模型之间的粒子扫掠变形。 */
    const beginTransition = (target) => {
      if (target === toTarget && transitionProgress < 1) return;
      if (target === currentTarget && transitionProgress >= 1) return;
      // ⚠️ 快速连续选择时从当前点位开始，否则模型会跳回上一次完整形态。
      fromTarget = { ...currentTarget, positions: new Float32Array(livePositions),
        colors: new Float32Array(liveColors), center: getTargetCenter(livePositions) };
      toTarget = target;
      transitionProgress = 0;
      sweepDirection = sweepDirection === 1 ? -1 : 1;
    };
    /** 按稳定宿主尺寸同步重绘，避免旧横纵比或清空的背板闪过一帧。 */
    const onResize = () => {
      const width = Math.max(root.clientWidth, 1);
      const height = Math.max(root.clientHeight, 1);
      updatePixelRatio();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(root);
    window.addEventListener("resize", onResize);
    root.addEventListener('system-scene:viewport-resize', onResize);
    /** 按需加载并缓存粒子目标，失败不阻断进入真实系统。 */
    const ensureTarget = (key) => {
      if (targetMap.has(key) || pendingTargets.has(key) || failedTargets.has(key)) {
        return;
      }
      const layout = createLayoutPositions(key);
      if (layout) {
        targetMap.set(key, createLayoutTarget(key, layout));
        return;
      }
      const spec = MODEL_SPECS.find((candidate) => candidate.key === key);
      if (!spec && key !== 'foot') return;
      const loading = key === 'foot' ? loadFootLayout(PARTICLE_COUNT).then((foot) => createLayoutTarget(key, foot))
        : loadModel(spec, gltfLoader, fbxLoader).then(({ root: rootObject, spec: loadedSpec }) => {
        try {
          if (!disposed) return sampleTarget(rootObject, loadedSpec);
        } finally { disposeModel(rootObject); }
      });
      const request = loading.then((target) => { if (!disposed) targetMap.set(key, target); }).catch((error) => {
        if (disposed) return;
        failedTargets.add(key);
        console.warn(`Failed to load preview model ${spec?.label || key}`, error);
      }).finally(() => {
        pendingTargets.delete(key);
      });
      pendingTargets.set(key, request);
    };
    ensureTarget("shroom");
    let lastReducedMotionFrame = 0;
    /** 点位、镜头和浮动共用同一相位；可见预览与隐藏的返回落点不重复推进。 */
    const renderFrame = ({ delta: frameTime, elapsed }) => {
      const delta = Math.min(frameTime, .1);
      ensureTarget(activeSceneRef.current);
      const requestedScene = mushroomIntro.select(activeSceneRef.current, {
        elapsed, complete: currentTarget.key === 'shroom' && transitionProgress >= 1,
        reducedMotion: reduceMotion, failed: failedTargets.has('shroom'),
      });
      const requestedTarget = targetMap.get(requestedScene);
      points.visible = !failedTargets.has(activeSceneRef.current);
      if (requestedTarget && requestedTarget !== toTarget) {
        beginTransition(requestedTarget);
      }
      if (transitionProgress < 1) {
        transitionProgress = advanceMorph(transitionProgress, frameTime, reduceMotion);
        if (transitionProgress >= 1) {
          currentTarget = toTarget;

        }
      }
      const easedProgress = smoothstep(0, 1, transitionProgress);
      const followStrength = frameFollowStrength(transitionProgress < 1 ? 0.088 : 0.055, frameTime, reduceMotion);
      const colorStrength = frameFollowStrength(0.08, frameTime, reduceMotion);
      let settlingDistance = 0;
      for (let index = 0; index < livePositions.length; index += 3) {
        const pointIndex = index / 3;
        const revealWeight = toTarget.sweepWeights[pointIndex];
        const localProgress = sweepProgress(transitionProgress, revealWeight, revealJitter[pointIndex], sweepDirection);
        const targetX = THREE.MathUtils.lerp(
          fromTarget.positions[index],
          toTarget.positions[index],
          localProgress
        );
        const targetY = THREE.MathUtils.lerp(
          fromTarget.positions[index + 1],
          toTarget.positions[index + 1],
          localProgress
        );
        const targetZ = THREE.MathUtils.lerp(
          fromTarget.positions[index + 2],
          toTarget.positions[index + 2],
          localProgress
        );
        livePositions[index] = THREE.MathUtils.lerp(livePositions[index], targetX, followStrength);
        livePositions[index + 1] = THREE.MathUtils.lerp(livePositions[index + 1], targetY, followStrength);
        livePositions[index + 2] = THREE.MathUtils.lerp(livePositions[index + 2], targetZ, followStrength);
        settlingDistance = Math.max(settlingDistance, Math.abs(livePositions[index] - targetX),
          Math.abs(livePositions[index + 1] - targetY), Math.abs(livePositions[index + 2] - targetZ));
        renderPositions[index] = livePositions[index] + (reduceMotion ? 0 : Math.sin(elapsed * 1.25 + noiseSeeds[pointIndex]) * 0.012);
        renderPositions[index + 1] = livePositions[index + 1] + (reduceMotion ? 0 : Math.cos(elapsed * 1.55 + noiseSeeds[pointIndex]) * 0.01);
        renderPositions[index + 2] = livePositions[index + 2] + (reduceMotion ? 0 : Math.sin(elapsed * 1.05 + noiseSeeds[pointIndex]) * 0.012);
        liveColors[index] = THREE.MathUtils.lerp(
          liveColors[index],
          toTarget.colors[index],
          colorStrength
        );
        liveColors[index + 1] = THREE.MathUtils.lerp(
          liveColors[index + 1],
          toTarget.colors[index + 1],
          colorStrength
        );
        liveColors[index + 2] = THREE.MathUtils.lerp(
          liveColors[index + 2],
          toTarget.colors[index + 2],
          colorStrength
        );
      }
      points.rotation.y = reduceMotion ? 0 : Math.sin(elapsed * 0.22) * 0.06 + (activeSceneRef.current === "robot" ? -0.08 : 0.08);
      points.rotation.x = reduceMotion ? -0.08 : -0.08 + Math.cos(elapsed * 0.18) * 0.025;
      morphCenter.set(
        THREE.MathUtils.lerp(
          fromTarget.center[0],
          toTarget.center[0],
          easedProgress
        ),
        THREE.MathUtils.lerp(
          fromTarget.center[1],
          toTarget.center[1],
          easedProgress
        ),
        THREE.MathUtils.lerp(
          fromTarget.center[2],
          toTarget.center[2],
          easedProgress
        )
      );
      const framingMode = framingRef.current;
      root.dataset.framing = framingMode;
      let framingComplete = false;
      const homeFraming = framingMode === "home";
      const previewFraming = framingMode === "preview";
      const focusedFraming = framingMode === "focused";
      const cameraEase = reduceMotion ? 1 : 1 - Math.exp(-delta * 3.2);
      const targetFov = focusedFraming ? 32.5 : homeFraming ? 35.5 : 34;
      cameraDesiredPosition.set(
        morphCenter.x + (previewFraming ? 0.28 : homeFraming ? 0.1 : 0),
        morphCenter.y + (focusedFraming ? 0.14 : previewFraming ? 0.28 : 0.18),
        morphCenter.z + (focusedFraming ? 7.92 : homeFraming ? 8.25 : 8.15)
      );
      cameraDesiredLookAt.set(
        morphCenter.x + (previewFraming ? 0.5 : homeFraming ? -1.2 : 0),
        morphCenter.y + (homeFraming ? 0.14 : 0),
        morphCenter.z
      );
      camera.position.lerp(cameraDesiredPosition, cameraEase);
      cameraLookAt.lerp(cameraDesiredLookAt, cameraEase);
      const ambientOpacity = homeFraming ? 0.22 : focusedFraming ? 0.08 : 0.12;
      ambientDustMaterial.opacity = THREE.MathUtils.lerp(
        ambientDustMaterial.opacity,
        ambientOpacity,
        reduceMotion ? 1 : 1 - Math.exp(-delta * 1.8)
      );
      if (!reduceMotion) {
        ambientDust.rotation.z = Math.sin(elapsed * 0.045) * 0.012;
        ambientDust.position.x = Math.sin(elapsed * 0.08) * 0.14;
        ambientDust.position.y = Math.cos(elapsed * 0.065) * 0.08;
      }
      if (cameraBridge) {
        cameraBridge.elapsed = Math.min(
          cameraBridge.duration,
          cameraBridge.elapsed + frameTime
        );
        const bridgeProgress = smoothstep(
          0,
          1,
          cameraBridge.elapsed / Math.max(cameraBridge.duration, 1e-3)
        );
        camera.fov = THREE.MathUtils.lerp(
          cameraBridge.startFov,
          targetFov,
          bridgeProgress
        );
        const viewportWidth = Math.max(root.clientWidth, 1);
        const viewportHeight = Math.max(root.clientHeight, 1);
        const viewOffsetX = THREE.MathUtils.lerp(
          cameraBridge.startViewOffsetX,
          0,
          bridgeProgress
        );
        const viewOffsetY = THREE.MathUtils.lerp(
          cameraBridge.startViewOffsetY,
          0,
          bridgeProgress
        );
        if (bridgeProgress < 1) {
          camera.setViewOffset(
            viewportWidth,
            viewportHeight,
            viewOffsetX,
            viewOffsetY,
            viewportWidth,
            viewportHeight
          );
        } else {
          cameraBridge = null;
          camera.clearViewOffset();
          framingComplete = true;
        }
      } else {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, cameraEase);
        if (camera.view?.enabled) camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
      camera.lookAt(cameraLookAt);
      halo.position.x = morphCenter.x;
      if (!reduceMotion) halo.rotation.z += delta * 0.18;
      haloMaterial.opacity = reduceMotion ? 0.12 : 0.12 + Math.sin(elapsed * 1.8) * 0.025;
      material.size = reduceMotion ? 0.07 : 0.07 + Math.sin(elapsed * 2.1) * 4e-3;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
      root.dataset.morphPhase = transitionProgress < 1 ? 'sweeping' : settlingDistance > 0.008 ? 'settling' : 'settled';
      if (framingComplete) root.dispatchEvent(new Event('system-scene:framing-complete'));
      const modelState = failedTargets.has(activeSceneRef.current) ? 'error'
        : requestedTarget && currentTarget.key === activeSceneRef.current && transitionProgress >= 1 && settlingDistance <= 0.008 ? 'ready' : requestedTarget ? 'morphing' : 'loading';
      reportStatus(modelState, activeSceneRef.current);
    };
    /** 隐藏时暂停；返回已预热的相位直接交还 RAF，不重新计时或追赶暂停间隔。 */
    const animate = (timestamp) => {
      animationFrame = requestAnimationFrame(animate);
      if (disposed || document.hidden) { motionClock.pause(); return; }
      if (!activeRef.current) { if (!returningMotion) motionClock.pause(); return; }
      returningMotion = false;
      if (reduceMotion && timestamp - lastReducedMotionFrame < 250) return;
      if (reduceMotion) lastReducedMotionFrame = timestamp;
      renderFrame(motionClock.advance(performance.now()));
    };
    animationFrame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      onRootReadyRef.current?.(null);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      root.removeEventListener('system-scene:viewport-resize', onResize);
      root.removeEventListener(
        CAMERA_FRAMING_EVENT,
        handleCameraFramingTransition
      );
      root.removeEventListener(
        CAMERA_FRAMING_CAPTURE_EVENT,
        handleCameraFramingCapture
      );
      reduceMotionQuery.removeEventListener("change", handleMotionPreference);
      document.removeEventListener('visibilitychange', pauseHiddenMotion);
      cancelAnimationFrame(animationFrame);
      root.removeEventListener('system-scene:capture-particles', capturePresentation);
      renderer.forceContextLoss();
      geometry.dispose();
      material.dispose();
      ambientDustGeometry.dispose();
      ambientDustMaterial.dispose();
      texture.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (root.contains(renderer.domElement)) {
        root.removeChild(renderer.domElement);
      }
    };
  }, []);
  return null;
}
export {
  SystemScenePreview as default
};
