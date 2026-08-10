/**
 * routes.js - 页面清单（导航与路由的唯一来源）
 *
 * 单独成文件是为了让页面之间能互相跳而不产生循环 import：`App.jsx` 引它渲染
 * 左侧导航，各 page 也引它做正文里的交叉链接（比如「入参」页指回「契约」页）。
 * 如果这份清单写在 `App.jsx` 里，page → App → page 就是一个环。
 *
 * `load` 是动态 import。文档站自己也按需加载 —— 一来 `PointGrid.jsx` 会拉进
 * three（500KB+），首屏不该等它；二来这正好是包里 `registerRenderer` 的
 * `load` 用的同一套写法，站点自身就是那条约定的一个用例。
 *
 * `group` 决定导航分组；顺序即数组顺序。
 */

export const ROUTES = [
  {
    id: 'intro',
    title: '这个包是什么',
    group: '开始',
    load: () => import('./pages/Intro.jsx'),
  },
  {
    id: 'quickstart',
    title: '快速开始',
    group: '开始',
    load: () => import('./pages/QuickStart.jsx'),
  },
  {
    id: 'num-matrix',
    title: '数字矩阵',
    group: '内置渲染器',
    load: () => import('./pages/NumMatrix.jsx'),
  },
  {
    id: 'point-grid',
    title: '点阵热力（3D）',
    group: '内置渲染器',
    load: () => import('./pages/PointGrid.jsx'),
  },
  {
    id: 'hand-points',
    title: '手部点云（3D）',
    group: '内置渲染器',
    load: () => import('./pages/HandPoints.jsx'),
  },
  {
    id: 'heatmap',
    title: '斑点热力（两条）',
    group: '内置渲染器',
    load: () => import('./pages/Heatmap.jsx'),
  },
  {
    id: 'gallery',
    title: '预设 × 配色 一览',
    group: '内置渲染器',
    load: () => import('./pages/Gallery.jsx'),
  },
  {
    id: 'write-renderer',
    title: '写自己的渲染器',
    group: '二次开发',
    load: () => import('./pages/WriteRenderer.jsx'),
  },
  {
    id: 'frame-bus',
    title: '帧总线与 useSceneFrame',
    group: '二次开发',
    load: () => import('./pages/FrameBus.jsx'),
  },
  {
    id: 'contract',
    title: '渲染器契约',
    group: '参考',
    load: () => import('./pages/Contract.jsx'),
  },
  {
    id: 'api',
    title: 'RendererHost 入参与方法',
    group: '参考',
    load: () => import('./pages/Api.jsx'),
  },
  {
    id: 'pitfalls',
    title: '坑与已知缺陷',
    group: '参考',
    load: () => import('./pages/Pitfalls.jsx'),
  },
];

/** 首屏落在哪一页。 */
export const DEFAULT_ROUTE_ID = ROUTES[0].id;

/**
 * 按 id 取路由。
 *
 * @param {string} id 路由 id。
 * @returns {object | undefined} 路由项，未知 id 返回 undefined。
 */
export function findRoute(id) {
  return ROUTES.find((route) => route.id === id);
}

/**
 * 按 `group` 把路由分组，保持数组原顺序。
 *
 * @returns {Array<{group: string, routes: object[]}>} 分组后的导航结构。
 */
export function groupedRoutes() {
  const groups = [];
  ROUTES.forEach((route) => {
    const last = groups[groups.length - 1];
    if (last && last.group === route.group) last.routes.push(route);
    else groups.push({ group: route.group, routes: [route] });
  });
  return groups;
}
