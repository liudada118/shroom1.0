/**
 * main.jsx - Vite 前端入口文件
 *
 * 变更:
 * 1. 从 ReactDOM.render 迁移到 React 19 的 createRoot API
 * 2. 作为 Vite 的入口点（替代 CRA 的 index.js）
 */

import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
