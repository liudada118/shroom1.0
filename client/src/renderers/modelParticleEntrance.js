import * as THREE from 'three';
import { installParticleEntrance } from './particleEntrance';

/** 从真实模型网格取固定顶点槽，骨骼和世界变换由每帧实际姿态计算。 */
export function createModelParticleSamples(model, count = 3600) {
  const meshes = [];
  model.traverse((mesh) => {
    if (mesh.isMesh && mesh.geometry?.attributes?.position?.count) meshes.push(mesh);
  });
  const total = meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0);
  if (!total) return null;
  const slots = Array.from({ length: Math.min(count, total) }, (_, index) => {
    let vertex = Math.floor(index * total / Math.min(count, total));
    for (const mesh of meshes) {
      if (vertex < mesh.geometry.attributes.position.count) return { mesh, vertex };
      vertex -= mesh.geometry.attributes.position.count;
    }
    return null;
  });
  const positions = new Float32Array(slots.length * 3);
  const point = new THREE.Vector3();
  /** 仅写临时展示点，不改变模型几何、骨骼或压力热图。 */
  const update = () => {
    model.updateWorldMatrix(true, false);
    // ⚠️ SkinnedMesh 的绑定逆矩阵在此方法中更新，漏掉会让点云重复应用手套姿态。
    model.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.skeleton?.update();
    slots.forEach(({ mesh, vertex }, index) => {
      point.fromBufferAttribute(mesh.geometry.attributes.position, vertex);
      if (mesh.isSkinnedMesh) mesh.boneTransform(vertex, point);
      point.applyMatrix4(mesh.matrixWorld).toArray(positions, index * 3);
    });
  };
  update();
  return { meshes, positions, update };
}

/** 点云先贴合原生实体表面，再显出材质；进退场共用实际手模型而非第二个演示模型。 */
export function installModelParticleEntrance(renderer, scene, camera, model, options = {}) {
  const samples = options.samples || createModelParticleSamples(model);
  if (!samples) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(samples.positions, 3));
  geometry.computeBoundingBox();
  const extent = geometry.boundingBox.getSize(new THREE.Vector3());
  const size = options.adaptiveSize ? Math.max(extent.x, extent.y, extent.z) * .005 : .045;
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size, color: '#a8e4ff', transparent: true, depthWrite: false }));
  points.visible = false;
  scene.add(points);
  const disposeEntrance = installParticleEntrance(renderer, scene, camera, points);
  const entrance = renderer.domElement.shroomParticleEntrance;
  let running = false;
  let generation = 0;
  const materials = new Map();
  samples.meshes.forEach((mesh) => {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!materials.has(material)) materials.set(material, { opacity: material.opacity, depthWrite: material.depthWrite, side: material.side });
    }
  });
  /** 结束后恢复双面材质；过渡期间只画外表面，避免透明模型的背面三角形叠色。 */
  const restoreSurface = () => {
    for (const [material, original] of materials) {
      material.depthWrite = original.depthWrite;
      if (material.side !== original.side) { material.side = original.side; material.needsUpdate = true; }
    }
  };
  const api = {
    /** 反向或中途取消从当前插值接续，结束恢复实体材质及深度写入。 */
    play(source, options = {}) {
      if (options.signal?.aborted || !source?.positions?.length) return null;
      const current = ++generation;
      samples.update();
      geometry.attributes.position.needsUpdate = true;
      points.visible = true;
      const playing = entrance.play(source, { ...options, onProgress: (progress) => {
        const solid = THREE.MathUtils.smoothstep(progress, .55, 1);
        for (const [material, original] of materials) {
          material.opacity = original.opacity * solid;
          material.depthWrite = solid > 0 && original.depthWrite;
          if (material.side !== THREE.FrontSide) { material.side = THREE.FrontSide; material.needsUpdate = true; }
        }
        points.material.opacity = 1 - solid;
        options.onProgress?.(progress);
      } });
      if (!playing) { points.visible = false; running = false; return null; }
      running = true;
      return playing.then(() => {
        if (current === generation) {
          restoreSurface();
          running = false; points.visible = false;
        }
      });
    },
  };
  renderer.domElement.shroomParticleEntrance = api;
  return {
    /** 在原生渲染前跟随当前骨骼，防止收到弯曲数据后点云与实体脱节。 */
    update() {
      if (!running) return;
      samples.update();
      geometry.attributes.position.needsUpdate = true;
    },
    /** 卸载取消形变并释放临时几何，不释放调用方拥有的实体模型。 */
    dispose() {
      ++generation; running = false; disposeEntrance(); scene.remove(points);
      restoreSurface();
      geometry.dispose(); points.material.dispose();
    },
  };
}
