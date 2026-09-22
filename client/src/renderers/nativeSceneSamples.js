import * as THREE from 'three';

/** 从真实网格按世界表面积取稳定三角形槽，跟随原模型姿态而不修改传感数据。 */
export function createNativeModelSamples(model, count = 3600) {
  model.updateWorldMatrix(true, true);
  const meshes = [], triangles = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let total = 0;
  model.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    meshes.push(mesh);
    const position = mesh.geometry.attributes.position, indices = mesh.geometry.index;
    for (let i = 0; i + 2 < (indices?.count || position.count); i += 3) {
      const vertices = [0, 1, 2].map((offset) => indices ? indices.getX(i + offset) : i + offset);
      a.fromBufferAttribute(position, vertices[0]).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, vertices[1]).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, vertices[2]).applyMatrix4(mesh.matrixWorld);
      const area = b.sub(a).cross(c.sub(a)).length() * .5;
      if (!(area > 0) || !Number.isFinite(area)) continue;
      total += area;
      triangles.push({ mesh, vertices, end: total });
    }
  });
  if (!total) return null;
  let cursor = 0;
  const slots = Array.from({ length: count }, (_, index) => {
    const distance = (index + .5) * total / count;
    while (triangles[cursor].end < distance) cursor++;
    const u = Math.sqrt(((index + 1) * .754877666) % 1);
    const v = ((index + 1) * .569840296) % 1;
    return { ...triangles[cursor], weights: [1 - u, u * (1 - v), u * v] };
  });
  const positions = new Float32Array(count * 3), point = new THREE.Vector3(), vertex = new THREE.Vector3();
  /** 每帧只更新固定样本，骨骼及父级变换使用原生模型当前状态。 */
  const update = () => {
    model.updateWorldMatrix(true, false);
    model.updateMatrixWorld(true);
    meshes.forEach((mesh) => mesh.skeleton?.update());
    slots.forEach((slot, index) => {
      point.set(0, 0, 0);
      slot.vertices.forEach((id, corner) => {
        vertex.fromBufferAttribute(slot.mesh.geometry.attributes.position, id);
        if (slot.mesh.isSkinnedMesh) slot.mesh.boneTransform(id, vertex);
        point.addScaledVector(vertex, slot.weights[corner]);
      });
      point.applyMatrix4(slot.mesh.matrixWorld).toArray(positions, index * 3);
    });
  };
  update();
  return { meshes, positions, update };
}

/** 从已加载的原生足底贴图取透明轮廓，粒子终点随对应平面移动。 */
export function createFootPlaneSamples(model, count = 3600) {
  const meshes = [], slots = [];
  model.traverse((mesh) => { if (mesh.isMesh && mesh.material?.map?.image) meshes.push(mesh); });
  for (const [part, mesh] of meshes.entries()) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(mesh.material.map.image, 0, 0, 192, 192);
    const pixels = context.getImageData(0, 0, 192, 192).data, visible = [];
    for (let i = 0; i < pixels.length / 4; i++) if (pixels[i * 4 + 3] >= 32) visible.push(i);
    if (!visible.length) throw new Error('足底贴图没有可见轮廓');
    const amount = Math.floor(count / meshes.length) + (part === meshes.length - 1 ? count % meshes.length : 0);
    const { width, height } = mesh.geometry.parameters;
    for (let i = 0; i < amount; i++) {
      const pixel = visible[Math.floor(i * visible.length / amount)];
      slots.push({ mesh, point: new THREE.Vector3(((pixel % 192) / 191 - .5) * width, (.5 - Math.floor(pixel / 192) / 191) * height, 0) });
    }
  }
  if (!slots.length) return null;
  const positions = new Float32Array(slots.length * 3), point = new THREE.Vector3();
  /** 保留原生平面朝向及控制器变换，禁止用预览坐标代替实际终点。 */
  const update = () => {
    model.updateWorldMatrix(true, true);
    slots.forEach((slot, i) => point.copy(slot.point).applyMatrix4(slot.mesh.matrixWorld).toArray(positions, i * 3));
  };
  update();
  return { meshes, positions, update };
}
