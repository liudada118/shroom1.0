/** 把固定基准点面投影到面板之间，保留用户的镜头位置、旋转目标和缩放。 */
export function fitPortalPointViewport({ camera, canvas, viewport, distance, planeWidth, planeDepth, baseFov = 40 }) {
  if (!canvas.width || !canvas.height || !viewport.width || !viewport.height || !(distance > 0)) return;
  const left = viewport.left - canvas.left;
  const top = viewport.top - canvas.top;
  const fullViewport = Math.abs(left) < 1 && Math.abs(top) < 1
    && Math.abs(viewport.width - canvas.width) < 1 && Math.abs(viewport.height - canvas.height) < 1;
  if (fullViewport) {
    camera.fov = baseFov;
    camera.aspect = canvas.width / canvas.height;
    camera.clearViewOffset();
    return;
  }

  // ⚠️ 用初始化距离计算投影，不能读当前镜头距离，否则窗口变化会抵消用户的手动缩放。
  const aspect = viewport.width / viewport.height;
  const tangent = Math.max(Math.tan(baseFov * Math.PI / 360),
    planeWidth / (2 * distance * .9 * aspect), planeDepth / (2 * distance * .9));
  camera.fov = Math.atan(tangent) * 360 / Math.PI;
  // 画布仍铺满窗口，框选及进出场继续使用原来的屏幕坐标。
  camera.setViewOffset(viewport.width, viewport.height, -left, -top, canvas.width, canvas.height);
}
