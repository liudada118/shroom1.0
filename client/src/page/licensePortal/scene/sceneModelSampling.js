import * as THREE from 'three';

/** 按世界空间表面积分配粒子，避免高细分手指占满预览而躯干几乎不可见。 */
export function getMeshSurfaceArea(mesh) {
  const position = mesh.geometry?.attributes?.position;
  if (!position) return 0;
  mesh.updateWorldMatrix(true, false);
  const indices = mesh.geometry.index;
  const count = indices?.count || position.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let area = 0;
  for (let index = 0; index + 2 < count; index += 3) {
    a.fromBufferAttribute(position, indices ? indices.getX(index) : index).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, indices ? indices.getX(index + 1) : index + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, indices ? indices.getX(index + 2) : index + 2).applyMatrix4(mesh.matrixWorld);
    area += b.sub(a).cross(c.sub(a)).length() * .5;
  }
  return area;
}
