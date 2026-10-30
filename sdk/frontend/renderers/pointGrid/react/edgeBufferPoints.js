import * as THREE from 'three';
import { blurWithZeroBoundary, buildEdgeBufferRing, normalizeEdgeBuffer, sampleEdgeBuffer } from '../core/edgeBuffer.js';

/** 将可调外围点挂在原点图下，保留原几何、框选索引和旋转中心。 */
export function createEdgeBufferPoints({ points, rows, columns, padding = 0, rowStretch = 1, positionAt }) {
  let width = 0;
  let ring = [];
  let values = [];
  let previous = null;
  let previousRadius = null;
  let geometry = new THREE.BufferGeometry();
  const border = new THREE.Points(geometry, points.material);
  border.name = 'pressure-edge-buffer';
  border.visible = false;
  border.userData.particleEntranceAnchors = new Uint32Array(0);
  border.frustumCulled = false;
  // 外围是显示缓冲，不能当作真实传感器点参与拾取。
  border.raycast = () => {};
  points.add(border);
  let positions = new Float32Array(0);
  let colors = new Float32Array(0);

  /** 更新独立显示副本，末帧不变时复用高斯结果。 */
  function update(source, blurWidth, blurHeight, radius, nextWidth) {
    const next = normalizeEdgeBuffer(nextWidth);
    border.visible = next > 0;
    if (next !== width) {
      width = next;
      ring = buildEdgeBufferRing(rows, columns, padding, width, rowStretch);
      // 缓冲点从最近的主图点展开，仍由主几何负责压力索引与选区。
      border.userData.particleEntranceAnchors = Uint32Array.from(ring, ([, col, row]) =>
        Math.max(0, Math.min(rows * rowStretch - 1, row)) * columns + Math.max(0, Math.min(columns - 1, col)));
      geometry.dispose();
      geometry = new THREE.BufferGeometry();
      border.geometry = geometry;
      positions = new Float32Array(ring.length * 3);
      colors = new Float32Array(ring.length * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (!width) return;
    if (previousRadius !== radius || !previous || previous.length !== source.length || source.some((value, index) => value !== previous[index])) {
      previous = Array.from(source);
      previousRadius = radius;
      values = blurWithZeroBoundary(source, blurWidth, blurHeight, radius);
    }
  }

  /** 读取原几何对应的显示值，不改写统计使用的原高斯缓存。 */
  function sample(index, fallback) {
    if (!width) return fallback;
    return sampleEdgeBuffer(values, rows, columns, Math.floor(index / columns / rowStretch), index % columns, padding, width);
  }

  /** 更新外围高度与配色，独立于传感器帧和主网格的选区。 */
  function render({ height, smoothedValues, color, suppressed = false }) {
    if (!width) return;
    for (let index = 0; index < ring.length; index += 1) {
      const [row, col, stretchedRow] = ring[index];
      const value = suppressed ? 0 : sampleEdgeBuffer(smoothedValues, rows, columns, row, col, padding, width,
        rowStretch, stretchedRow - row * rowStretch);
      const [x, z] = positionAt(stretchedRow, col);
      positions[index * 3] = x;
      positions[index * 3 + 1] = value * height;
      positions[index * 3 + 2] = z;
      const rgb = color(value);
      colors[index * 3] = rgb[0] / 255;
      colors[index * 3 + 1] = rgb[1] / 255;
      colors[index * 3 + 2] = rgb[2] / 255;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    // ⚠️ 调宽会更换几何，必须在本帧上传前补齐正在播放的入口属性，避免边框跳到终点。
    points.userData.particleEntrance?.syncChild(border);
  }

  /** 释放新增几何；共享材质仍由主点图释放。 */
  function dispose() {
    points.remove(border);
    geometry.dispose();
    previous = null;
    values = [];
  }

  return { update, sample, render, dispose };
}
