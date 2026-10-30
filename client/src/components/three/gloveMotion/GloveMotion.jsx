import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMotionOrientation, resetMotionOrientation, updateMotionOrientation } from './motionOrientation';
import { createMotionCalibration, resolveMotionBends, updateMotionCalibration } from './motionCalibration';
import { createWorkspaceViewTools } from '../../../renderers/workspaceViewTools';
import './gloveMotion.css';

const MODEL_URL = './glove-motion/hand.glb';
const REGION_URL = './glove-motion/regions.json';
const SIDES = ['left', 'right'];
const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FINGER_CHAINS = [
  ['Finger_01', 'Finger_02'],
  ['Finger_10', 'Finger_11', 'Finger_12'],
  ['Finger_20', 'Finger_21', 'Finger_22'],
  ['Finger_30', 'Finger_31', 'Finger_32'],
  ['Finger_40', 'Finger_41', 'Finger_42'],
];
const REGION_COLORS = { palm: 0x00ff00, thumb: 0xff0000, index: 0xffff00,
  middle: 0xff00ff, ring: 0x0088ff, pinky: 0xff8800 };
const FINGER_BONES = new Set(FINGER_CHAINS.flat());
const CAMERA_DIRECTION = new THREE.Vector3(0, 3, -1).normalize();
const CAMERA_UP = new THREE.Vector3(0, 1 / Math.sqrt(10), 3 / Math.sqrt(10));

/** 限制展示用数值，不改写输入帧。 */
function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}

/** 复制当前侧的压力和姿态；空帧会清空压力，避免换手时借用另一侧读数。 */
function normalizeFrame(frame) {
  const pressure = Array.isArray(frame?.pressure) ? frame.pressure.map((value) => Math.max(0, Number(value) || 0)) : [];
  const quaternion = Array.isArray(frame?.quaternion) && frame.quaternion.length === 4
    && frame.quaternion.every((value) => Number.isFinite(value)) && Math.hypot(...frame.quaternion) > 0.000001
    ? [...frame.quaternion] : null;
  return { pressure, quaternion, fingers: Array.isArray(frame?.fingers) ? frame.fingers.slice(0, 5).map((value) => clamp(value)) : [0, 0, 0, 0, 0],
    total: pressure.reduce((sum, value) => sum + value, 0) };
}

/** 147点布局按五指和手掌求展示强度；其他点表仅使用整体压力亮度。 */
function regionLevels(pressure) {
  const average = pressure.length ? pressure.reduce((sum, value) => sum + value, 0) / pressure.length : 0;
  const levels = Object.fromEntries(Object.keys(REGION_COLORS).map((key) => [key, average]));
  if (pressure.length !== 147) return levels;
  FINGER_KEYS.forEach((key, finger) => {
    let sum = 0;
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 3; col += 1) sum += pressure[row * 15 + finger * 3 + col] || 0;
    }
    levels[key] = sum / 15;
  });
  levels.palm = pressure.slice(75).reduce((sum, value) => sum + value, 0) / 72;
  return levels;
}

/** 释放独立场景的几何、材质和纹理，包括迟到加载的模型。 */
function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
    });
    child.skeleton?.boneTexture?.dispose();
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

/** 读取蒙皮后的实际顶点边界，普通Box3忽略骨骼变形会导致手模偏移和裁切。 */
function skinnedBounds(model) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    child.skeleton?.update();
    const positions = child.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 4) {
      point.fromBufferAttribute(positions, index);
      if (child.isSkinnedMesh) child.boneTransform(index, point);
      box.expandByPoint(point.applyMatrix4(child.matrixWorld));
    }
  });
  return box;
}

/** 与3D遥操共用平铺骨骼和安装朝向，线网只改变材质，不另起初始姿势。 */
function setInitialPose(model) {
  model.traverse((child) => { if (child.isBone && FINGER_BONES.has(child.name)) child.rotation.z = 0; });
}

/** 按3D遥操的安装方向归一化，并以真实蒙皮边界计算手背支点和居中。 */
function normalizeModel(model) {
  const box = skinnedBounds(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const pivot = new THREE.Vector3(center.x, box.min.y + size.y * 0.88, center.z);
  model.scale.setScalar(7.4 / (Math.max(size.x, size.y, size.z) || 1));
  model.rotation.set(Math.PI / 6, 0, -Math.PI);
  model.updateMatrixWorld(true);
  model.position.sub(pivot.applyMatrix4(model.matrixWorld));
  model.updateMatrixWorld(true);
  const result = skinnedBounds(model);
  return { offset: result.getCenter(new THREE.Vector3()).negate(), size: result.getSize(new THREE.Vector3()) };
}

/** 保留原线网和蒙皮，将可编辑手区转换为无光照依赖的顶点色。 */
function prepareModel(model, regions) {
  const bones = new Map();
  let regionMesh = null;
  model.traverse((child) => {
    if (child.isBone) bones.set(child.name, { bone: child, rotation: child.rotation.clone() });
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    child.frustumCulled = false;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    oldMaterials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
      material.dispose();
    });
    child.material = new THREE.MeshBasicMaterial({ color: 0x6dfaff, side: THREE.DoubleSide, skinning: child.isSkinnedMesh, toneMapped: false });
    if (!regionMesh || child.geometry.attributes.position.count > regionMesh.geometry.attributes.position.count) regionMesh = child;
  });
  if (!regionMesh) return { bones, color: null, regions: [] };
  const count = regionMesh.geometry.attributes.position.count;
  const color = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  const cyan = new THREE.Color(0x6dfaff);
  for (let index = 0; index < count; index += 1) color.setXYZ(index, cyan.r * 0.5, cyan.g * 0.5, cyan.b * 0.5);
  regionMesh.geometry.setAttribute('color', color);
  regionMesh.material.color.set(0xffffff);
  regionMesh.material.vertexColors = true;
  regionMesh.material.needsUpdate = true;
  const verticesPerLine = regions.verticesPerLine || 8;
  const bindings = (regions.regions || []).filter((region) => region.editable && REGION_COLORS[region.key]).map((region) => ({
    key: region.key, color: new THREE.Color(REGION_COLORS[region.key]),
    vertices: region.lineIndices.flatMap((line) => Array.from({ length: verticesPerLine }, (_, offset) => line * verticesPerLine + offset)).filter((index) => index < count),
  }));
  return { bones, color, regions: bindings };
}

/** 每帧只更新收到压力的手区颜色，区域色保持参考motion的六种色相。 */
function updatePressure(rig, pressure) {
  if (!rig.color) return;
  const levels = regionLevels(pressure);
  rig.regions.forEach((region) => {
    const brightness = 0.7 + clamp(levels[region.key] / 255) * 0.3;
    region.vertices.forEach((index) => rig.color.setXYZ(index,
      region.color.r * brightness, region.color.g * brightness, region.color.b * brightness));
  });
  rig.color.needsUpdate = true;
}

/** 构建单个显示生命周期，真实帧通过updateFrame更新，不创建串口或模拟帧。 */
function createMotionScene(mount, state) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.dataset.gloveRenderer = 'motion';
  renderer.domElement.dataset.modelState = 'loading';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '炫酷摇操触觉手套线网');
  mount.appendChild(renderer.domElement);
  const status = document.createElement('div');
  status.className = 'glove-motion-status';
  status.setAttribute('role', 'status');
  status.textContent = '正在加载触觉手套线网…';
  mount.appendChild(status);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 90;
  const view = new THREE.Group();
  scene.add(view);
  const grid = new THREE.GridHelper(13, 32, 0x1edee6, 0x123b4b);
  grid.position.y = -3.9;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  scene.add(grid);
  const rigs = Object.fromEntries(SIDES.map((side) => {
    const position = new THREE.Group();
    const mirror = new THREE.Group();
    const gyro = new THREE.Group();
    position.add(gyro); gyro.add(mirror); view.add(position);
    mirror.scale.x = side === 'left' ? 1 : -1;
    return [side, { side, position, mirror, gyro, ready: false, bones: new Map(), bend: [0, 0, 0, 0, 0],
      targetBend: [0, 0, 0, 0, 0], targetQuaternion: state.orientations[side].target }];
  }));
  const clock = new THREE.Clock();
  let disposed = false;
  let frameId;
  let userView = false;
  let framingDistance = 15;
  /** 手动操作后保留用户镜头，模型迟到或侧栏尺寸变化不再覆盖。 */
  const markUserView = () => { userView = true; };
  controls.addEventListener('start', markUserView);

  /** 按当前可见手数摆放，不将缺失手帧复制到另一侧。 */
  function configure() {
    SIDES.forEach((side) => {
      const rig = rigs[side];
      rig.position.visible = state.dual || (state.hand ? side === 'left' : side === 'right');
      rig.position.position.set(state.dual ? (side === 'left' ? 1.9 : -1.9) : 0, 0, 0);
      rig.position.scale.setScalar(state.dual ? 0.52 : 0.8);
    });
  }

  /** 根据容器更新相机和像素尺寸，侧栏收起也能保持画布比例。 */
  function resize() {
    if (disposed) return;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const root = mount.closest('.portal-runtime-monitor');
    const mountBox = mount.getBoundingClientRect();
    const leftPanel = root?.querySelector('.portal-observatory')?.getBoundingClientRect();
    const rightPanel = root?.querySelector('.portal-monitor-tools-rail')?.getBoundingClientRect();
    const leftEdge = width > 820 && leftPanel ? Math.max(0, leftPanel.right - mountBox.left) : 0;
    const rightEdge = width > 820 && rightPanel ? Math.min(width, rightPanel.left - mountBox.left) : width;
    const centralRatio = Math.max(.25, (rightEdge - leftEdge - 32) / width);
    const scale = state.dual ? .52 : .8;
    const modelWidth = Math.max(...SIDES.map((side) => rigs[side].modelSize?.x || 7.4));
    const modelHeight = Math.max(...SIDES.map((side) => {
      const size = rigs[side].modelSize;
      return size ? size.y * CAMERA_UP.y + size.z * CAMERA_UP.z : 7.4;
    }));
    const contentWidth = modelWidth * scale + (state.dual ? 3.8 : 0);
    framingDistance = Math.max(12, modelHeight * scale / (2 * Math.tan(Math.PI / 9)),
      contentWidth / (2 * Math.tan(Math.PI / 9) * camera.aspect * centralRatio)) * 1.12;
    if (!userView) {
      camera.position.copy(CAMERA_DIRECTION).multiplyScalar(framingDistance);
      controls.target.set(0, 0, 0);
    }
    camera.updateProjectionMatrix();
    configure();
  }

  /** 标记本侧的最新帧，动画帧内只消费一次，异步加载期间也保留末值。 */
  function applyFrame(side) {
    const rig = rigs[side];
    if (rig.ready && state.frames[side]) rig.dirty = true;
  }

  /** 发布可供回归测试读取的小型诊断，不暴露Three对象。 */
  function getSnapshot() {
    return { mode: 'gloveMotion', ready: SIDES.every((side) => rigs[side].ready), dual: state.dual,
      calibration: { active: state.calibration.active, side: state.calibration.side, pose: state.calibration.pose },
      camera: { fov: camera.fov, direction: camera.position.clone().sub(controls.target).normalize().toArray() },
      side: state.hand ? 'left' : 'right', hands: Object.fromEntries(SIDES.map((side) => [side, {
        received: state.received[side], pressureTotal: state.frames[side]?.total || 0,
        ready: rigs[side].ready, visible: rigs[side].position.visible,
        mirrorScaleX: rigs[side].mirror.scale.x,
        hasQuaternion: Boolean(state.orientations[side].latest), zeroPending: !state.orientations[side].neutral,
        quaternionResets: state.orientations[side].resets,
        preview: state.calibration.active && state.calibration.side === side && state.frames[side]?.pressure.length !== 195,
        targetFingers: [...resolveMotionBends(state.calibration, side, state.frames[side])],
        latestFingers: [...(state.frames[side]?.fingers || [0, 0, 0, 0, 0])],
        quaternion: rigs[side].gyro.quaternion.toArray(), fingers: [...rigs[side].bend],
      }])) };
  }

  /** 只在收到帧时更新测试属性，不在动画循环内写入DOM。 */
  function updateFrame(frame) {
    const side = frame.side === 'right' ? 'right' : 'left';
    state.frames[side] = normalizeFrame(frame);
    updateMotionOrientation(state.orientations[side], state.frames[side].quaternion);
    state.received[side] += 1;
    renderer.domElement.dataset[side === 'left' ? 'receivedLeft' : 'receivedRight'] = String(state.received[side]);
    renderer.domElement.dataset[side === 'left' ? 'pressureTotalLeft' : 'pressureTotalRight'] = String(state.frames[side].total);
    applyFrame(side);
  }

  /** 立即归位指定侧；硬件初始化等待该侧新基准，软件置零沿用最新读数。 */
  function resetQuaternion(side, options) {
    const targetSide = SIDES.includes(side) ? side : state.hand ? 'left' : 'right';
    resetMotionOrientation(state.orientations[targetSide], options);
    rigs[targetSide].gyro.quaternion.identity();
    rigs[targetSide].gyro.updateMatrixWorld(true);
    renderer.render(scene, camera);
  }

  /** 按3D遥操的骨骼绝对Z角应用五指姿态，不触及四元数或安装变换。 */
  function applyFingerPose(rig) {
    FINGER_CHAINS.forEach((chain, finger) => chain.forEach((name) => {
      const bone = rig.bones.get(name);
      if (bone) bone.bone.rotation.set(bone.rotation.x, bone.rotation.y, -Math.PI / 2 * rig.bend[finger], bone.rotation.order);
    }));
  }

  /** 选侧/姿态或弹窗状态改变时立即恢复旧侧和显示新侧，实时缓存保持不动。 */
  function syncCalibration(previousSide) {
    new Set([previousSide, state.calibration.active ? state.calibration.side : null]).forEach((side) => {
      const rig = rigs[side];
      if (!rig?.ready) return;
      const bends = resolveMotionBends(state.calibration, side, state.frames[side]);
      rig.bend = [...bends];
      applyFingerPose(rig);
      rig.gyro.updateMatrixWorld(true);
    });
    renderer.render(scene, camera);
  }

  /** 绘制平滑姿态与骨骼，空输入保持静止，不启动参考项目的模拟动作。 */
  function animate() {
    if (disposed) return;
    const smoothing = 1 - Math.exp(-Math.min(clock.getDelta(), 0.05) * 18);
    SIDES.forEach((side) => {
      const rig = rigs[side];
      if (!rig.ready) return;
      if (rig.dirty) {
        const frame = state.frames[side];
        updatePressure(rig, frame.pressure);
        rig.dirty = false;
      }
      rig.targetBend = resolveMotionBends(state.calibration, side, state.frames[side]);
      rig.gyro.quaternion.slerp(rig.targetQuaternion, smoothing);
      FINGER_CHAINS.forEach((_chain, finger) => {
        rig.bend[finger] += ((rig.targetBend[finger] || 0) - rig.bend[finger]) * smoothing;
      });
      applyFingerPose(rig);
    });
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }

  const abort = new AbortController();
  fetch(REGION_URL, { signal: abort.signal }).then((response) => {
    if (!response.ok) throw new Error('motion region asset unavailable');
    return response.json();
  }).then((regions) => {
    if (disposed) return;
    const loader = new GLTFLoader();
    SIDES.forEach((side) => loader.load(MODEL_URL, (gltf) => {
      if (disposed) { disposeObject(gltf.scene); return; }
      const rig = rigs[side];
      setInitialPose(gltf.scene);
      const normalized = normalizeModel(gltf.scene);
      rig.gyro.position.copy(normalized.offset);
      rig.gyro.position.x *= rig.mirror.scale.x;
      rig.modelSize = normalized.size;
      Object.assign(rig, prepareModel(gltf.scene, regions));
      rig.mirror.add(gltf.scene);
      rig.ready = true;
      updatePressure(rig, []);
      applyFrame(side);
      resize();
      renderer.domElement.dataset.modelState = SIDES.every((key) => rigs[key].ready) ? 'ready' : 'loading';
      if (renderer.domElement.dataset.modelState === 'ready') status.remove();
    }, undefined, () => {
      if (!disposed) {
        renderer.domElement.dataset.modelState = 'error';
        status.textContent = '炫酷摇操模型加载失败，请切换显示方式后重试。';
      }
    }));
  }).catch((error) => {
    if (!disposed && error.name !== 'AbortError') {
      renderer.domElement.dataset.modelState = 'error';
      status.textContent = '炫酷摇操区域资源加载失败，请切换显示方式后重试。';
    }
  });
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();
  animate();
  const viewTools = createWorkspaceViewTools({ object: view, camera, controls });

  /** 恢复画布视角，不改变设备姿态或校准基准。 */
  function resetView() {
    if (disposed) return false;
    viewTools.reset(); userView = false;
    camera.position.copy(CAMERA_DIRECTION).multiplyScalar(framingDistance);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    controls.update(); viewTools.notifyChange(); return true;
  }

  const tools = {
    ...viewTools,
    /** 手套姿态由设备驱动，不对外提供平面框选。 */
    getState: () => ({ ...viewTools.getState(), selectionSafe: false }),
    /** 有效恢复后锁定展示镜头，后续模型加载不会改回自动构图。 */
    restoreSnapshot(snapshot) { const restored = viewTools.restoreSnapshot(snapshot); if (restored) userView = true; return restored; },
    /** 工具旋转只调整展示父组，不写入左右手设备四元数。 */
    rotate(axis, direction) { const changed = viewTools.rotate(axis, direction); if (changed) userView = true; return changed; },
    /** 沿现有手套俯视方向定位，并保存用户选择。 */
    top() {
      if (disposed) return false;
      userView = true; camera.position.set(0, 15, 0.01); controls.target.set(0, 0, 0);
      controls.update(); viewTools.notifyChange(); return true;
    },
    /** 保留手套原有的七至九十距离范围。 */
    zoom(direction) {
      if (disposed || !Number.isFinite(direction)) return false;
      userView = true;
      camera.position.sub(controls.target).multiplyScalar(direction > 0 ? 0.85 : 1 / 0.85).clampLength(7, 90).add(controls.target);
      controls.update(); viewTools.notifyChange(); return true;
    },
    /** 镜像仅作用于展示父组，沿用共同快照中的镜像状态。 */
    flip(axis) { const changed = viewTools.flip(axis); if (changed) userView = true; return changed; },
    reset: resetView,
  };

  return { updateFrame, resetQuaternion, syncCalibration, configure, getSnapshot, tools,
    /** 取消帧循环与待加载回调，并释放本场景全部GPU资源。 */
    dispose() {
      viewTools.dispose();
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.removeEventListener('start', markUserView); controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      status.remove();
    } };
}

/** 将motion彩色骨骼线网接入现有手套帧，不拥有连接、采集或回放状态。 */
const GloveMotion = forwardRef(function GloveMotion({ hand = true, dual = false }, ref) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const stateRef = useRef({ hand, dual, frames: { left: null, right: null }, received: { left: 0, right: 0 },
    calibration: createMotionCalibration(),
    orientations: { left: createMotionOrientation(), right: createMotionOrientation() } });
  stateRef.current.hand = hand;
  stateRef.current.dual = dual;

  /** 加载前后均透传分侧置零策略，避免硬件初始化继续使用旧设备基准。 */
  const resetQuaternion = (side, options) => {
    if (engineRef.current) engineRef.current.resetQuaternion(side, options);
    else {
      const targetSide = SIDES.includes(side) ? side : stateRef.current.hand ? 'left' : 'right';
      resetMotionOrientation(stateRef.current.orientations[targetSide], options);
    }
  };

  /** 显式同步单侧预览；关闭后立即回到该侧最新实时或重新校准的弯指值。 */
  const setCalibration = (update) => {
    const previous = stateRef.current.calibration;
    stateRef.current.calibration = updateMotionCalibration(previous, update);
    engineRef.current?.syncCalibration(previous.active ? previous.side : null);
  };
  useImperativeHandle(ref, () => ({
    updateFrame: (frame) => {
      if (engineRef.current) engineRef.current.updateFrame(frame);
      else {
        const side = frame.side === 'right' ? 'right' : 'left';
        stateRef.current.frames[side] = normalizeFrame(frame);
        updateMotionOrientation(stateRef.current.orientations[side], stateRef.current.frames[side].quaternion);
        stateRef.current.received[side] += 1;
      }
    },
    resetQuaternion,
    resetHand: resetQuaternion,
    setCalibration,
    /** 兼容旧单手/双手左侧的五指预览接口。 */
    calibration: (bends) => setCalibration({ active: true, side: stateRef.current.dual || stateRef.current.hand ? 'left' : 'right', bends }),
    /** 双手右侧预览不锁定左手的实时弯指。 */
    calibrationRight: (bends) => setCalibration({ active: true, side: 'right', bends }),
    /** 打开校准准备平铺，只覆盖目标手，不复位陀螺仪。 */
    handZero: () => setCalibration({ active: true,
      side: stateRef.current.calibration.active ? stateRef.current.calibration.side : stateRef.current.hand ? 'left' : 'right', pose: 0 }),
    changeModal: (left) => { stateRef.current.hand = left; engineRef.current?.configure(); },
    getViewTools: () => engineRef.current?.tools || null,
    getTuningControls: () => ({}),
    getSnapshot: () => engineRef.current?.getSnapshot() || { mode: 'gloveMotion', ready: false },
  }), []);
  useEffect(() => {
    engineRef.current = createMotionScene(mountRef.current, stateRef.current);
    return () => { engineRef.current?.dispose(); engineRef.current = null; };
  }, []);
  useEffect(() => { engineRef.current?.configure(); }, [hand, dual]);
  return <div ref={mountRef} className="glove-motion-renderer" aria-label="炫酷摇操画布" />;
});

export default GloveMotion;
