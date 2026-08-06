/**
 * App.jsx - 站壳：左导航 + 右内容 + hash 路由
 *
 * ## 为什么不引 react-router
 *
 * 这个站是**一层**路由、十个静态页、没有参数段、没有嵌套。react-router 能带来的
 * 是 `<Link>` 的可访问性与 loader/action 那套数据编排，两样这里都用不上。
 * 换来的是一个 20KB 的依赖和一份「文档站自己的技术选型」需要向读者解释。
 * `hashchange` 一个事件就够了。
 *
 * 用 hash 而不是 history API 也是**必须**的：`base: './'` 的产物要能被丢进任意
 * 静态服务器（内网机上大概率是 `python -m http.server` 或 nginx 默认配置），
 * 那种服务器不会把 `/point-grid` 回退到 `index.html` —— history 路由会 404。
 * hash 不经服务器，挂到哪都能开。
 *
 * ## 页面按需加载
 *
 * `routes.js` 里每页都是 `load: () => import(...)`。`PointGrid.jsx` 会拉进 three
 * （500KB+），`Gallery.jsx` 会拉进两个渲染器 —— 首屏的「这个包是什么」不该等它们。
 *
 * 切页时**先卸载旧页再挂新页**（`key={routeId}` 之外，靠 status 机把 Page 置空）。
 * 这一条不是洁癖：带 WebGL 的页面卸载时才会跑 dispose，两页同时挂着就会多占一个
 * 上下文。浏览器对同时存活的 WebGL 上下文有硬上限（约 8–16 个），文档站是全仓
 * 唯一会短时间反复挂载 / 卸载渲染器的地方。
 */

import React from 'react';

import { DEFAULT_ROUTE_ID, findRoute, groupedRoutes } from './routes.js';

/** 从 `location.hash` 里读出路由 id；未知或空一律回落首页。 */
function readRouteId() {
  const id = window.location.hash.replace(/^#\/?/, '');
  return findRoute(id) ? id : DEFAULT_ROUTE_ID;
}

/**
 * 订阅 hash 变化。
 *
 * @returns {string} 当前路由 id。
 */
function useHashRoute() {
  const [routeId, setRouteId] = React.useState(readRouteId);

  React.useEffect(() => {
    const onChange = () => setRouteId(readRouteId());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return routeId;
}

const NAV_GROUPS = groupedRoutes();

export default function App() {
  const routeId = useHashRoute();
  const route = findRoute(routeId);

  // { status, Page }：Page 只在 ready 时非空，保证同一时刻只有一页挂着。
  const [state, setState] = React.useState({ status: 'loading', Page: null, error: null });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', Page: null, error: null });

    route.load()
      .then((mod) => {
        if (cancelled) return;
        setState({ status: 'ready', Page: mod.default, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(`[docs] 页面 ${routeId} 加载失败:`, error);
        setState({ status: 'error', Page: null, error });
      });

    return () => { cancelled = true; };
  }, [route, routeId]);

  // 换页时滚回顶部。不做的话从长页跳到短页会停在半空，读者以为页面是空的。
  React.useEffect(() => {
    document.querySelector('.docs-main')?.scrollTo(0, 0);
  }, [routeId]);

  const { Page } = state;

  return (
    <div className="docs-shell">
      <nav className="docs-nav">
        <a className="docs-brand" href={`#/${DEFAULT_ROUTE_ID}`}>
          <strong>@shroom/frontend</strong>
          <span className="docs-brand-sub">压力传感前端 SDK · 文档与活预览</span>
        </a>

        {NAV_GROUPS.map(({ group, routes }) => (
          <section key={group} className="docs-nav-group">
            <h2>{group}</h2>
            <ul>
              {routes.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#/${item.id}`}
                    className={item.id === routeId ? 'is-active' : undefined}
                    aria-current={item.id === routeId ? 'page' : undefined}
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="docs-nav-foot">
          本站所有契约表、预设、配色都直接从 <code>core/</code> 读取渲染，
          不是手抄的 —— 改一行源码刷新页面就变。
        </p>
      </nav>

      <main className="docs-main">
        {state.status === 'loading' && <p className="docs-status">加载中…</p>}
        {state.status === 'error' && (
          <p className="docs-status docs-status-error">
            页面加载失败：{state.error?.message}
          </p>
        )}
        {/* key 保证换页时整棵子树重建，页面内部的 useState 不会串味 */}
        {Page && <Page key={routeId} />}
      </main>
    </div>
  );
}
