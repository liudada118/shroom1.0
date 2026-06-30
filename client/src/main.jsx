/**
 * main.jsx - Vite 前端入口文件
 *
 * 变更:
 * 1. 从 ReactDOM.render 迁移到 React 19 的 createRoot API
 * 2. 作为 Vite 的入口点（替代 CRA 的 index.js）
 */

import React from "react";
import { createRoot } from "react-dom/client";
// React 19 兼容补丁：antd 静态方法（Modal.error / message.xxx / notification）
// 依赖已被 React 19 移除的 ReactDOM.render，不打补丁会静默失效。
// 必须在任何 antd 组件/方法使用之前 import。
import "@ant-design/v5-patch-for-react-19";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <App />
);
