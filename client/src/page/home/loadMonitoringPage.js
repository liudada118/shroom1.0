/** 预载与路由共用同一个监测页模块，避免粒子放大后遇到空白的懒加载占位。 */
export function loadMonitoringPage() {
  return import('./Home');
}
