import { createContext } from 'react';

// 宿主隐藏压力画面时仍保留统计与缓存；渲染器可单独停掉 GPU 提交。
// value 保持同一个 ref，避免可见性切换重跑旧场景组件、替换其命令闭包。
export const SceneVisibilityContext = createContext({ current: true });
