import * as THREE from 'three';
import gsap from 'gsap';

/** 捕获已显示点云的屏幕坐标、颜色及像素大小，不读取或修改传感帧。 */
export function captureParticleProjection(points, camera, rect) {
  if (!points?.geometry?.attributes?.position || !rect?.width || !rect.height) return null;
  points.updateWorldMatrix(true, false);
  camera.updateMatrixWorld(true);
  const position = points.geometry.attributes.position;
  const color = points.geometry.attributes.color;
  const projected = new Float32Array(position.count * 3);
  const colors = new Float32Array(position.count * 3);
  const sizes = new Float32Array(position.count);
  const point = new THREE.Vector3();
  const view = new THREE.Vector3();
  for (let index = 0; index < position.count; index++) {
    point.fromBufferAttribute(position, index).applyMatrix4(points.matrixWorld);
    view.copy(point).applyMatrix4(camera.matrixWorldInverse);
    point.project(camera);
    projected.set([rect.x + (point.x + 1) * rect.width / 2, rect.y + (1 - point.y) * rect.height / 2, point.z], index * 3);
    colors.set(color ? [color.getX(index), color.getY(index), color.getZ(index)] : points.material.color.toArray(), index * 3);
    sizes[index] = points.material.size * (points.material.sizeAttenuation && camera.isPerspectiveCamera ? rect.height / Math.max(-2 * view.z, .001) : 1);
  }
  return projected.every(Number.isFinite) ? { positions: projected, colors, sizes } : null;
}

/** 空间排序保留邻近关系，避免按随机采样序号配对造成整团粒子交叉拉丝。 */
function spatialOrder(positions) {
  const indices = Array.from({ length: positions.length / 3 }, (_, index) => index);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const index of indices) {
    const x = positions[index * 3], y = positions[index * 3 + 1];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const keys = indices.map((index) => {
    const x = Math.round((positions[index * 3] - minX) / Math.max(maxX - minX, .001) * 1023);
    const y = Math.round((positions[index * 3 + 1] - minY) / Math.max(maxY - minY, .001) * 1023);
    let key = 0;
    for (let bit = 0; bit < 10; bit++) key |= ((x >> bit) & 1) << (2 * bit) | ((y >> bit) & 1) << (2 * bit + 1);
    return key;
  });
  return indices.sort((a, b) => keys[a] - keys[b] || a - b);
}

/** 把预览点配到正式点图的粒子槽；只生成展示属性，不重排真实压力数组。 */
export function mapParticleOrigins(source, target, rect, pixelRatio = 1) {
  const gridMapped = source.grid?.cols * source.grid?.rows === source.positions.length / 3
    && target.grid?.cols * target.grid?.rows === target.positions.length / 3;
  const starts = spatialOrder(source.positions);
  const ends = gridMapped ? Array.from({ length: target.positions.length / 3 }, (_, index) => index) : spatialOrder(target.positions);
  if (!starts.length || !ends.length || !rect.width || !rect.height) return null;
  const positions = new Float32Array(ends.length * 3);
  const colors = new Float32Array(ends.length * 3);
  const sizes = new Float32Array(ends.length);
  const opacity = new Float32Array(ends.length);
  const assignments = ends.map((slot, rank) => gridMapped
    ? Math.round(Math.floor(slot / target.grid.cols) / Math.max(target.grid.rows - 1, 1) * (source.grid.rows - 1)) * source.grid.cols
      + Math.round((slot % target.grid.cols) / Math.max(target.grid.cols - 1, 1) * (source.grid.cols - 1))
    : starts[Math.min(starts.length - 1, Math.floor(rank * starts.length / ends.length))]);
  const counts = new Map();
  assignments.forEach((index) => counts.set(index, (counts.get(index) || 0) + 1));
  /** 只更新已配对点的投影；每帧重新排序会在邻点交叉时突然换目标。 */
  const update = (next, nextRect = rect, nextRatio = pixelRatio) => {
    if (!next || next.positions?.length !== source.positions.length || next.colors?.length !== source.colors.length
      || next.sizes?.length !== source.sizes.length || !nextRect.width || !nextRect.height) return false;
    ends.forEach((slot, rank) => {
      const origin = assignments[rank];
      positions.set([(next.positions[origin * 3] - nextRect.x) / nextRect.width * 2 - 1,
        1 - (next.positions[origin * 3 + 1] - nextRect.y) / nextRect.height * 2, 0], slot * 3);
      colors.set(next.colors.subarray(origin * 3, origin * 3 + 3), slot * 3);
      sizes[slot] = next.sizes[origin] * nextRatio;
      opacity[slot] = 1 / counts.get(origin);
    });
    return true;
  };
  update(source);
  return { positions, colors, sizes, opacity, update };
}

/** 在原生点材质中插值投影，终点每帧仍由原相机、压力顶点与色带计算。 */
export function patchParticleShader(shader, progress) {
  shader.uniforms.portalProgress = progress;
  shader.vertexShader = `uniform float portalProgress;
attribute vec3 portalOrigin;
attribute vec3 portalColor;
attribute float portalSize;
attribute float portalAlpha;
varying vec3 vPortalColor;
varying float vPortalAlpha;
${shader.vertexShader}`.replace('#include <fog_vertex>', `#include <fog_vertex>
gl_Position.xyz = mix(portalOrigin * gl_Position.w, gl_Position.xyz, portalProgress);
gl_PointSize = mix(portalSize, gl_PointSize, portalProgress);
vPortalColor = portalColor;
vPortalAlpha = portalAlpha;`);
  shader.fragmentShader = `uniform float portalProgress;
varying vec3 vPortalColor;
varying float vPortalAlpha;
${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(vPortalColor, diffuseColor.rgb, portalProgress);
diffuseColor.a *= mix(vPortalAlpha, 1.0, portalProgress);`);
}

/** 给原生点图安装临时形变入口；独立使用该渲染器时不改变材质、相机或渲染结果。 */
export function installParticleEntrance(renderer, scene, camera, points, grid) {
  const canvas = renderer.domElement;
  let stop = null;
  let disposed = false;
  const api = {
    /** 原生几何始终保持实时更新，插值只发生在 GPU 的最终投影阶段。 */
    play(source, { reverse = false, reducedMotion = false, signal, resolveSource, onStart = () => {}, onProgress = () => {} } = {}) {
      if (disposed || signal?.aborted || !points.material?.isPointsMaterial) return null;
      const rect = canvas.getBoundingClientRect();
      const target = captureParticleProjection(points, camera, rect);
      if (target) target.grid = grid;
      const origins = target && mapParticleOrigins(source, target, rect, renderer.getPixelRatio());
      if (!origins) return null;
      const initialProgress = stop ? Number(canvas.dataset.particleEntrance) : reverse ? 1 : 0;
      stop?.();
      const geometry = points.geometry;
      const originalMaterial = points.material;
      const originalCulling = points.frustumCulled;
      const material = originalMaterial.clone();
      const progress = { value: initialProgress };
      let finished = false;
      material.onBeforeCompile = (shader) => patchParticleShader(shader, progress);
      material.customProgramCacheKey = () => 'shroom-particle-entrance-v1';
      material.transparent = true;
      points.material = material;
      points.frustumCulled = false;
      const attributes = { portalOrigin: [origins.positions, 3], portalColor: [origins.colors, 3], portalSize: [origins.sizes, 1], portalAlpha: [origins.opacity, 1] };
      for (const [name, [array, size]] of Object.entries(attributes)) geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
      const clearAlpha = renderer.getClearAlpha();
      const decorations = [];
      scene.traverse((object) => {
        if (object !== points && object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const item of materials) decorations.push({ material: item, opacity: item.opacity, transparent: item.transparent });
        }
      });
      /** 网格和背景随实际点云落位出现，不把一整张压力画布做透明度替换。 */
      const update = () => {
        // ⚠️ GSAP 作用域回收还可能触发 onUpdate，不能再写已经移除的 GPU 属性或推进预览。
        if (finished) return;
        if (resolveSource && origins.update(resolveSource(progress.value), canvas.getBoundingClientRect(), renderer.getPixelRatio())) {
          for (const name of Object.keys(attributes)) geometry.attributes[name].needsUpdate = true;
        }
        renderer.setClearAlpha(clearAlpha * progress.value);
        for (const item of decorations) { item.material.transparent = true; item.material.opacity = item.opacity * progress.value; }
        canvas.dataset.particleEntrance = String(progress.value);
        onProgress(progress.value);
      };
      return new Promise((resolve) => {
        let tween;
        /** 完成和取消都恢复原材质，过渡不能改变后续框选、色带或压力计算。 */
        const finish = () => {
          if (finished) return;
          finished = true;
          tween?.kill();
          signal?.removeEventListener('abort', finish);
          points.material = originalMaterial;
          points.frustumCulled = originalCulling;
          for (const name of Object.keys(attributes)) geometry.deleteAttribute(name);
          material.dispose();
          renderer.setClearAlpha(clearAlpha);
          for (const item of decorations) { item.material.opacity = item.opacity; item.material.transparent = item.transparent; }
          stop = null;
          resolve();
        };
        stop = finish;
        signal?.addEventListener('abort', finish, { once: true });
        update();
        renderer.render(scene, camera);
        onStart();
        tween = gsap.to(progress, { value: reverse ? 0 : 1, duration: reducedMotion ? 0 : 1.08, ease: 'power3.inOut',
          onUpdate: update, onComplete: () => { renderer.render(scene, camera); finish(); } });
      });
    },
  };
  canvas.shroomParticleEntrance = api;
  return () => { disposed = true; stop?.(); delete canvas.shroomParticleEntrance; };
}
