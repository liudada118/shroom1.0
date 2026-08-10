/**
 * routes.js - 页面清单（导航与路由的唯一来源）
 *
 * 和前端文档站同一套写法：单独成文件，让页面之间能互相跳而不产生循环 import
 * （`App.jsx` 引它渲染左导航，各 page 也引它做正文交叉链接；写在 App.jsx 里
 * 就成了 page → App → page 的环）。
 *
 * `load` 是动态 import：每页都会从 `@shroom/backend` 里拉不同的子模块进来，
 * 首屏的「这个包是什么」不该等「传感器注册表」那 57 条定义。
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
    id: 'protocol',
    title: '协议与解码',
    group: '动手',
    load: () => import('./pages/Protocol.jsx'),
  },
  {
    id: 'line-orders',
    title: '线序与矩阵',
    group: '动手',
    load: () => import('./pages/LineOrders.jsx'),
  },
  {
    id: 'sensors',
    title: '传感器注册表',
    group: '动手',
    load: () => import('./pages/Sensors.jsx'),
  },
  {
    id: 'collection',
    title: '采集与导出',
    group: '动手',
    load: () => import('./pages/Collection.jsx'),
  },
  {
    id: 'contract',
    title: '契约与命令',
    group: '参考',
    load: () => import('./pages/Contract.jsx'),
  },
  {
    id: 'serial',
    title: '串口与会话',
    group: '参考',
    load: () => import('./pages/Serial.jsx'),
  },
  {
    id: 'add-sensor',
    title: '加一种自己的传感器',
    group: '参考',
    load: () => import('./pages/AddSensor.jsx'),
  },
  {
    id: 'pitfalls',
    title: '坑与已知妥协',
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
