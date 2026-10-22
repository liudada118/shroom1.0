import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWorkspaceViewTools } from '../../../renderers/workspaceViewTools';
import { buildTerrainField, composeTerrainField, smoothTerrainField, sampleTerrainField, writeTerrainColor, TERRAIN_MESH_SIZE } from './terrainField';
import { TERRAIN_DEFAULTS, TERRAIN_BASE_GAIN_RANGE } from './terrainConfig';

const SIDES = ['left', 'right'];
const TUNING_CONTROLS = { showColor: true, showHeight: true, showGuass: false, showSize: false,
  showSpeed: false, showFilter: false, showConsis: false, showInit: true };

/** 建立一只手的可复用地形面与参考项目的疏白网格。 */
function createTerrain() {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(10, 10, TERRAIN_MESH_SIZE - 1, TERRAIN_MESH_SIZE - 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TERRAIN_MESH_SIZE ** 2 * 3), 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  group.add(mesh);
  const wirePositions = new Float32Array(32 * 31 * 2 * 2 * 3);
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.BufferAttribute(wirePositions, 3));
  wireGeometry.setDrawRange(0, 0);
  const wireMaterial = new THREE.LineBasicMaterial({ color: '#e0f0ff', opacity: .48, transparent: true, toneMapped: false });
  const wire = new THREE.LineSegments(wireGeometry, wireMaterial);
  wire.frustumCulled = false;
  group.add(wire);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: '#0d1a28', transparent: true, opacity: .85, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.045;
  group.add(floor);
  const grid = new THREE.GridHelper(12, 48, '#244158', '#152738');
  grid.position.y = -.035;
  group.add(grid);
  return { group, geometry, wireGeometry, samples: new Float32Array(TERRAIN_MESH_SIZE ** 2),
    baseSamples: new Float32Array(TERRAIN_MESH_SIZE ** 2), baseGain: null, dirty: true,
    state: { received: false, frames: 0, pressureTotal: 0, pressureMax: 0, heightMax: 0, pressureHeightMax: 0, points: 0, layout: 'empty' } };
}

/** 更新底形与压力叠加缓冲；零压力回到初始地形，不伪造统计读数。 */
function updateTerrain(terrain, frame, side, tuning) {
  const result = buildTerrainField(frame, side);
  const composed = composeTerrainField(result.field, side, tuning.baseGain);
  sampleTerrainField(smoothTerrainField(composed.field), terrain.samples);
  if (terrain.baseGain !== tuning.baseGain) {
    sampleTerrainField(smoothTerrainField(composed.base), terrain.baseSamples);
    terrain.baseGain = tuning.baseGain;
  }
  const positions = terrain.geometry.attributes.position;
  const colors = terrain.geometry.attributes.color;
  let heightMax = 0, pressureHeightMax = 0;
  for (let index = 0; index < positions.count; index++) {
    const normalized = Math.min(1, terrain.samples[index] / tuning.max);
    const height = normalized * tuning.height;
    heightMax = Math.max(heightMax, height);
    pressureHeightMax = Math.max(pressureHeightMax, height - Math.min(1, terrain.baseSamples[index] / tuning.max) * tuning.height);
    positions.setY(index, height);
    writeTerrainColor(normalized, colors.array, index * 3);
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  const wire = terrain.wireGeometry.attributes.position;
  let cursor = 0;
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      const sampleRow = Math.round(row / 31 * (TERRAIN_MESH_SIZE - 1));
      const sampleCol = Math.round(col / 31 * (TERRAIN_MESH_SIZE - 1));
      const index = sampleRow * TERRAIN_MESH_SIZE + sampleCol;
      if (terrain.samples[index] / tuning.max < .01) continue;
      for (const offset of [[0, 1], [1, 0]]) {
        const nextRow = row + offset[0], nextCol = col + offset[1];
        if (nextRow > 31 || nextCol > 31) continue;
        const nextIndex = Math.round(nextRow / 31 * (TERRAIN_MESH_SIZE - 1)) * TERRAIN_MESH_SIZE + Math.round(nextCol / 31 * (TERRAIN_MESH_SIZE - 1));
        if (terrain.samples[nextIndex] / tuning.max < .01) continue;
        for (const point of [index, nextIndex]) {
          wire.array[cursor++] = positions.getX(point);
          wire.array[cursor++] = positions.getY(point) + .022;
          wire.array[cursor++] = positions.getZ(point);
        }
      }
    }
  }
  terrain.wireGeometry.setDrawRange(0, cursor / 3);
  wire.needsUpdate = true;
  Object.assign(terrain.state, { pressureTotal: result.pressureTotal, pressureMax: result.pressureMax,
    heightMax, pressureHeightMax, points: result.points, layout: result.layout });
  terrain.dirty = false;
}

/** 将 terrain-piano 的连续热力地形接到已有手套帧，不创建串口或演示数据。 */
const GloveTerrain = React.forwardRef(function GloveTerrain({ hand = true, dual = false }, ref) {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const runtimeRef = useRef(null);
  const framesRef = useRef({ left: null, right: null });
  const layoutRef = useRef({ hand, dual });
  const tuningRef = useRef({ ...TERRAIN_DEFAULTS });
  layoutRef.current = { hand, dual };

  /** 把 latest 帧留在组件级缓存，场景挂载前收到的帧也不会丢失。 */
  const updateFrame = (frame) => {
    const side = frame?.side === 'right' ? 'right' : 'left';
    framesRef.current[side] = { ...frame,
      pressure: Array.isArray(frame?.pressure) ? [...frame.pressure] : [],
      rawPressure: Array.isArray(frame?.rawPressure) ? [...frame.rawPressure] : [] };
    const terrain = runtimeRef.current?.terrains[side];
    if (terrain) { terrain.dirty = true; terrain.state.received = true; terrain.state.frames += 1; }
  };

  /** 将色阶、高度与初始地形强度作用于显示层，保留真实压力及缓存。 */
  const setTuning = (values = {}) => {
    const maximum = Number(values.max ?? values.valuej), height = Number(values.value), initial = Number(values.valuelInit);
    if (Number.isFinite(maximum) && maximum > 0) tuningRef.current.max = maximum;
    if (Number.isFinite(height) && height > 0) tuningRef.current.height = height;
    if (Number.isFinite(initial) && initial >= 0 && initial <= TERRAIN_BASE_GAIN_RANGE.max) tuningRef.current.baseGain = initial;
    if (runtimeRef.current) SIDES.forEach((side) => { runtimeRef.current.terrains[side].dirty = true; });
  };

  useImperativeHandle(ref, () => ({
    updateFrame,
    /** 单手模式只改变可见手，另一侧缓存继续等待切回。 */
    changeModal(nextHand) { layoutRef.current = { ...layoutRef.current, hand: Boolean(nextHand) }; runtimeRef.current?.applyLayout(); },
    /** 暴露压力色阶、高度及初始地形强度调节。 */
    getTuningControls() { return { ...TUNING_CONTROLS }; },
    changeColor: setTuning, sitValue: setTuning,
    /** 工具箱与拖动缩放共用同一台真实相机。 */
    getViewTools() { return runtimeRef.current?.viewTools || null; },
    /** 返回按手隔离的数值快照，浏览器验收不接触可变场景对象。 */
    getSnapshot() {
      const runtime = runtimeRef.current;
      return { renderer: 'gloveTerrain', ready: Boolean(runtime), activeSide: layoutRef.current.dual ? 'both' : layoutRef.current.hand ? 'left' : 'right',
        left: { ...runtime?.terrains.left.state }, right: { ...runtime?.terrains.right.state },
        tuning: { ...tuningRef.current }, viewport: { ...runtime?.viewport } };
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x06111d, 0);
    renderer.domElement.dataset.renderer = 'gloveTerrain';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', '热力地图：初始地形与真实手套压力叠加');
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 400);
    camera.position.set(0, 20, 23);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.minDistance = 6;
    controls.maxDistance = 180;
    controls.maxPolarAngle = Math.PI / 2 - .015;
    const group = new THREE.Group();
    scene.add(group);
    const terrains = { left: createTerrain(), right: createTerrain() };
    SIDES.forEach((side) => group.add(terrains[side].group));
    let frameId = 0, disposed = false;
    const monitor = host.closest('.portal-runtime-monitor');

    /** 只扣除覆盖当前画布且实际可见的门户面板，隐藏图表不再占据取景空间。 */
    const availableViewport = (width, height) => {
      const bounds = host.getBoundingClientRect();
      const area = { left: 20, top: 20, right: width - 20, bottom: height - 20 };
      if (!monitor) return area;
      monitor.querySelectorAll('.portal-observatory, .portal-monitor-tools-rail, .portal-session-bar').forEach((panel) => {
        const style = window.getComputedStyle(panel), rectangle = panel.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0
          || rectangle.width <= 0 || rectangle.height <= 0 || rectangle.right <= bounds.left || rectangle.left >= bounds.right
          || rectangle.bottom <= bounds.top || rectangle.top >= bounds.bottom) return;
        const left = Math.max(0, rectangle.left - bounds.left), right = Math.min(width, rectangle.right - bounds.left);
        const top = Math.max(0, rectangle.top - bounds.top), bottom = Math.min(height, rectangle.bottom - bounds.top);
        if (rectangle.width > width * .6 || panel.classList.contains('portal-session-bar')) {
          if (top < height * .5) area.top = Math.max(area.top, bottom + 16);
          else area.bottom = Math.min(area.bottom, top - 16);
        } else if ((left + right) / 2 < width / 2) area.left = Math.max(area.left, right + 18);
        else area.right = Math.min(area.right, left - 18);
      });
      if (area.right - area.left < 80 || area.bottom - area.top < 80) return { left: 20, top: 20, right: width - 20, bottom: height - 20 };
      return area;
    };

    /** 双手按门户中央可用区域取景，并保留两个完整底板与最高压力峰。 */
    const resize = () => {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      const aspect = width / height;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      const dualLayout = layoutRef.current.dual;
      const area = dualLayout ? availableViewport(width, height) : { left: 0, top: 0, right: width, bottom: height };
      const availableWidth = Math.max(1, area.right - area.left), availableHeight = Math.max(1, area.bottom - area.top);
      if (dualLayout) camera.setViewOffset(width, height, width / 2 - (area.left + area.right) / 2,
        height / 2 - (area.top + area.bottom) / 2, width, height);
      else camera.clearViewOffset();
      const tangent = Math.tan(THREE.MathUtils.degToRad(19));
      let distance = Math.max(24, (dualLayout ? 27 : 15) / (2 * tangent * (availableWidth / height)));
      const direction = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(direction.clone().multiplyScalar(distance));
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
      if (dualLayout) {
        const corners = [];
        for (const x of [-12.3, 12.3]) for (const y of [-.05, tuningRef.current.height]) for (const z of [-6, 6]) corners.push(new THREE.Vector3(x, y, z));
        for (let attempt = 0; attempt < 18; attempt++) {
          const fits = corners.every((corner) => {
            const point = corner.clone().project(camera);
            const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
            return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
          });
          if (fits) break;
          distance *= 1.1;
          camera.position.copy(controls.target).add(direction.clone().multiplyScalar(distance));
          camera.updateMatrixWorld(true);
        }
        controls.maxDistance = Math.max(180, distance * 2);
      }
      if (runtimeRef.current) runtimeRef.current.viewport = { ...area, width: availableWidth, height: availableHeight };
      controls.update();
      controls.saveState();
    };

    /** 单手切换仅显示对应缓存地形，双手沿共同水平轴并列。 */
    const applyLayout = () => {
      const layout = layoutRef.current;
      terrains.left.group.visible = layout.dual || layout.hand;
      terrains.right.group.visible = layout.dual || !layout.hand;
      terrains.left.group.position.x = layout.dual ? -6.3 : 0;
      terrains.right.group.position.x = layout.dual ? 6.3 : 0;
      resize();
    };
    const viewTools = createWorkspaceViewTools({ object: group, camera, controls, localPlane: false });
    const runtime = { terrains, applyLayout, viewTools };
    runtimeRef.current = runtime;
    SIDES.forEach((side) => {
      if (framesRef.current[side]) { terrains[side].state.received = true; terrains[side].state.frames = 1; }
    });
    applyLayout();

    /** 每个动画帧最多消费每只手的一份最新压力，保持 GPU 缓冲固定。 */
    const render = () => {
      if (disposed) return;
      SIDES.forEach((side) => {
        if (terrains[side].dirty) updateTerrain(terrains[side], framesRef.current[side] || {}, side, tuningRef.current);
      });
      const active = layoutRef.current.dual ? SIDES : [layoutRef.current.hand ? 'left' : 'right'];
      renderer.domElement.dataset.pressureTotal = String(active.reduce((total, side) => total + terrains[side].state.pressureTotal, 0));
      renderer.domElement.dataset.heightMax = String(Math.max(...active.map((side) => terrains[side].state.heightMax)));
      renderer.domElement.dataset.activeSide = layoutRef.current.dual ? 'both' : active[0];
      renderer.domElement.dataset.ready = 'true';
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    monitor?.querySelectorAll('.portal-observatory, .portal-monitor-tools-rail, .portal-session-bar').forEach((panel) => observer.observe(panel));
    const monitorObserver = monitor ? new MutationObserver(resize) : null;
    monitorObserver?.observe(monitor, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', resize);
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      monitorObserver?.disconnect();
      window.removeEventListener('resize', resize);
      viewTools.dispose();
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, []);

  useEffect(() => { runtimeRef.current?.applyLayout(); }, [hand, dual]);

  return <div ref={hostRef} className="glove-terrain-view"
    style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 1,
      color: '#9db5c7', fontSize: 12, pointerEvents: 'none' }}>{t('gloveTerrainLayers')}</div>
  </div>;
});

export default GloveTerrain;
